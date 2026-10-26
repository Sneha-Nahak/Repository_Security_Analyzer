import { execFile } from "child_process";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { SECRET_PATTERNS, PENALTY_WEIGHTS } from "./patterns";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface Vulnerability {
  type: string;
  severity: string;
  file: string;
  line: number;
  description: string;
  match?: string;
  count?: number;
}

export interface ScanResult {
  vulnerabilities: Vulnerability[];
  score: number;
  dependencies: { critical: number; high: number; medium: number; low: number };
  depScanFailed?: boolean;
}

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const CODE_FILES = /\.(js|ts|jsx|tsx|py|java|cs|go|rb|php|cpp|c|json|yml|yaml|env|properties)$/;
const SECRETS_ONLY_FILES = /\.(env|json|yml|yaml|properties|xml|toml)$/;

export function scanSecrets(basePath: string): Vulnerability[] {
  const findings: Map<string, Vulnerability> = new Map();
  let scannedFiles = 0;
  let matchesFound = 0;

  try {
    scanDirectory(basePath, (filePath, content) => {
      scannedFiles++;
      let lineNum = 0;
      
      content.split("\n").forEach((line) => {
        lineNum++;
        Object.entries(SECRET_PATTERNS).forEach(([key, pattern]) => {
          try {
            const matches = line.matchAll(pattern);
            for (const match of matches) {
              matchesFound++;
              const key_str = match[0];
              
              // Skip test/fixture patterns
              if (isTestFixture(key_str)) return;
              
              // Determine severity
              let severity = "high";
              if (key.includes("aws")) severity = "critical";
              if (key.includes("github_token")) severity = "critical";
              if (key.includes("private_key")) severity = "critical";
              if (key.includes("mongodb")) severity = "critical";
              
              // Mask the secret (keep first 4 chars only)
              const masked = key_str.substring(0, 4) + "*".repeat(Math.max(0, key_str.length - 4));
              
              const id = `${filePath}:${lineNum}:${key}`;
              findings.set(id, {
                type: `Exposed ${key.replace(/_/g, " ")}`,
                severity,
                file: filePath,
                line: lineNum,
                description: `Found potential secret: ${masked}`,
                match: masked,
                count: 1,
              });
            }
          } catch (err) {
            console.error(`Pattern error for ${key}:`, err);
          }
        });
      });
    });
    
    console.log(`[SECRET_SCAN] Scanned ${scannedFiles} files, found ${matchesFound} matches, reported ${findings.size} findings`);
  } catch (err) {
    console.error("Secret scan error:", err);
  }

  return Array.from(findings.values());
}

function isTestFixture(value: string): boolean {
  const testPatterns = [
    /^test/i,
    /^fake/i,
    /^dummy/i,
    /^placeholder/i,
    /^example/i,
    /^mock/i,
    /^sample/i,
  ];
  return testPatterns.some(p => p.test(value));
}

export async function scanDependencies(basePath: string): Promise<Vulnerability[]> {
  const findings: Vulnerability[] = [];

  try {
    console.log(`[DEP_SCAN] Starting npm audit in ${basePath}`);
    
    try {
      // Check if package.json exists
      const packageJsonPath = join(basePath, "package.json");
      try {
        const stat = statSync(packageJsonPath);
        if (!stat.isFile()) {
          console.log(`[DEP_SCAN] No package.json found`);
          return findings;
        }
      } catch {
        console.log(`[DEP_SCAN] No package.json found`);
        return findings;
      }

      // Get full path to npm
      const npmPath = process.platform === "win32" ? "npm.cmd" : "npm";
      
      const { stdout } = await execFileAsync(npmPath, ["audit", "--json"], {
        cwd: basePath,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        // Ensure PATH includes node_modules/.bin
        env: { 
          ...process.env,
          npm_config_registry: "https://registry.npmjs.org/",
          PATH: process.env.PATH
        },
      });

      const auditData = JSON.parse(stdout);
      console.log(`[DEP_SCAN] Audit complete. Vulnerabilities found: ${Object.keys(auditData.vulnerabilities || {}).length}`);
      
      const vulnMap = new Map<string, { pkg: string; advisories: any[] }>();

      Object.entries(auditData.vulnerabilities || {}).forEach(([pkgName, vuln]: any) => {
        if (!vulnMap.has(pkgName)) {
          vulnMap.set(pkgName, { pkg: pkgName, advisories: [] });
        }

        // Handle via array - could have strings (package names) or objects (advisories)
        if (Array.isArray(vuln.via)) {
          vuln.via.forEach((entry: any) => {
            const title = typeof entry === "string" ? entry : entry.title || "Security vulnerability";
            const severity = (entry.severity || vuln.severity || "low").toLowerCase();
            
            vulnMap.get(pkgName)!.advisories.push({
              title,
              severity,
            });
          });
        }
      });

      // Add findings for each unique package with its advisories
      vulnMap.forEach(({ pkg, advisories }) => {
        advisories.forEach((advisory) => {
          findings.push({
            type: "Vulnerable Dependency",
            severity: advisory.severity,
            file: "package.json",
            line: 1,
            description: `${pkg}: ${advisory.title}`,
            count: 1,
          });
        });
      });
      
      console.log(`[DEP_SCAN] Processed ${findings.length} vulnerability findings`);
    } catch (err: any) {
      console.log(`[DEP_SCAN] npm audit error - checking partial output`);
      
      if (err.code === "ENOENT") {
        console.error("npm not found in PATH");
      } else if (err.killed) {
        findings.push({
          type: "Dependency Scan Timeout",
          severity: "high",
          file: "package.json",
          line: 1,
          description: "Dependency scan took too long and was interrupted",
        });
      } else if (err.stdout) {
        try {
          const partial = JSON.parse(err.stdout);
          if (partial.vulnerabilities) {
            console.log(`[DEP_SCAN] Parsed partial results with ${Object.keys(partial.vulnerabilities).length} packages`);
            // Process partial results
            Object.entries(partial.vulnerabilities || {}).forEach(([pkgName, vuln]: any) => {
              if (Array.isArray(vuln.via)) {
                vuln.via.forEach((entry: any) => {
                  const title = typeof entry === "string" ? entry : entry.title || "Security vulnerability";
                  findings.push({
                    type: "Vulnerable Dependency",
                    severity: (entry.severity || vuln.severity || "low").toLowerCase(),
                    file: "package.json",
                    line: 1,
                    description: `${pkgName}: ${title}`,
                  });
                });
              }
            });
          }
        } catch (parseErr) {
          console.error(`Failed to parse npm audit output: ${parseErr}`);
          findings.push({
            type: "Dependency Scan Failed",
            severity: "moderate",
            file: "package.json",
            line: 1,
            description: "Could not parse npm audit output",
          });
        }
      } else {
        console.error(`npm audit failed: ${err.message}`);
        findings.push({
          type: "Dependency Scan Failed",
          severity: "moderate",
          file: "package.json",
          line: 1,
          description: `Dependency scan error: ${err.message}`,
        });
      }
    }
  } catch (err) {
    console.error("Dependency scan outer error:", err);
    findings.push({
      type: "Dependency Scan Error",
      severity: "moderate",
      file: "package.json",
      line: 1,
      description: "Unexpected error during dependency scan",
    });
  }

  return findings;
}

