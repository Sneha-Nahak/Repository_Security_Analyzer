import { createHash } from "node:crypto";
import { limits } from "./config";
import {
  discoverManifests,
  isDependencyFile,
  lookupAdvisories,
  pkgKey,
  type Advisory,
  type Ecosystem,
  type Manifest,
  type Pkg,
  type Scope,
} from "./deps";
import {
  ADVISORY_BUMP,
  CONFIDENT_THRESHOLD,
  COVERAGE_WEIGHTS,
  DEV_MULTIPLIER,
  GRADES,
  RISK_SCALE,
  SCORE_CAPS,
  SECRET_RULES,
  SEVERITY_ORDER,
  SEVERITY_WEIGHT,
  type Severity,
} from "./patterns";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SeverityCounts = Record<Severity, number>;

export interface Location {
  file: string;
  line: number;
}

export interface Finding {
  category: "secret" | "dependency";
  type: string;
  severity: Severity;
  /** What the score uses: severity weight x confidence/exposure. */
  weight: number;
  description: string;
  /** First location; `occurrences` is the total count. */
  file: string;
  line: number;
  occurrences: number;
  locations: Location[];
  // secrets
  match?: string;
  confidence?: number;
  // dependencies
  ecosystem?: Ecosystem;
  package?: string;
  version?: string;
  scope?: Scope;
  direct?: boolean;
  advisories?: Advisory[];
}

export interface Check {
  name: string;
  status: "ok" | "partial" | "skipped" | "failed";
  detail: string;
}

export interface ScanResult {
  /** 0-100. Higher is safer. */
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  /** Why the score was capped, if it was. */
  capReason?: string;
  /** 0-100: how much of what applies to this repo was actually checked. */
  coverage: number;
  /** True when coverage < 100, so the score should be read as "at least this risky". */
  provisional: boolean;
  risk: number;
  findings: Finding[];
  checks: Check[];
  notes: string[];
  summary: {
    secrets: SeverityCounts;
    dependencies: { production: SeverityCounts; dev: SeverityCounts };
    packagesChecked: number;
    vulnerablePackages: number;
    /** Share of checked packages with no known vulnerability. */
    cleanPackagesPct: number | null;
    filesScanned: number;
    ecosystems: Ecosystem[];
  };
}

/* ------------------------------------------------------------------ */
/* Which files to read                                                 */
/* ------------------------------------------------------------------ */

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage", "vendor", ".venv", "venv", "__pycache__", "target", ".gradle",
]);

const SOURCE_EXT =
  /\.(js|jsx|ts|tsx|mjs|cjs|py|java|kt|cs|go|rb|php|cpp|c|h|rs|swift|sh|bash|ps1|json|ya?ml|toml|ini|cfg|conf|properties|tf|xml|gradle|env)$/i;
/** Prose-like files: only the unmistakable secret formats are checked. */
const PROSE_EXT = /\.(md|txt|ipynb|html?)$/i;
const KEY_FILE = /\.(pem|key|p12|pfx)$|^id_(rsa|dsa|ecdsa|ed25519)$|^\.npmrc$|^\.pypirc$|^\.netrc$/i;
const ENV_FILE = /^\.env(\..+)?$|\.env$/i;
const ENV_TEMPLATE = /\.(example|sample|template|dist|defaults?)$/i;
const SKIP_FILE = /(\.min\.(js|css)|\.map|\.lock|\.svg|-lock\.json|pnpm-lock\.yaml|npm-shrinkwrap\.json)$/i;
const TEST_PATH = /(^|\/)(tests?|__tests__|fixtures?|mocks?|examples?|samples?|testdata|docs?)\/|\.(test|spec)\.[a-z]+$/i;

const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);

export function wantFile(path: string, size: number): boolean {
  if (path.split("/").some((s) => IGNORE_DIRS.has(s))) return false;
  const base = basename(path);
  if (isDependencyFile(path)) return size <= limits.maxLockfileBytes;
  if (SKIP_FILE.test(base) || size > limits.maxFileBytes) return false;
  return ENV_FILE.test(base) || KEY_FILE.test(base) || SOURCE_EXT.test(base) || PROSE_EXT.test(base);
}

/* ------------------------------------------------------------------ */
/* Secrets                                                             */
/* ------------------------------------------------------------------ */

