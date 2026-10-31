import type { Finding, ScanResult, SeverityCounts } from "./scanner";

const MAX_LISTED = 100;

const counts = (c: SeverityCounts) => `critical ${c.critical}, high ${c.high}, medium ${c.medium}, low ${c.low}`;

function renderFinding(f: Finding, n: number): string {
  const where = f.line > 0 ? `${f.file}:${f.line}` : f.file;
  let out = `\n  ${n}. [${f.severity.toUpperCase()}] ${f.type}\n`;
  out += `     Location: ${where}`;
  if (f.occurrences > 1) out += ` (+${f.occurrences - 1} more location${f.occurrences === 2 ? "" : "s"})`;
  out += `\n     Issue:    ${f.description}\n`;
  if (f.match) out += `     Match:    ${f.match}\n`;
  if (f.confidence) out += `     Confidence: ${Math.round(f.confidence * 100)}%\n`;
  return out;
}

function renderSecurityBadge(score: number): string {
  if (score >= 90) return "🟢 EXCELLENT";
  if (score >= 75) return "🟡 GOOD";
  if (score >= 50) return "🟠 AT RISK";
  return "🔴 CRITICAL";
}

function renderSeverityBar(count: number, max: number): string {
  if (count === 0) return "░░░░░░░░░░ (0)";
  const filled = Math.ceil((count / Math.max(max, 1)) * 10);
  return "█".repeat(filled) + "░".repeat(Math.max(0, 10 - filled)) + ` (${count})`;
}