export async function performScan(basePath: string): Promise<ScanResult> {
  console.log(`[SCAN] Starting full scan of ${basePath}`);
  
  const secretVulns = scanSecrets(basePath);
  console.log(`[SCAN] Secret scan complete: ${secretVulns.length} findings`);
  
  const depVulns = await scanDependencies(basePath);
  console.log(`[SCAN] Dependency scan complete: ${depVulns.length} findings`);
  
  const allVulns = [...secretVulns, ...depVulns];
  console.log(`[SCAN] Total findings: ${allVulns.length}`);

  // Smart scoring: penalty per vulnerability, not per finding
  let score = 100;
  const scoredVulns = new Set<string>();
  
  allVulns.forEach((vuln) => {
    const id = `${vuln.type}:${vuln.file}:${vuln.line}`;
    if (scoredVulns.has(id)) return;
    scoredVulns.add(id);

    let penalty = 0;
    if (vuln.type.includes("Exposed")) {
      if (vuln.severity === "critical") penalty = 30;
      else if (vuln.severity === "high") penalty = 20;
    } else if (vuln.type.includes("Vulnerable")) {
      if (vuln.severity === "critical") penalty = 25;
      else if (vuln.severity === "high") penalty = 15;
      else if (vuln.severity === "moderate") penalty = 8;
      else if (vuln.severity === "low") penalty = 3;
    } else {
      penalty = 10; // Other issues
    }
    
    score -= penalty;
  });

  score = Math.max(0, Math.min(100, score));

  const depScanFailed = depVulns.some(v => v.type.includes("Scan"));

  console.log(`[SCAN] Final score: ${score}/100`);

  return {
    vulnerabilities: allVulns,
    score,
    dependencies: {
      critical: depVulns.filter((v) => v.severity === "critical").length,
      high: depVulns.filter((v) => v.severity === "high").length,
      medium: depVulns.filter((v) => v.severity === "moderate").length,
      low: depVulns.filter((v) => v.severity === "low").length,
    },
    depScanFailed,
  };
}

function scanDirectory(
  dir: string,
  callback: (filePath: string, content: string) => void
) {
  try {
    const entries = readdirSync(dir);
    entries.forEach((entry) => {
      const fullPath = join(dir, entry);
      
      // Skip ignored directories first
      if (IGNORE_DIRS.has(entry)) {
        console.log(`[SCAN] Skipping directory: ${entry}`);
        return;
      }

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          scanDirectory(fullPath, callback);
        } else {
          // Check if we should scan this file
          const isCodeFile = CODE_FILES.test(entry);
          const isSmallEnough = stat.size < 10 * 1024 * 1024;
          
          if (isCodeFile && isSmallEnough) {
            try {
              const content = readFileSync(fullPath, "utf-8");
              callback(fullPath, content);
            } catch (readErr) {
              // Binary file or encoding issue, skip silently
            }
          }
        }
      } catch (err) {
        // Skip unreadable files
      }
    });
  } catch (err) {
    console.error(`Could not scan directory ${dir}:`, err);
  }
}
