import { NextResponse } from "next/server";
import path from "path";
import { readFileSync, readdirSync, statSync } from "fs";

const SECRET_PATTERNS: Record<string, RegExp> = {
  AWS_KEY: /AKIA[0-9A-Z]{16}/g,
  AWS_SECRET: /aws_secret_access_key\s*[:=]\s*[^\s]+/gi,
  GITHUB_TOKEN: /github[_-]?token\s*[:=]\s*[a-zA-Z0-9_-]+/gi,
  MONGODB_URI: /mongodb[+a-z]*:\/\/[^\s]+/gi,
  PRIVATE_KEY: /-----BEGIN RSA PRIVATE KEY-----/g,
};

function scanSecrets(basePath: string): any[] {
  const findings: any[] = [];
  const filesToCheck = [".env", "package.json", "config.json", "app.js"];

  filesToCheck.forEach((fileName) => {
    try {
      const filePath = path.join(basePath, fileName);
      const content = readFileSync(filePath, "utf-8");

      Object.entries(SECRET_PATTERNS).forEach(([key, pattern]) => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            findings.push({
              type: key.replace(/_/g, " "),
              severity: "critical",
              file: fileName,
              line: 1,
              description: `Found potential ${key.replace(/_/g, " ")} - ${match.substring(0, 4)}${"*".repeat(Math.max(0, match.length - 4))}`,
            });
          });
        }
      });
    } catch (err) {
      // File doesn't exist, skip
    }
  });

  return findings;
}

function scanDependencies(): any[] {
  // For test-repo demo
  return [
    {
      type: "Vulnerable Dependency",
      severity: "high",
      file: "package.json",
      line: 1,
      description: "lodash has known prototype pollution vulnerability",
    },
    {
      type: "Vulnerable Dependency", 
      severity: "moderate",
      file: "package.json",
      line: 1,
      description: "moment has performance issues with timezone handling",
    },
  ];
}

function calculateScore(findings: any[]): number {
  let score = 100;
  
  findings.forEach((finding) => {
    if (finding.severity === "critical") score -= 25;
    else if (finding.severity === "high") score -= 15;
    else if (finding.severity === "moderate") score -= 8;
    else if (finding.severity === "low") score -= 3;
  });

  return Math.max(0, score);
}

export async function GET() {
  try {
    // Scan the test-repo directory
    const testRepoPath = path.join(process.cwd(), "test-repo");
    
    console.log(`[LOCAL_TEST] Scanning test repo at ${testRepoPath}`);
    
    const secretFindings = scanSecrets(testRepoPath);
    const depFindings = scanDependencies();
    const allFindings = [...secretFindings, ...depFindings];
    const score = calculateScore(allFindings);

    return NextResponse.json({
      status: "scan complete",
      path: testRepoPath,
      vulnerabilities: allFindings,
      score: score,
      summary: {
        total: allFindings.length,
        critical: allFindings.filter(f => f.severity === "critical").length,
        high: allFindings.filter(f => f.severity === "high").length,
        medium: allFindings.filter(f => f.severity === "moderate").length,
        low: allFindings.filter(f => f.severity === "low").length,
      },
      findings: allFindings.map(v => ({
        type: v.type,
        severity: v.severity,
        file: v.file,
        line: v.line,
        description: v.description,
      })),
    });
  } catch (err) {
    console.error("[LOCAL_TEST] Error:", err);
    return NextResponse.json({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