/** Human-readable report with improved hierarchy and visual structure. */
export function buildReport(result: ScanResult, repoUrl: string, generatedAt = new Date()): string {
  const secrets = result.findings.filter((f) => f.category === "secret");
  const deps = result.findings.filter((f) => f.category === "dependency");
  const s = result.summary;

  let out = "";
  
  // Header
  out += "╔" + "═".repeat(78) + "╗\n";
  out += "║" + " ".repeat(20) + "SECURITY SCAN REPORT" + " ".repeat(38) + "║\n";
  out += "╚" + "═".repeat(78) + "╝\n\n";

  // Repository Info
  out += "📦 REPOSITORY INFORMATION\n";
  out += "─".repeat(80) + "\n";
  out += `Repository:  ${repoUrl}\n`;
  out += `Scanned:     ${generatedAt.toISOString()}\n\n`;

  // Security Overview
  out += "🛡️  SECURITY OVERVIEW\n";
  out += "─".repeat(80) + "\n";
  out += `Security Score:  ${result.score}/100  ${renderSecurityBadge(result.score)}\n`;
  out += `Grade:           ${result.grade}\n`;
  out += `Coverage:        ${result.coverage}%${result.provisional ? " (provisional - some checks incomplete)" : " (complete)"}\n`;
  out += `Risk Level:      ${result.risk.toFixed(1)}\n`;
  if (result.capReason) out += `⚠️  Score is capped because ${result.capReason}\n`;
  out += "\n";

  // Quick Stats
  out += "📊 QUICK STATISTICS\n";
  out += "─".repeat(80) + "\n";
  out += `Files Scanned:        ${s.filesScanned}\n`;
  out += `Total Issues Found:   ${result.findings.length}\n`;
  if (s.packagesChecked !== undefined) {
    out += `Packages Checked:     ${s.packagesChecked}\n`;
    out += `Vulnerable Packages:  ${s.vulnerablePackages}\n`;
    if (s.cleanPackagesPct !== null) {
      out += `Clean Packages:       ${s.cleanPackagesPct}%\n`;
    }
  }
  out += `Ecosystems Found:     ${s.ecosystems.length > 0 ? s.ecosystems.join(", ") : "None"}\n`;
  out += "\n";

  // Severity Distribution
  out += "📈 SEVERITY DISTRIBUTION\n";
  out += "─".repeat(80) + "\n";
  out += `Critical:  ${renderSeverityBar(s.secrets.critical + s.dependencies.production.critical, 20)}\n`;
  out += `High:      ${renderSeverityBar(s.secrets.high + s.dependencies.production.high, 20)}\n`;
  out += `Medium:    ${renderSeverityBar(s.secrets.medium + s.dependencies.production.medium, 20)}\n`;
  out += `Low:       ${renderSeverityBar(s.secrets.low + s.dependencies.production.low, 20)}\n`;
  out += "\n";

  // Scan Checks Status
  out += "✓ SCAN CHECKS STATUS\n";
  out += "─".repeat(80) + "\n";
  for (const c of result.checks) {
    const icon = c.status === "ok" ? "✓" : c.status === "partial" ? "◐" : c.status === "failed" ? "✗" : "⊘";
    out += `${icon} [${c.status.toUpperCase()}] ${c.name}\n`;
    out += `  └─ ${c.detail}\n`;
  }
  out += "\n";

  // Secrets Section
  out += "🔑 SECRETS (EXPOSED CREDENTIALS)\n";
  out += "─".repeat(80) + "\n";
  out += `Total Secrets Found: ${secrets.length}\n`;
  out += `By Severity: ${counts(s.secrets)}\n`;
  if (secrets.length === 0) {
    out += "\n✓ No secrets detected in the files that were scanned.\n\n";
  } else {
    out += `\nTop ${Math.min(secrets.length, MAX_LISTED)} Finding${secrets.length === 1 ? "" : "s"}:\n`;
    secrets.slice(0, MAX_LISTED).forEach((f, i) => (out += renderFinding(f, i + 1)));
    if (secrets.length > MAX_LISTED) {
      out += `\n  ... and ${secrets.length - MAX_LISTED} more secret${secrets.length - MAX_LISTED === 1 ? "" : "s"}\n`;
    }
    out += "\n";
  }

  // Dependencies Section
  out += "📦 DEPENDENCIES (VULNERABLE PACKAGES)\n";
  out += "─".repeat(80) + "\n";
  out += `Total Vulnerable Packages: ${deps.length}\n`;
  out += `Production:  ${counts(s.dependencies.production)}\n`;
  out += `Dev-only:    ${counts(s.dependencies.dev)}\n`;
  if (deps.length === 0) {
    out += "\n✓ No known vulnerabilities in the packages that were checked.\n\n";
  } else {
    out += `\nTop ${Math.min(deps.length, MAX_LISTED)} Finding${deps.length === 1 ? "" : "s"}:\n`;
    deps.slice(0, MAX_LISTED).forEach((f, i) => (out += renderFinding(f, i + 1)));
    if (deps.length > MAX_LISTED) {
      out += `\n  ... and ${deps.length - MAX_LISTED} more vulnerable package${deps.length - MAX_LISTED === 1 ? "" : "s"}\n`;
    }
    out += "\n";
  }

  // Scan Notes
  out += "ℹ️  IMPORTANT NOTES (READ BEFORE TRUSTING A CLEAN RESULT)\n";
  out += "─".repeat(80) + "\n";
  if (result.notes.length === 0) {
    out += "No notes.\n";
  } else {
    result.notes.forEach((n) => (out += `• ${n}\n`));
  }
  out += "\n";

  // Remediation Steps
  out += "🔧 REMEDIATION STEPS\n";
  out += "─".repeat(80) + "\n";
  let step = 1;
  const ecos = new Set(deps.map((d) => d.ecosystem));
  
  if (secrets.length === 0 && deps.length === 0) {
    out += "No issues to fix - your repository appears secure!\n";
  } else {
    if (secrets.some((f) => (f.confidence ?? 1) >= 0.8)) {
      out += `${step++}. 🔐 SECRETS FOUND - IMMEDIATE ACTION REQUIRED:\n`;
      out += `   • Rotate every exposed credential immediately\n`;
      out += `   • Remove credentials from the repository\n`;
      out += `   • Clean git history (use git filter-repo or BFG)\n`;
      out += `   • Move sensitive values to environment variables\n\n`;
    }
    if (ecos.has("npm")) {
      out += `${step++}. 📦 NPM PACKAGES:\n`;
      out += `   • Run: npm audit fix\n`;
      out += `   • Commit updated package-lock.json\n`;
      out += `   • Fix production dependencies first (higher priority)\n\n`;
    }
    if (ecos.has("PyPI")) {
      out += `${step++}. 🐍 PYTHON PACKAGES:\n`;
      out += `   • Upgrade listed packages\n`;
      out += `   • Re-pin them in requirements/lock files\n\n`;
    }
    if (ecos.has("Go")) {
      out += `${step++}. 🔵 GO MODULES:\n`;
      out += `   • Run: go get -u\n`;
      out += `   • Run: go mod tidy\n\n`;
    }
    if (ecos.has("RubyGems")) {
      out += `${step++}. 💎 RUBY GEMS:\n`;
      out += `   • Run: bundle update <gem>\n\n`;
    }
    if (ecos.has("crates.io")) {
      out += `${step++}. 🦀 RUST CRATES:\n`;
      out += `   • Run: cargo update -p <crate>\n\n`;
    }
    if (ecos.has("Packagist")) {
      out += `${step++}. 🐘 PHP PACKAGES:\n`;
      out += `   • Run: composer update <package>\n\n`;
    }
    if (ecos.has("Maven") || ecos.has("NuGet")) {
      out += `${step++}. ☕ JAVA/.NET DEPENDENCIES:\n`;
      out += `   • Bump listed dependency versions in build files\n\n`;
    }
    if (result.provisional) {
      out += `${step++}. 📝 INCOMPLETE SCAN:\n`;
      out += `   • Commit lockfiles for all package managers\n`;
      out += `   • This will enable full dependency checking\n\n`;
    }
  }
  out += "\n";

  // Footer
  out += "─".repeat(80) + "\n";
  out += "Report generated by Repository Security Analyzer\n";
  out += "For more information, visit your dashboard\n";
  out += "\n";

  // Embedded scan data (machine readable)
  out += "<!-- SCAN_DATA_BEGIN -->\n";
  out += JSON.stringify({
    score: result.score,
    grade: result.grade,
    coverage: result.coverage,
    provisional: result.provisional,
    risk: result.risk,
    findings: result.findings.length,
    secrets: secrets.length,
    dependencies: deps.length,
    packagesChecked: s.packagesChecked,
    vulnerablePackages: s.vulnerablePackages,
    generated: generatedAt.toISOString(),
  }) + "\n";
  out += "<!-- SCAN_DATA_END -->\n";
  
  return out;
}