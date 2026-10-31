import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import { extract as tarExtract } from "tar-stream";
import { endpoints, limits } from "./config";

/** Thrown for problems the caller can fix (bad URL, private repo, repo too big). */
export class ScanInputError extends Error {}

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface RepoSnapshot {
  /** Relative path (repo root = "") -> UTF-8 text, only for files accepted by `wantFile`. */
  files: Map<string, string>;
  stats: {
    downloadedBytes: number;
    filesRead: number;
    /** True when the in-memory cap was hit and some wanted files were not read. */
    truncated: boolean;
  };
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

/**
 * Accepts https://github.com/<owner>/<repo>[.git][/anything]. Nothing else.
 * The result only ever fills a fixed URL template, so no user text reaches a
 * shell or an arbitrary host.
 */
export function parseRepoUrl(input: string): RepoRef {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ScanInputError("That doesn't look like a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new ScanInputError("Use an https:// GitHub URL");
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new ScanInputError("Only github.com repositories are supported");
  }
  if (url.username || url.password) {
    throw new ScanInputError("URLs with credentials are not supported");
  }

  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, "");
  if (!owner || !repo) {
    throw new ScanInputError("Use the form https://github.com/<owner>/<repo>");
  }
  if (!NAME.test(owner) || !NAME.test(repo) || repo === "." || repo === "..") {
    throw new ScanInputError("Invalid owner or repository name");
  }
  return { owner, repo };
}

/**
 * Downloads the default-branch archive from GitHub and reads the files that
 * `wantFile` accepts straight into memory. No disk, no child process, no git,
 * so it runs on Vercel's serverless runtime. Public repositories only.
 */
export async function fetchRepoFiles(
  ref: RepoRef,
  wantFile: (path: string, size: number) => boolean
): Promise<RepoSnapshot> {
  const url = `${endpoints.archive}/${ref.owner}/${ref.repo}/archive/HEAD.tar.gz`;

  const base = new URL(endpoints.archive);
  const allowedHosts = new Set([base.hostname, ...endpoints.archiveHosts]);

  // Follow redirects by hand so every hop is checked BEFORE it is requested:
  // GitHub redirects /archive/HEAD.tar.gz to codeload.github.com, and nowhere else.
  let res: Response;
  try {
    let target = new URL(url);
    let hops = 0;
    for (;;) {
      res = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(limits.fetchTimeoutMs),
        headers: { "User-Agent": "security-scanner" },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel();
        const next = new URL(location, target);
        if (++hops > 3 || next.protocol !== base.protocol || !allowedHosts.has(next.hostname)) {
          throw new Error(`Blocked redirect to ${next.hostname}`);
        }
        target = next;
        continue;
      }
      break;
    }
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ScanInputError("Downloading the repository timed out");
    }
    throw err;
  }

  if (res.status === 404) {
    throw new ScanInputError("Repository not found, or it is private (only public repositories are supported)");
  }
  if (!res.ok || !res.body) {
    throw new Error(`GitHub returned HTTP ${res.status}`);
  }

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > limits.maxDownloadBytes) {
    throw new ScanInputError("Repository is too large to scan (limit 50 MB compressed)");
  }

  const files = new Map<string, string>();
  let downloadedBytes = 0;
  let unpackedBytes = 0;
  let storedBytes = 0;
  let truncated = false;

  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      downloadedBytes += chunk.length;
      if (downloadedBytes > limits.maxDownloadBytes) {
        cb(new ScanInputError("Repository is too large to scan (limit 50 MB compressed)"));
        return;
      }
      cb(null, chunk);
    },
  });

  const extractor = tarExtract();

  extractor.on("entry", (header, stream, next) => {
    unpackedBytes += header.size ?? 0;
    if (unpackedBytes > limits.maxUnpackedBytes) {
      extractor.destroy(new ScanInputError("Repository is too large to scan"));
      return;
    }

    // Entries look like "<repo>-<sha>/src/app.ts"; drop the first segment.
    const slash = header.name.indexOf("/");
    const path = slash === -1 ? "" : header.name.slice(slash + 1);
    const size = header.size ?? 0;
    const safe = path !== "" && !path.split("/").includes("..");

    let keep = header.type === "file" && safe && wantFile(path, size);
    if (keep && storedBytes + size > limits.maxStoredBytes) {
      truncated = true;
      keep = false;
    }

    if (!keep) {
      stream.on("end", next);
      stream.resume();
      return;
    }

    const chunks: Buffer[] = [];
    stream.on("data", (c: unknown) => {
      chunks.push(c as Buffer);
    });
    stream.on("error", next);
    stream.on("end", () => {
      const buf = Buffer.concat(chunks);
      // Skip binaries (NUL byte in the first 8 KB).
      if (!buf.subarray(0, 8000).includes(0)) {
        files.set(path, buf.toString("utf8"));
        storedBytes += buf.length;
      }
      next();
    });
  });

  await pipeline(
    Readable.fromWeb(res.body as unknown as WebReadableStream),
    limiter,
    createGunzip(),
    extractor
  );

  return { files, stats: { downloadedBytes, filesRead: files.size, truncated } };
}