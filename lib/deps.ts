import { satisfies, valid } from "semver";
import { endpoints, limits } from "./config";
import { SEVERITY_ORDER, type Severity } from "./patterns";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Ecosystem =
  | "npm"
  | "PyPI"
  | "Go"
  | "RubyGems"
  | "crates.io"
  | "Packagist"
  | "Maven"
  | "NuGet";

export type Scope = "production" | "dev" | "unknown";

export interface Pkg {
  ecosystem: Ecosystem;
  name: string;
  version: string;
  scope: Scope;
  /** Only known for npm (from package.json). */
  direct?: boolean;
  /** Manifest files this package came from. */
  sources: string[];
}

export interface Manifest {
  path: string;
  /** What the file is, for the report. */
  label: string;
  /**
   * lockfile/pinned  - exact versions, can be checked
   * unresolved       - dependencies are declared but versions are not pinned (no lockfile), cannot be checked
   * unsupported      - an ecosystem this scanner does not understand
   */
  status: "checked" | "unresolved" | "unsupported";
  ecosystem?: Ecosystem;
  packages: Pkg[];
  /** For partially pinned files (requirements.txt): lines that could not be resolved. */
  unpinned?: number;
}

export interface Advisory {
  id: string;
  title: string;
  severity: Severity;
  fixedIn?: string;
}

export const pkgKey = (p: Pick<Pkg, "ecosystem" | "name" | "version">) =>
  `${p.ecosystem}|${p.name}|${p.version}`;

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i + 1);
}
function parseJson<T>(text: string | undefined): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
function dedupe(pkgs: Pkg[]): Pkg[] {
  const map = new Map<string, Pkg>();
  for (const p of pkgs) {
    const key = pkgKey(p);
    const prev = map.get(key);
    if (!prev) map.set(key, p);
    else if (p.scope === "production" || prev.scope === "unknown") prev.scope = p.scope;
  }
  return [...map.values()];
}

interface NpmLock {
  packages?: Record<string, { version?: string; dev?: boolean; link?: boolean }>;
  dependencies?: Record<string, { version?: string; dev?: boolean; dependencies?: NpmLock["dependencies"] }>;
}

function npmDirectNames(packageJson: string | undefined) {
  const pkg = parseJson<Record<string, Record<string, string> | undefined>>(packageJson);
  const prod = new Set(Object.keys({ ...pkg?.dependencies, ...pkg?.optionalDependencies }));
  const dev = new Set(Object.keys(pkg?.devDependencies ?? {}));
  return { prod, dev };
}

export function parsePackageLock(text: string, path: string, packageJson?: string): Pkg[] | null {
  const lock = parseJson<NpmLock>(text);
  if (!lock) return null;
  const { prod, dev } = npmDirectNames(packageJson);
  const out: Pkg[] = [];
  const add = (name: string, version: string | undefined, isDev: boolean) => {
    if (!version || !valid(version)) return;
    out.push({
      ecosystem: "npm",
      name,
      version,
      scope: isDev ? "dev" : "production",
      direct: packageJson ? prod.has(name) || dev.has(name) : undefined,
      sources: [path],
    });
  };

  if (lock.packages) {
    for (const [p, info] of Object.entries(lock.packages)) {
      if (!p || info.link) continue;
      const marker = "node_modules/";
      const idx = p.lastIndexOf(marker);
      if (idx === -1) continue; // workspace package itself
      add(p.slice(idx + marker.length), info.version, info.dev === true);
    }
  } else if (lock.dependencies) {
    const walk = (deps: NonNullable<NpmLock["dependencies"]>) => {
      for (const [name, entry] of Object.entries(deps)) {
        add(name, entry.version, entry.dev === true);
        if (entry.dependencies) walk(entry.dependencies);
      }
    };
    walk(lock.dependencies);
  }
  return dedupe(out);
}

