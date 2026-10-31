import type { Finding, ScanResult } from "./scanner";

/**
 * Generates a machine-friendly report format optimized for LLM processing.
 * Uses key=value pairs for maximum context window efficiency.
 */
export function buildAIReport(result: ScanResult, repoUrl: string, generatedAt = new Date()): string {
  const secrets = result.findings.filter((f) => f.category === "secret");
  const deps = result.findings.filter((f) => f.category === "dependency");
  const s = result.summary;

  let out = "";

  // Header
  out += "SECURITY_SCAN_REPORT_FOR_AI\n";
  out += "=".repeat(80) + "\n\n";

  // Metadata
  out += "REPORT_METADATA\n";
  out += "repository_url=" + repoUrl + "\n";
  out += "scan_timestamp=" + generatedAt.toISOString() + "\n";
  out += "report_format=machine_readable_key_value\n\n";

  // Overall Score
  out += "SECURITY_OVERVIEW\n";
  out += "security_score=" + result.score + "\n";
  out += "score_max=100\n";
  out += "grade=" + result.grade + "\n";
  out += "coverage_percentage=" + result.coverage + "\n";
  out += "is_provisional=" + (result.provisional ? "true" : "false") + "\n";
  out += "risk_level=" + result.risk.toFixed(1) + "\n";
  if (result.capReason) out += "score_cap_reason=" + result.capReason + "\n";
  out += "\n";

  // Summary Statistics
  out += "SCAN_SUMMARY\n";
  out += "total_findings=" + result.findings.length + "\n";
  out += "files_scanned=" + s.filesScanned + "\n";
  out += "secrets_found=" + secrets.length + "\n";
  out += "vulnerable_dependencies=" + deps.length + "\n";
  out += "packages_checked=" + s.packagesChecked + "\n";
  out += "packages_vulnerable=" + s.vulnerablePackages + "\n";
  out += "packages_clean_percentage=" + (s.cleanPackagesPct !== null ? s.cleanPackagesPct : "unknown") + "\n";
  out += "ecosystems_detected=" + s.ecosystems.join(",") + "\n\n";

  // Severity Counts
  out += "SEVERITY_DISTRIBUTION\n";
  out += "critical_total=" + (s.secrets.critical + s.dependencies.production.critical) + "\n";
  out += "high_total=" + (s.secrets.high + s.dependencies.production.high) + "\n";
  out += "medium_total=" + (s.secrets.medium + s.dependencies.production.medium) + "\n";
  out += "low_total=" + (s.secrets.low + s.dependencies.production.low) + "\n";
  out += "secrets_critical=" + s.secrets.critical + "\n";
  out += "secrets_high=" + s.secrets.high + "\n";
  out += "secrets_medium=" + s.secrets.medium + "\n";
  out += "secrets_low=" + s.secrets.low + "\n";
  out += "deps_production_critical=" + s.dependencies.production.critical + "\n";
  out += "deps_production_high=" + s.dependencies.production.high + "\n";
  out += "deps_production_medium=" + s.dependencies.production.medium + "\n";
  out += "deps_production_low=" + s.dependencies.production.low + "\n";
  out += "deps_dev_critical=" + s.dependencies.dev.critical + "\n";
  out += "deps_dev_high=" + s.dependencies.dev.high + "\n";
  out += "deps_dev_medium=" + s.dependencies.dev.medium + "\n";
  out += "deps_dev_low=" + s.dependencies.dev.low + "\n\n";

  // Scan Checks
  out += "SCAN_CHECKS_PERFORMED\n";
  result.checks.forEach((check, idx) => {
    out += `check_${idx + 1}_name=${check.name}\n`;
    out += `check_${idx + 1}_status=${check.status}\n`;
    out += `check_${idx + 1}_detail=${check.detail}\n`;
  });
  out += "\n";

  // Secrets Findings
  out += "SECRETS_FINDINGS_COUNT=" + secrets.length + "\n";
  out += "-".repeat(80) + "\n";
  secrets.forEach((finding, idx) => {
    const findingNum = idx + 1;
    out += `\nFINDING_SECRET_${findingNum}\n`;
    out += `finding_id=secret_${findingNum}\n`;
    out += `severity=${finding.severity}\n`;
    out += `type=${finding.type}\n`;
    out += `file=${finding.file}\n`;
    out += `line=${finding.line}\n`;
    out += `occurrences=${finding.occurrences}\n`;
    out += `description=${finding.description}\n`;
    if (finding.match) out += `matched_value=${finding.match.substring(0, 4)}${"*".repeat(Math.max(0, finding.match.length - 4))}\n`;
    if (finding.confidence !== undefined) out += `confidence_score=${(finding.confidence * 100).toFixed(0)}\n`;
    out += `weight=${finding.weight}\n`;
    out += `action_required=IMMEDIATE\n`;
    out += `action_rotate_credentials=true\n`;
    out += `action_remove_from_repo=true\n`;
    out += `action_clean_git_history=true\n`;
    out += `action_use_env_vars=true\n`;
  });
  out += "\n";

  // Dependencies Findings
  out += "VULNERABLE_DEPENDENCIES_COUNT=" + deps.length + "\n";
  out += "-".repeat(80) + "\n";
  deps.forEach((finding, idx) => {
    const findingNum = idx + 1;
    out += `\nFINDING_DEPENDENCY_${findingNum}\n`;
    out += `finding_id=dep_${findingNum}\n`;
    out += `severity=${finding.severity}\n`;
    out += `type=${finding.type}\n`;
    out += `package_name=${finding.package || "unknown"}\n`;
    out += `current_version=${finding.version || "unknown"}\n`;
    out += `scope=${finding.scope || "production"}\n`;
    out += `direct_dependency=${finding.direct !== undefined ? finding.direct : "unknown"}\n`;
    out += `ecosystem=${finding.ecosystem || "unknown"}\n`;
    out += `file=${finding.file}\n`;
    out += `description=${finding.description}\n`;
    if (finding.advisories && finding.advisories.length > 0) {
      const advisory = finding.advisories[0] as any;
      out += `vulnerable_range=${advisory.range || "unknown"}\n`;
      out += `cves=${advisory.cves?.join(",") || "none"}\n`;
      if (advisory.url) out += `advisory_url=${advisory.url}\n`;
    }
    out += `weight=${finding.weight}\n`;
  });
  out += "\n";

  // Remediation by Ecosystem
  out += "REMEDIATION_STEPS_BY_ECOSYSTEM\n";
  out += "-".repeat(80) + "\n";

  const ecos = new Set(deps.map((d) => d.ecosystem));

  if (secrets.some((f) => (f.confidence ?? 1) >= 0.8)) {
    out += "\nECOSYSTEM=SECRETS_CRITICAL\n";
    out += "action_priority=1_IMMEDIATE\n";
    out += "step_1=Rotate all exposed credentials immediately\n";
    out += "step_2=Remove credentials from repository\n";
    out += "step_3=Clean git history using: git filter-repo --path <file-path>\n";
    out += "step_4=Move values to environment variables\n";
    out += "step_5=Add sensitive files to .gitignore\n";
  }

  if (ecos.has("npm")) {
    out += "\nECOSYSTEM=NPM\n";
    out += "action_priority=2_HIGH\n";
    out += "package_manager=npm\n";
    out += "fix_command_1=npm audit fix\n";
    out += "fix_command_2=npm audit fix --force (use only if needed)\n";
    out += "commit_command=git add package-lock.json && git commit -m 'security: fix npm vulnerabilities'\n";
    out += "note=Fix production dependencies first, dev-only vulnerabilities have lower priority\n";
    const npmDeps = deps.filter((d) => d.ecosystem === "npm" && d.scope === "production");
    if (npmDeps.length > 0) {
      out += "production_vulnerable_packages=" + npmDeps.map((d) => d.package).join(",") + "\n";
    }
  }

  if (ecos.has("PyPI")) {
    out += "\nECOSYSTEM=PYTHON\n";
    out += "action_priority=2_HIGH\n";
    out += "package_manager=pip\n";
    out += "fix_command=pip install --upgrade <package-name>\n";
    out += "update_files=requirements.txt,setup.py,pyproject.toml\n";
    out += "note=Update and re-pin package versions in lock files\n";
  }

  if (ecos.has("Go")) {
    out += "\nECOSYSTEM=GO\n";
    out += "action_priority=2_HIGH\n";
    out += "package_manager=go\n";
    out += "fix_command_1=go get -u\n";
    out += "fix_command_2=go mod tidy\n";
    out += "commit_command=git add go.sum && git commit -m 'security: update go dependencies'\n";
  }

  if (ecos.has("RubyGems")) {
    out += "\nECOSYSTEM=RUBY\n";
    out += "action_priority=2_HIGH\n";
    out += "package_manager=bundler\n";
    out += "fix_command=bundle update <gem-name>\n";
    out += "update_files=Gemfile.lock\n";
  }

  if (ecos.has("crates.io")) {
    out += "\nECOSYSTEM=RUST\n";
    out += "action_priority=2_HIGH\n";
    out += "package_manager=cargo\n";
    out += "fix_command=cargo update -p <crate-name>\n";
    out += "update_files=Cargo.lock\n";
  }

  if (ecos.has("Packagist")) {
    out += "\nECOSYSTEM=PHP\n";
    out += "action_priority=2_HIGH\n";
    out += "package_manager=composer\n";
    out += "fix_command=composer update <package-name>\n";
    out += "update_files=composer.lock\n";
  }

  if (ecos.has("Maven") || ecos.has("NuGet")) {
    out += "\nECOSYSTEM=JAVA_DOTNET\n";
    out += "action_priority=2_HIGH\n";
    out += "package_managers=Maven,NuGet\n";
    out += "note=Update dependency versions in pom.xml or .csproj files\n";
  }

  if (result.provisional) {
    out += "\nECOSYSTEM=INCOMPLETE_SCAN\n";
    out += "action_priority=3_FOLLOW_UP\n";
    out += "issue=Some package managers lack lock files for complete checking\n";
    out += "fix=Commit lockfiles for all ecosystems to enable full dependency analysis\n";
  }

  out += "\n";

  // Important Notes
  out += "SCAN_NOTES\n";
  out += "-".repeat(80) + "\n";
  result.notes.forEach((note, idx) => {
    out += `note_${idx + 1}=${note}\n`;
  });
  out += "\n";

  // Instructions for AI
  out += "INSTRUCTIONS_FOR_LLM\n";
  out += "-".repeat(80) + "\n";
  out += "You are analyzing a security scan report for a software repository.\n";
  out += "Use the key=value pairs above to understand vulnerabilities and generate fixes.\n";
  out += "For each FINDING_SECRET_* entry:\n";
  out += "  - Advise rotating the credential immediately\n";
  out += "  - Provide git commands to remove from history\n";
  out += "For each FINDING_DEPENDENCY_* entry:\n";
  out += "  - Provide exact upgrade commands from REMEDIATION_STEPS_BY_ECOSYSTEM\n";
  out += "  - Prioritize production scope over dev scope\n";
  out += "  - Prioritize CRITICAL and HIGH severity\n";
  out += "  - Include the fix_command_* values in your response\n";
  out += "Output format: Provide numbered steps with exact commands the user can copy-paste.\n";
  out += "\n";

  out += "END_OF_REPORT\n";

  return out;
}