function entropy(s: string): number {
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const PLACEHOLDER =
  /^(?:x{3,}|\*{3,}|\.{3,}|<.*>|\$\{.*\}|\{\{.*\}\}|%.*%|your[-_ ]?.*|change[-_ ]?me.*|replace[-_ ]?me.*|insert.*|enter.*|example.*|sample.*|dummy.*|fake.*|test.*|todo.*|none|null|undefined|secret|password|token|redacted.*)$/i;

function isPlaceholder(value: string): boolean {
  return (
    PLACEHOLDER.test(value) ||
    /(example|placeholder|your_|yourkey|changeme)/i.test(value) ||
    /^(.)\1+$/.test(value) ||
    /process\.env|import\.meta|os\.environ|getenv|\$\(|`/.test(value)
  );
}

/** Shows the first four characters only. The rest never leaves the scanner. */
function mask(value: string): string {
  return `${value.slice(0, 4)}… (${value.length} chars)`;
}

interface SecretHit {
  ruleId: string;
  label: string;
  severity: Severity;
  confidence: number;
  note?: string;
  valueKey: string;
  masked: string;
  loc: Location;
}

export function scanSecrets(files: Map<string, string>): Finding[] {
  const grouped = new Map<string, Finding>();

  for (const [path, content] of files) {
    const base = basename(path);
    if (SKIP_FILE.test(base) || (isDependencyFile(path) && !ENV_FILE.test(base))) continue;

    const isEnv = ENV_FILE.test(base);
    const isTemplate = isEnv && ENV_TEMPLATE.test(base);
    const prose = PROSE_EXT.test(base);
    const inTests = TEST_PATH.test(path);

    if (isEnv && !isTemplate) {
      const key = `committed-env:${path}`;
      grouped.set(key, {
        category: "secret",
        type: "Committed environment file",
        severity: inTests ? "low" : "medium",
        weight: SEVERITY_WEIGHT[inTests ? "low" : "medium"],
        description: `${path} is committed to the repository. Environment files usually hold secrets; add it to .gitignore and rotate anything inside.`,
        file: path,
        line: 0,
        occurrences: 1,
        locations: [{ file: path, line: 0 }],
        confidence: 1,
      });
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > limits.maxLineLength) continue;

      for (const rule of SECRET_RULES) {
        if (rule.envOnly && !isEnv) continue;
        if ((prose || isTemplate) && rule.confidence < 0.9) continue;

        for (const m of line.matchAll(rule.regex)) {
          const value = rule.valueGroup ? m[rule.valueGroup] : m[0];
          if (!value) continue;
          if (rule.valueGroup && isPlaceholder(value)) continue;
          if (rule.minEntropy && entropy(value) < rule.minEntropy) continue;

          let confidence = rule.confidence;
          if (rule.weakIf?.test(m[0])) confidence *= 0.3;
          if (inTests) confidence *= 0.3;
          if (isTemplate || prose) confidence *= 0.5;
          if (confidence <= 0) continue;

          const hit: SecretHit = {
            ruleId: rule.id,
            label: rule.label,
            severity: rule.severity,
            confidence: Math.round(confidence * 100) / 100,
            note: rule.note,
            valueKey: createHash("sha1").update(value).digest("hex").slice(0, 16),
            masked: mask(m[0]),
            loc: { file: path, line: i + 1 },
          };

          const key = `${hit.ruleId}:${hit.valueKey}`;
          const existing = grouped.get(key);
          if (existing) {
            existing.occurrences++;
            if (existing.locations.length < 5) existing.locations.push(hit.loc);
            existing.confidence = Math.max(existing.confidence ?? 0, hit.confidence);
            existing.weight = SEVERITY_WEIGHT[existing.severity] * (existing.confidence ?? 1);
          } else {
            grouped.set(key, {
              category: "secret",
              type: hit.label,
              severity: hit.severity,
              weight: SEVERITY_WEIGHT[hit.severity] * hit.confidence,
              description:
                (hit.confidence >= CONFIDENT_THRESHOLD
                  ? "Looks like a real credential committed to the repository."
                  : "Possible credential; the format is generic or the file looks like a test/example.") +
                (hit.note ? ` ${hit.note}` : ""),
              file: hit.loc.file,
              line: hit.loc.line,
              occurrences: 1,
              locations: [hit.loc],
              match: hit.masked,
              confidence: hit.confidence,
            });
          }
        }
      }
    }
  }
  return [...grouped.values()];
}

/* ------------------------------------------------------------------ */
/* Dependencies                                                        */
/* ------------------------------------------------------------------ */

function advisoryMultiplier(count: number): number {
  return 1 + Math.min((count - 1) * ADVISORY_BUMP.perAdvisory, ADVISORY_BUMP.max);
}

interface DepAnalysis {
  findings: Finding[];
  packagesChecked: number;
  vulnerablePackages: number;
  ecosystems: Ecosystem[];
  check: Check;
  /** 0..1 share of dependency manifests that were fully checked. */
  coverage: number | null;
  notes: string[];
}

async function analyzeDependencies(files: Map<string, string>, deadline: number): Promise<DepAnalysis> {
  const { manifests, ignoredInTests } = discoverManifests(files);
  const notes: string[] = [];
  if (ignoredInTests > 0) {
    notes.push(`${ignoredInTests} dependency file(s) inside test/example/fixture folders were ignored.`);
  }

  if (manifests.length === 0) {
    return {
      findings: [], packagesChecked: 0, vulnerablePackages: 0, ecosystems: [], coverage: null, notes,
      check: { name: "Dependencies", status: "skipped", detail: "No dependency files found, nothing to check." },
    };
  }

  // Merge packages across manifests (monorepos often repeat them).
  const merged = new Map<string, Pkg>();
  for (const m of manifests) {
    for (const p of m.packages) {
      const k = pkgKey(p);
      const prev = merged.get(k);
      if (!prev) merged.set(k, { ...p, sources: [...p.sources] });
      else {
        prev.sources.push(...p.sources.filter((s) => !prev.sources.includes(s)));
        if (p.scope === "production" || (prev.scope === "unknown" && p.scope === "dev")) prev.scope = p.scope;
      }
    }
  }
  const pkgs = [...merged.values()];
  const lookup = pkgs.length ? await lookupAdvisories(pkgs, deadline) : { advisories: new Map<string, Advisory[]>(), failed: new Set<string>(), notes: [] as string[] };
  notes.push(...lookup.notes);

  const findings: Finding[] = [];
  for (const p of pkgs) {
    const adv = lookup.advisories.get(pkgKey(p));
    if (!adv?.length) continue;
    const top = adv[0];
    const exposure = p.scope === "dev" ? DEV_MULTIPLIER : 1;
    const shown = adv.slice(0, 3).map((a) => `${a.title}${a.fixedIn ? ` (fixed in ${a.fixedIn})` : ""}`).join("; ");
    const more = adv.length > 3 ? ` (+${adv.length - 3} more)` : "";
    findings.push({
      category: "dependency",
      type: "Vulnerable dependency",
      severity: top.severity,
      weight: SEVERITY_WEIGHT[top.severity] * advisoryMultiplier(adv.length) * exposure,
      description: `${p.name}@${p.version} [${p.ecosystem}, ${p.scope === "unknown" ? "scope unknown" : p.scope === "dev" ? "dev-only" : "production"}${p.direct === undefined ? "" : p.direct ? ", direct" : ", transitive"}]: ${adv.length} advisor${adv.length === 1 ? "y" : "ies"}. ${shown}${more}`,
      file: p.sources[0],
      line: 0,
      occurrences: p.sources.length,
      locations: p.sources.slice(0, 5).map((file) => ({ file, line: 0 })),
      ecosystem: p.ecosystem,
      package: p.name,
      version: p.version,
      scope: p.scope,
      direct: p.direct,
      advisories: adv,
    });
  }

  // Coverage: each manifest counts once; unpinned/unsupported ones count as unchecked.
  let score = 0;
  const problems: string[] = [];
  for (const m of manifests) {
    if (m.status === "checked") {
      const failed = m.packages.filter((p) => lookup.failed.has(pkgKey(p))).length;
      const total = m.packages.length + (m.unpinned ?? 0);
      const resolvedShare = total === 0 ? 1 : (m.packages.length - failed) / total;
      score += resolvedShare;
      if ((m.unpinned ?? 0) > 0) problems.push(`${m.path}: ${m.unpinned} entr${m.unpinned === 1 ? "y has" : "ies have"} no pinned version and could not be checked.`);
      if (failed > 0) problems.push(`${m.path}: lookup failed for ${failed} package(s).`);
    } else if (m.status === "unresolved") {
      problems.push(`${m.path}: ${m.label}. Versions are not pinned, so vulnerabilities cannot be matched. Commit a lockfile to enable this check.`);
    } else {
      problems.push(`${m.path}: ${m.label} is not supported yet; its dependencies were not checked.`);
    }
  }
  const coverage = score / manifests.length;
  notes.push(...problems);

  const ecosystems = [...new Set(pkgs.map((p) => p.ecosystem))];
  const detail = `${pkgs.length} packages across ${manifests.filter((m) => m.status === "checked").length} lockfile/manifest(s) (${ecosystems.join(", ") || "none"}); ${findings.length} vulnerable.`;
  return {
    findings,
    packagesChecked: pkgs.length,
    vulnerablePackages: findings.length,
    ecosystems,
    coverage,
    notes,
    check: { name: "Dependencies", status: coverage >= 0.999 ? "ok" : coverage > 0 ? "partial" : "failed", detail },
  };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

const zeroCounts = (): SeverityCounts => ({ critical: 0, high: 0, medium: 0, low: 0 });

export function gradeFor(score: number): ScanResult["grade"] {
  return GRADES.find((g) => score >= g.min)!.grade;
}

export function computeScore(findings: Finding[]): { score: number; risk: number; capReason?: string } {
  const risk = findings.reduce((sum, f) => sum + f.weight, 0);
  let score = 100 * Math.exp(-risk / RISK_SCALE);

  const caps: Array<[number, string]> = [];
  const confident = (f: Finding) => (f.confidence ?? 1) >= CONFIDENT_THRESHOLD;
  if (findings.some((f) => f.category === "secret" && f.severity === "critical" && confident(f))) {
    caps.push([SCORE_CAPS.confidentCriticalSecret, "a critical secret is exposed in the repository"]);
  }
  if (findings.some((f) => f.category === "secret" && f.severity === "high" && confident(f))) {
    caps.push([SCORE_CAPS.confidentHighSecret, "a credential is exposed in the repository"]);
  }
  if (findings.some((f) => f.category === "dependency" && f.scope !== "dev" && f.severity === "critical")) {
    caps.push([SCORE_CAPS.criticalProductionVuln, "a production dependency has a critical vulnerability"]);
  }
  if (findings.some((f) => f.category === "dependency" && f.scope !== "dev" && f.severity === "high")) {
    caps.push([SCORE_CAPS.highProductionVuln, "a production dependency has a high-severity vulnerability"]);
  }

  let capReason: string | undefined;
  for (const [cap, reason] of caps) {
    if (cap < score) { score = cap; capReason = reason; }
  }
  return { score: Math.round(score), risk: Math.round(risk * 10) / 10, capReason };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function performScan(
  files: Map<string, string>,
  options: { truncated?: boolean; deadline?: number } = {}
): Promise<ScanResult> {
  const deadline = options.deadline ?? Date.now() + limits.advisoryBudgetMs;
  const notes: string[] = [];
  const checks: Check[] = [];

  const secrets = scanSecrets(files);
  checks.push({
    name: "Secrets",
    status: options.truncated ? "partial" : "ok",
    detail: `${files.size} files read; ${secrets.length} finding(s).${options.truncated ? " The repository exceeded the in-memory limit, so some files were skipped." : ""}`,
  });
  if (options.truncated) notes.push("The repository exceeded the in-memory limit; some files were not scanned.");
  notes.push("Only the latest snapshot is scanned. Secrets that were committed and later deleted remain in git history and are not detected.");

  const deps = await analyzeDependencies(files, deadline);
  checks.push(deps.check);
  notes.push(...deps.notes);

  const findings = [...secrets, ...deps.findings].sort(
    (a, b) => b.weight - a.weight || SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
  );
  const { score, risk, capReason } = computeScore(findings);

  // Coverage: weighted average of the checks that apply to this repo.
  const parts: Array<[number, number]> = [[COVERAGE_WEIGHTS.secrets, options.truncated ? 0.5 : 1]];
  if (deps.coverage !== null) parts.push([COVERAGE_WEIGHTS.dependencies, deps.coverage]);
  const totalWeight = parts.reduce((s, [w]) => s + w, 0);
  const coverage = Math.round((parts.reduce((s, [w, c]) => s + w * c, 0) / totalWeight) * 100);

  const secretCounts = zeroCounts();
  for (const f of secrets) secretCounts[f.severity]++;
  const prod = zeroCounts();
  const dev = zeroCounts();
  for (const f of deps.findings) (f.scope === "dev" ? dev : prod)[f.severity]++;

  return {
    score,
    grade: gradeFor(score),
    capReason,
    coverage,
    provisional: coverage < 100,
    risk,
    findings,
    checks,
    notes,
    summary: {
      secrets: secretCounts,
      dependencies: { production: prod, dev },
      packagesChecked: deps.packagesChecked,
      vulnerablePackages: deps.vulnerablePackages,
      cleanPackagesPct:
        deps.packagesChecked > 0
          ? Math.round(((deps.packagesChecked - deps.vulnerablePackages) / deps.packagesChecked) * 1000) / 10
          : null,
      filesScanned: files.size,
      ecosystems: deps.ecosystems,
    },
  };
}

export type { Manifest };