export function parseYarnLock(text: string, path: string, packageJson?: string): Pkg[] {
  const { prod, dev } = npmDirectNames(packageJson);
  const out: Pkg[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i];
    if (!header || header.startsWith(" ") || header.startsWith("#") || !header.endsWith(":")) continue;
    if (header.startsWith("__metadata")) continue;
    const firstSpec = header.slice(0, -1).split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (firstSpec.includes("@workspace:")) continue;
    const at = firstSpec.lastIndexOf("@");
    if (at <= 0) continue;
    const name = firstSpec.slice(0, at);
    for (let j = i + 1; j < lines.length && lines[j].startsWith(" "); j++) {
      const m = /^\s+version:?\s+"?([^"\s]+)"?/.exec(lines[j]);
      if (m) {
        if (valid(m[1])) {
          const dev_ = dev.has(name) && !prod.has(name);
          out.push({
            ecosystem: "npm",
            name,
            version: m[1],
            scope: dev_ ? "dev" : prod.has(name) ? "production" : "unknown",
            direct: packageJson ? prod.has(name) || dev.has(name) : undefined,
            sources: [path],
          });
        }
        break;
      }
    }
  }
  return dedupe(out);
}

export function parsePnpmLock(text: string, path: string, packageJson?: string): Pkg[] {
  const { prod, dev } = npmDirectNames(packageJson);
  const out: Pkg[] = [];
  let inPackages = false;
  for (const line of text.split("\n")) {
    if (/^\S/.test(line)) {
      inPackages = line.startsWith("packages:");
      continue;
    }
    if (!inPackages) continue;
    // v6+/v9:  '/name@1.2.3(peer@1)':   or   'name@1.2.3':        v5:  /name/1.2.3:
    const m =
      /^ {2}['"]?\/?((?:@[^/@\s'"]+\/)?[^@/\s'"(]+)@(\d[^\s'"(:]*)/.exec(line) ??
      /^ {2}['"]?\/((?:@[^/\s'"]+\/)?[^/\s'"]+)\/(\d[^\s'":_]*)/.exec(line);
    if (!m || !valid(m[2])) continue;
    const name = m[1];
    out.push({
      ecosystem: "npm",
      name,
      version: m[2],
      scope: dev.has(name) && !prod.has(name) ? "dev" : prod.has(name) ? "production" : "unknown",
      direct: packageJson ? prod.has(name) || dev.has(name) : undefined,
      sources: [path],
    });
  }
  return dedupe(out);
}

export function parseRequirements(text: string, path: string): { pkgs: Pkg[]; unpinned: number } {
  const isDev = /(^|[-_/])(dev|test|tests|lint|ci|docs)([-_.]|\/|$)/i.test(path);
  const pkgs: Pkg[] = [];
  let unpinned = 0;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").replace(/^#.*$/, "").trim();
    if (!line || line.startsWith("-") || /^(https?|git\+|file:)/i.test(line)) continue;
    const pinned = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*===?\s*([0-9][A-Za-z0-9.!+_-]*)/.exec(line);
    if (pinned) {
      pkgs.push({
        ecosystem: "PyPI",
        name: pinned[1].toLowerCase().replace(/_/g, "-"),
        version: pinned[2],
        scope: isDev ? "dev" : "production",
        sources: [path],
      });
    } else if (/^[A-Za-z0-9][A-Za-z0-9._-]*/.test(line)) {
      unpinned++;
    }
  }
  return { pkgs, unpinned };
}

export function parsePipfileLock(text: string, path: string): Pkg[] | null {
  const lock = parseJson<Record<string, Record<string, { version?: string }> | undefined>>(text);
  if (!lock) return null;
  const out: Pkg[] = [];
  for (const [section, scope] of [["default", "production"], ["develop", "dev"]] as const) {
    for (const [name, info] of Object.entries(lock[section] ?? {})) {
      const v = info.version?.replace(/^===?/, "");
      if (v && /^[0-9]/.test(v)) {
        out.push({ ecosystem: "PyPI", name: name.toLowerCase().replace(/_/g, "-"), version: v, scope, sources: [path] });
      }
    }
  }
  return dedupe(out);
}

/** poetry.lock and uv.lock share the [[package]] layout. */
export function parseTomlPackages(text: string, path: string, ecosystem: Ecosystem): Pkg[] {
  const out: Pkg[] = [];
  for (const block of text.split(/^\[\[package\]\]\s*$/m).slice(1)) {
    const head = block.split(/^\[/m)[0];
    const name = /^name\s*=\s*"([^"]+)"/m.exec(head)?.[1];
    const version = /^version\s*=\s*"([^"]+)"/m.exec(head)?.[1];
    if (!name || !version) continue;
    const source = /^source\s*=\s*(.*)$/m.exec(head)?.[1] ?? "";
    if (/(virtual|editable|directory|path)\s*=/.test(source)) continue; // the project itself / local path
    if (ecosystem === "crates.io" && !/registry\+/.test(source)) continue;
    const category = /^category\s*=\s*"([^"]+)"/m.exec(head)?.[1];
    out.push({
      ecosystem,
      name: ecosystem === "PyPI" ? name.toLowerCase().replace(/_/g, "-") : name,
      version,
      scope: category === "dev" ? "dev" : category === "main" ? "production" : "unknown",
      sources: [path],
    });
  }
  return dedupe(out);
}

