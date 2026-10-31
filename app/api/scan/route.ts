import { NextRequest, NextResponse } from "next/server";
import { limits } from "@/lib/config";
import { fetchRepoFiles, parseRepoUrl, ScanInputError } from "@/lib/github";
import { acquireSlot, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { buildReport } from "@/lib/report";
import { buildAIReport } from "@/lib/report-ai";
import { convertReportToHTML } from "@/lib/pdf-converter";
import { performScan, wantFile } from "@/lib/scanner";

// Needs Node streams/zlib, so not the Edge runtime.
export const runtime = "nodejs";
// Always run per request. 60s works on every Vercel plan, including Hobby.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(clientIp(request.headers));
  if (!limited.ok) {
    return json(
      { error: `Too many scans. Try again in ${Math.ceil(limited.retryAfterSec / 60)} minute(s).` },
      429,
      { "Retry-After": String(limited.retryAfterSec) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const repoUrl = (body as { repoUrl?: unknown })?.repoUrl;
  if (typeof repoUrl !== "string" || repoUrl.length === 0 || repoUrl.length > 300) {
    return json({ error: "Invalid repository URL" }, 400);
  }

  const release = acquireSlot();
  if (!release) return json({ error: "The scanner is busy. Please try again in a moment." }, 503, { "Retry-After": "15" });

  try {
    const ref = parseRepoUrl(repoUrl);
    const canonicalUrl = `https://github.com/${ref.owner}/${ref.repo}`;
    const started = Date.now();

    const { files, stats } = await fetchRepoFiles(ref, wantFile);
    // Whatever time is left after the download is the budget for advisory lookups.
    const deadline = Math.min(started + 50_000, Date.now() + limits.advisoryBudgetMs);
    const result = await performScan(files, { truncated: stats.truncated, deadline });

    const reportText = buildReport(result, canonicalUrl);
    const reportAI = buildAIReport(result, canonicalUrl);
    const reportHTML = convertReportToHTML(reportText, result);

    return json({
      repo: canonicalUrl,
      generatedAt: new Date().toISOString(),
      result: { ...result, findings: result.findings.slice(0, limits.maxFindingsReturned) },
      findingsTotal: result.findings.length,
      report: reportText,
      reportAI: reportAI,
      reportHTML: reportHTML,
    });
  } catch (err) {
    if (err instanceof ScanInputError) return json({ error: err.message }, 400);
    // Log the cause server-side only; never echo internals (or matched secrets) to the client.
    console.error("Scan error:", err instanceof Error ? err.message : err);
    return json({ error: "Scan failed. Please try again." }, 500);
  } finally {
    release();
  }
}