export function parseGoMod(text: string, path: string): Pkg[] {
  const out: Pkg[] = [];
  let inRequire = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("require (")) { inRequire = true; continue; }
    if (inRequire && line.startsWith(")")) { inRequire = false; continue; }
    const m = inRequire
      ? /^(\S+)\s+(v\d\S*?)(?:\s*\/\/\s*(indirect))?$/.exec(line)
      : /^require\s+(\S+)\s+(v\d\S*?)(?:\s*\/\/\s*(indirect))?$/.exec(line);
    if (!m) continue;
    out.push({
      ecosystem: "Go",
      name: m[1],
      version: m[2].replace(/^v/, "").replace(/\+incompatible$/, ""),
      scope: "production",
      direct: !m[3],
      sources: [path],
    });
  }
  return dedupe(out);
}

export function parseGemfileLock(text: string, path: string): Pkg[] {
  const out: Pkg[] = [];
  let section = "";
  for (const line of text.split("\n")) {
    if (/^[A-Z]/.test(line)) { section = line.trim(); continue; }
    if (section !== "GEM") continue;
    const m = /^ {4}([A-Za-z0-9_.-]+) \((\d[0-9A-Za-z.]*)(?:-[^)]*)?\)\s*$/.exec(line);
    if (m) out.push({ ecosystem: "RubyGems", name: m[1], version: m[2], scope: "unknown", sources: [path] });
  }
  return dedupe(out);
}

export function parseComposerLock(text: string, path: string): Pkg[] | null {
  const lock = parseJson<Record<string, Array<{ name?: string; version?: string }> | undefined>>(text);
  if (!lock) return null;
  const out: Pkg[] = [];
  for (const [key, scope] of [["packages", "production"], ["packages-dev", "dev"]] as const) {
    for (const p of lock[key] ?? []) {
      const v = p.version?.replace(/^v/, "");
      if (p.name && v && /^\d/.test(v)) out.push({ ecosystem: "Packagist", name: p.name, version: v, scope, sources: [path] });
    }
  }
  return dedupe(out);
}

export function parsePom(text: string, path: string): { pkgs: Pkg[]; unresolved: number } {
  const props = new Map<string, string>();
  for (const m of text.matchAll(/<properties>([\s\S]*?)<\/properties>/g)) {
    for (const p of m[1].matchAll(/<([A-Za-z0-9_.-]+)>([^<]+)<\/\1>/g)) props.set(p[1], p[2].trim());
  }
  const resolve = (v: string) => v.replace(/\$\{([^}]+)\}/g, (_, k: string) => props.get(k) ?? "${" + k + "}").trim();

  const pkgs: Pkg[] = [];
  let unresolved = 0;
  const body = text.replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/g, "");
  for (const m of body.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const g = /<groupId>([^<]+)<\/groupId>/.exec(m[1])?.[1]?.trim();
    const a = /<artifactId>([^<]+)<\/artifactId>/.exec(m[1])?.[1]?.trim();
    const vRaw = /<version>([^<]+)<\/version>/.exec(m[1])?.[1];
    const scope = /<scope>([^<]+)<\/scope>/.exec(m[1])?.[1]?.trim();
    if (!g || !a) continue;
    const v = vRaw ? resolve(vRaw) : "";
    if (!v || /\$\{|[[(,]/.test(v)) { unresolved++; continue; }
    pkgs.push({
      ecosystem: "Maven",
      name: `${g}:${a}`,
      version: v,
      scope: scope === "test" ? "dev" : "production",
      sources: [path],
    });
  }
  return { pkgs: dedupe(pkgs), unresolved };
}

export function parseGradle(text: string, path: string): Pkg[] {
  const out: Pkg[] = [];
  const re =
    /\b(implementation|api|compile|compileOnly|runtimeOnly|runtime|annotationProcessor|testImplementation|testCompile|testRuntimeOnly|testCompileOnly)\s*\(?\s*["']([\w.-]+):([\w.-]+):([\w.+-]+)["']/g;
  for (const m of text.matchAll(re)) {
    out.push({
      ecosystem: "Maven",
      name: `${m[2]}:${m[3]}`,
      version: m[4],
      scope: m[1].startsWith("test") ? "dev" : "production",
      sources: [path],
    });
  }
  return dedupe(out);
}

export function parseCsproj(text: string, path: string): Pkg[] {
  const out: Pkg[] = [];
  for (const m of text.matchAll(/<PackageReference\s+[^>]*Include="([^"]+)"[^>]*Version="(\d[^"*\[\],]*)"/g)) {
    out.push({ ecosystem: "NuGet", name: m[1], version: m[2], scope: "production", sources: [path] });
  }
  return dedupe(out);
}

/* ------------------------------------------------------------------ */
/* Manifest discovery                                                  */
/* ------------------------------------------------------------------ */

const NPM_LOCKS = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"];
const UNSUPPORTED = new Set([
  "pubspec.yaml", "pubspec.lock", "mix.exs", "mix.lock", "Podfile", "Podfile.lock",
  "Package.swift", "Package.resolved", "build.sbt", "deps.edn", "project.clj", "conanfile.txt", "vcpkg.json",
]);
const IN_TEST_DIR = /(^|\/)(tests?|__tests__|fixtures?|examples?|samples?|testdata)\//i;

/** File names the scanner needs the full text of, beyond source files. */
export function isDependencyFile(path: string): boolean {
  const b = basename(path);
  return (
    NPM_LOCKS.includes(b) ||
    ["package.json", "Pipfile", "Pipfile.lock", "poetry.lock", "uv.lock", "pyproject.toml", "go.mod", "Gemfile", "Gemfile.lock",
      "Cargo.toml", "Cargo.lock", "composer.json", "composer.lock", "pom.xml", "build.gradle", "build.gradle.kts"].includes(b) ||
    /^requirements.*\.txt$/i.test(b) ||
    /\.csproj$/i.test(b) ||
    UNSUPPORTED.has(b)
  );
}

export function discoverManifests(files: Map<string, string>): { manifests: Manifest[]; ignoredInTests: number } {
  const manifests: Manifest[] = [];
  let ignoredInTests = 0;
  const has = (dir: string, names: string[]) => names.some((n) => files.has(dir + n));

  for (const [path, text] of files) {
    const b = basename(path);
    if (!isDependencyFile(path)) continue;
    if (IN_TEST_DIR.test(path)) { ignoredInTests++; continue; }
    const dir = dirname(path);
    const pkgJson = files.get(dir + "package.json");

    const checked = (label: string, pkgs: Pkg[] | null, ecosystem: Ecosystem, extra: Partial<Manifest> = {}) => {
      if (pkgs === null) manifests.push({ path, label, status: "unresolved", ecosystem, packages: [], ...extra });
      else manifests.push({ path, label, status: "checked", ecosystem, packages: pkgs, ...extra });
    };
    const unresolved = (label: string, ecosystem?: Ecosystem) =>
      manifests.push({ path, label, status: "unresolved", ecosystem, packages: [] });

    switch (true) {
      case b === "package-lock.json" || b === "npm-shrinkwrap.json":
        checked("npm lockfile", parsePackageLock(text, path, pkgJson), "npm");
        break;
      case b === "yarn.lock":
        checked("Yarn lockfile", parseYarnLock(text, path, pkgJson), "npm");
        break;
      case b === "pnpm-lock.yaml":
        checked("pnpm lockfile", parsePnpmLock(text, path, pkgJson), "npm");
        break;
      case b === "package.json":
        if (!has(dir, NPM_LOCKS) && /"(dependencies|devDependencies)"\s*:\s*\{\s*"/.test(text)) {
          unresolved("package.json without a lockfile", "npm");
        }
        break;
      case /^requirements.*\.txt$/i.test(b): {
        const { pkgs, unpinned } = parseRequirements(text, path);
        if (pkgs.length === 0 && unpinned === 0) break;
        manifests.push({
          path,
          label: "requirements file",
          status: pkgs.length > 0 ? "checked" : "unresolved",
          ecosystem: "PyPI",
          packages: pkgs,
          unpinned,
        });
        break;
      }
      case b === "Pipfile.lock":
        checked("Pipfile.lock", parsePipfileLock(text, path), "PyPI");
        break;
      case b === "poetry.lock":
        checked("poetry.lock", parseTomlPackages(text, path, "PyPI"), "PyPI");
        break;
      case b === "uv.lock":
        checked("uv.lock", parseTomlPackages(text, path, "PyPI"), "PyPI");
        break;
      case b === "Pipfile":
        if (!has(dir, ["Pipfile.lock"])) unresolved("Pipfile without a lockfile", "PyPI");
        break;
      case b === "pyproject.toml":
        if (!has(dir, ["poetry.lock", "uv.lock", "Pipfile.lock"]) && !files.has(dir + "requirements.txt") && /^dependencies\s*=|\[tool\.poetry\.dependencies\]/m.test(text)) {
          unresolved("pyproject.toml without a lockfile", "PyPI");
        }
        break;
      case b === "go.mod":
        checked("go.mod", parseGoMod(text, path), "Go");
        break;
      case b === "Gemfile.lock":
        checked("Gemfile.lock", parseGemfileLock(text, path), "RubyGems");
        break;
      case b === "Gemfile":
        if (!has(dir, ["Gemfile.lock"]) && /^\s*gem\s+['"]/m.test(text)) unresolved("Gemfile without a lockfile", "RubyGems");
        break;
      case b === "Cargo.lock":
        checked("Cargo.lock", parseTomlPackages(text, path, "crates.io"), "crates.io");
        break;
      case b === "Cargo.toml":
        if (!has(dir, ["Cargo.lock"]) && /^\[dependencies\]/m.test(text)) unresolved("Cargo.toml without a lockfile", "crates.io");
        break;
      case b === "composer.lock":
        checked("composer.lock", parseComposerLock(text, path), "Packagist");
        break;
      case b === "composer.json":
        if (!has(dir, ["composer.lock"]) && /"require"\s*:\s*\{\s*"/.test(text)) unresolved("composer.json without a lockfile", "Packagist");
        break;
      case b === "pom.xml": {
        const { pkgs, unresolved: n } = parsePom(text, path);
        manifests.push({
          path,
          label: "Maven pom.xml",
          status: pkgs.length > 0 ? "checked" : n > 0 ? "unresolved" : "checked",
          ecosystem: "Maven",
          packages: pkgs,
          unpinned: n,
        });
        break;
      }
      case b === "build.gradle" || b === "build.gradle.kts": {
        const pkgs = parseGradle(text, path);
        manifests.push({ path, label: "Gradle build", status: "checked", ecosystem: "Maven", packages: pkgs });
        break;
      }
      case /\.csproj$/i.test(b):
        checked(".NET project", parseCsproj(text, path), "NuGet");
        break;
      case UNSUPPORTED.has(b):
        manifests.push({ path, label: b, status: "unsupported", packages: [] });
        break;
    }
  }
  return { manifests, ignoredInTests };
}

/* ------------------------------------------------------------------ */
/* Advisory lookup                                                     */
/* ------------------------------------------------------------------ */

export interface LookupResult {
  advisories: Map<string, Advisory[]>;
  /** Package keys that could not be looked up (network error, timeout). */
  failed: Set<string>;
  notes: string[];
}

function bySeverityDesc(a: Advisory, b: Advisory) {
  return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
}

function npmSeverity(raw: string | undefined): Severity {
  switch (raw) {
    case "critical": return "critical";
    case "high": return "high";
    case "moderate":
    case "medium": return "medium";
    default: return "low";
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function lookupNpm(pkgs: Pkg[], result: LookupResult) {
  const versionsByName = new Map<string, Set<string>>();
  for (const p of pkgs) {
    if (!versionsByName.has(p.name)) versionsByName.set(p.name, new Set());
    versionsByName.get(p.name)!.add(p.version);
  }

  await Promise.all(
    chunk([...versionsByName.keys()], 250).map(async (names) => {
      const body: Record<string, string[]> = {};
      for (const n of names) body[n] = [...versionsByName.get(n)!];
      try {
        const res = await fetch(endpoints.npmAdvisories, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(limits.fetchTimeoutMs),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Record<
          string,
          Array<{ id: number | string; title?: string; severity?: string; vulnerable_versions?: string }>
        >;
        for (const p of pkgs) {
          if (!names.includes(p.name)) continue;
          const seen = new Set<string>();
          const hits: Advisory[] = [];
          for (const a of data[p.name] ?? []) {
            if (!a.vulnerable_versions || seen.has(String(a.id))) continue;
            if (!satisfies(p.version, a.vulnerable_versions, { includePrerelease: true })) continue;
            seen.add(String(a.id));
            hits.push({ id: String(a.id), title: a.title ?? "Security advisory", severity: npmSeverity(a.severity) });
          }
          if (hits.length) result.advisories.set(pkgKey(p), hits.sort(bySeverityDesc));
        }
      } catch (err) {
        for (const p of pkgs) if (names.includes(p.name)) result.failed.add(pkgKey(p));
        result.notes.push(`npm advisory lookup failed for ${names.length} packages (${err instanceof Error ? err.message : "error"}).`);
      }
    })
  );
}

/* --- OSV (everything that is not npm) ------------------------------ */

const CVSS3 = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
} as const;

/** CVSS v3.x base score from a vector string; null if it can't be parsed. */
export function cvss3Score(vector: string): number | null {
  if (!/^CVSS:3\.[01]\//.test(vector)) return null;
  const m = Object.fromEntries(vector.split("/").slice(1).map((kv) => kv.split(":") as [string, string]));
  const changed = m.S === "C";
  const av = CVSS3.AV[m.AV as keyof typeof CVSS3.AV];
  const ac = CVSS3.AC[m.AC as keyof typeof CVSS3.AC];
  const ui = CVSS3.UI[m.UI as keyof typeof CVSS3.UI];
  const prTable = changed ? { N: 0.85, L: 0.68, H: 0.5 } : { N: 0.85, L: 0.62, H: 0.27 };
  const pr = prTable[m.PR as keyof typeof prTable];
  const c = CVSS3.CIA[m.C as keyof typeof CVSS3.CIA];
  const i = CVSS3.CIA[m.I as keyof typeof CVSS3.CIA];
  const a = CVSS3.CIA[m.A as keyof typeof CVSS3.CIA];
  if ([av, ac, ui, pr, c, i, a].some((x) => x === undefined)) return null;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const exploit = 8.22 * av * ac * pr * ui;
  if (impact <= 0) return 0;
  const raw = changed ? Math.min(1.08 * (impact + exploit), 10) : Math.min(impact + exploit, 10);
  return Math.ceil(raw * 10 - 1e-9) / 10;
}

function severityFromScore(score: number): Severity {
  return score >= 9 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : "low";
}

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  withdrawn?: string;
  severity?: Array<{ type: string; score: string }>;
  database_specific?: { severity?: string };
  affected?: Array<{
    package?: { name?: string; ecosystem?: string };
    ranges?: Array<{ events?: Array<{ fixed?: string }> }>;
  }>;
}

export function osvToAdvisory(v: OsvVuln, pkgName: string): Advisory {
  let severity: Severity | null = null;
  const dbSev = v.database_specific?.severity?.toLowerCase();
  if (dbSev) severity = npmSeverity(dbSev);
  if (!severity) {
    for (const s of v.severity ?? []) {
      const score = s.type === "CVSS_V3" ? cvss3Score(s.score) : null;
      if (score !== null) { severity = severityFromScore(score); break; }
    }
  }
  const fixed = v.affected
    ?.filter((a) => !a.package?.name || a.package.name === pkgName)
    .flatMap((a) => a.ranges ?? [])
    .flatMap((r) => r.events ?? [])
    .map((e) => e.fixed)
    .find(Boolean);
  const title = v.summary?.trim() || v.details?.split("\n")[0]?.trim().slice(0, 140) || v.id;
  return { id: v.id, title, severity: severity ?? "medium", fixedIn: fixed };
}

async function lookupOsv(pkgs: Pkg[], result: LookupResult, deadline: number) {
  const hits = new Map<string, string[]>(); // pkgKey -> vuln ids
  for (const batch of chunk(pkgs, 500)) {
    try {
      const res = await fetch(`${endpoints.osv}/v1/querybatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: batch.map((p) => ({ package: { name: p.name, ecosystem: p.ecosystem }, version: p.version })),
        }),
        signal: AbortSignal.timeout(limits.fetchTimeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results?: Array<{ vulns?: Array<{ id: string }> }> };
      batch.forEach((p, i) => {
        const ids = data.results?.[i]?.vulns?.map((v) => v.id) ?? [];
        if (ids.length) hits.set(pkgKey(p), ids);
      });
    } catch (err) {
      for (const p of batch) result.failed.add(pkgKey(p));
      result.notes.push(`OSV lookup failed for ${batch.length} packages (${err instanceof Error ? err.message : "error"}).`);
    }
  }
  if (hits.size === 0) return;

  const details = new Map<string, OsvVuln | null>();
  const ids = [...new Set([...hits.values()].flat())];
  let cursor = 0;
  let skipped = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        if (Date.now() > deadline) { skipped++; details.set(id, null); continue; }
        try {
          const res = await fetch(`${endpoints.osv}/v1/vulns/${encodeURIComponent(id)}`, {
            signal: AbortSignal.timeout(15_000),
          });
          details.set(id, res.ok ? ((await res.json()) as OsvVuln) : null);
        } catch {
          details.set(id, null);
        }
      }
    })
  );
  const missing = [...details.values()].filter((d) => d === null).length;
  if (missing) {
    result.notes.push(`${missing} advisory details could not be fetched (${skipped} skipped for time); their severity is estimated as medium.`);
  }

  const byKey = new Map(pkgs.map((p) => [pkgKey(p), p]));
  for (const [key, vulnIds] of hits) {
    const p = byKey.get(key)!;
    const advisories: Advisory[] = [];
    const covered = new Set<string>();
    for (const id of vulnIds) {
      const d = details.get(id);
      if (d?.withdrawn) continue;
      if (covered.has(id)) continue;
      covered.add(id);
      for (const alias of d?.aliases ?? []) covered.add(alias);
      advisories.push(d ? osvToAdvisory(d, p.name) : { id, title: id, severity: "medium" });
    }
    // An advisory and its CVE/GHSA alias appear as two ids: keep one.
    const unique = advisories.filter((a, idx) => {
      const d = details.get(a.id);
      return !advisories.slice(0, idx).some((b) => details.get(b.id)?.aliases?.includes(a.id) || d?.aliases?.includes(b.id));
    });
    if (unique.length) result.advisories.set(key, unique.sort(bySeverityDesc));
  }
}

export async function lookupAdvisories(pkgs: Pkg[], deadline: number): Promise<LookupResult> {
  const result: LookupResult = { advisories: new Map(), failed: new Set(), notes: [] };
  const npm = pkgs.filter((p) => p.ecosystem === "npm");
  const other = pkgs.filter((p) => p.ecosystem !== "npm");
  await Promise.all([npm.length ? lookupNpm(npm, result) : null, other.length ? lookupOsv(other, result, deadline) : null]);
  return result;
}