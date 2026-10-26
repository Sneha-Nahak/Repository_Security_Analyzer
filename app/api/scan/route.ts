import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // 1-minute timeout (Vercel pro limit)

async function analyzeRepositoryViaGitHub(repoUrl: string): Promise<any> {
  try {
    // Extract owner/repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!match) throw new Error("Invalid GitHub URL format");
    
    const [, owner, repo] = match;
    
    // Use GitHub API to get repo content
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
    
    const headers: any = {
      Accept: "application/vnd.github.v3+json",
    };
    
    // Add GitHub token if available (increases rate limit)
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    let findings: any[] = [];

    // Check for common files with secrets
    const filesToCheck = [
      ".env",
      ".env.example",
      "package.json",
      "package-lock.json",
      "config.json",
      "secrets.json",
    ];

    for (const fileName of filesToCheck) {
      try {
        const fileUrl = `${apiUrl}/${fileName}`;
        const response = await fetch(fileUrl, { headers });
        
        if (!response.ok) continue;

        const data = await response.json();
        if (!data.content) continue;

        // Decode base64 content
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        
        // Simple secret pattern detection
        const patterns = [
          { regex: /AKIA[0-9A-Z]{16}/, type: "AWS Access Key" },
          { regex: /aws_secret_access_key\s*=\s*[^\s]+/, type: "AWS Secret Key" },
          { regex: /github[_-]?token\s*[:=]\s*[a-zA-Z0-9_-]+/, type: "GitHub Token" },
          { regex: /mongodb[+a-z]*:\/\/[^\s]+/, type: "MongoDB URI" },
          { regex: /-----BEGIN RSA PRIVATE KEY-----/, type: "Private Key" },
        ];

        patterns.forEach((p) => {
          if (p.regex.test(content)) {
            findings.push({
              type: p.type,
              severity: "critical",
              file: fileName,
              line: 1,
              description: `Found potential ${p.type} in ${fileName}`,
            });
          }
        });
      } catch (err) {
        // File not found, continue
      }
    }

    return findings;
  } catch (err) {
    console.error("GitHub analysis error:", err);
    throw new Error("Failed to analyze repository: " + (err instanceof Error ? err.message : "Unknown error"));
  }
}

async function getVulnerablePackages(repoUrl: string): Promise<any[]> {
  try {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!match) throw new Error("Invalid GitHub URL format");
    
    const [, owner, repo] = match;
    
    // Fetch package.json from GitHub
    const packageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`;
    
    const response = await fetch(packageUrl);
    if (!response.ok) {
      return [{ type: "Package Analysis", severity: "moderate", file: "package.json", line: 1, description: "Could not fetch package.json" }];
    }

    const packageJson = await response.json();
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    let findings: any[] = [];

    // Check top vulnerable packages (hardcoded list of known vulnerabilities)
    const knownVulnerable: Record<string, { severity: string; description: string }> = {
      "lodash": { severity: "high", description: "Known vulnerabilities in lodash" },
      "moment": { severity: "high", description: "Known vulnerabilities in moment.js" },
      "request": { severity: "high", description: "request module has known security issues" },
      "debug": { severity: "moderate", description: "Potential regex DoS vulnerability" },
    };

    Object.keys(deps).forEach((pkg) => {
      if (knownVulnerable[pkg]) {
        findings.push({
          type: "Vulnerable Dependency",
          severity: knownVulnerable[pkg].severity,
          file: "package.json",
          line: 1,
          description: knownVulnerable[pkg].description,
        });
      }
    });

    return findings;
  } catch (err) {
    console.error("Package analysis error:", err);
    return [];
  }
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

export async function POST(request: NextRequest) {
  try {
    const { repoUrl } = await request.json();

    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Invalid repository URL" },
        { status: 400 }
      );
    }

    // Validate GitHub URL
    if (!repoUrl.includes("github.com") || !repoUrl.startsWith("https://")) {
      return NextResponse.json(
        { error: "Only HTTPS GitHub repository URLs are supported" },
        { status: 400 }
      );
    }

    console.log(`[VERCEL API] Analyzing: ${repoUrl}`);

    // Analyze repository via GitHub API
    const secretFindings = await analyzeRepositoryViaGitHub(repoUrl);
    console.log(`[VERCEL API] Secret analysis: ${secretFindings.length} findings`);

    // Get vulnerable packages
    const packageFindings = await getVulnerablePackages(repoUrl);
    console.log(`[VERCEL API] Package analysis: ${packageFindings.length} findings`);

    const allFindings = [...secretFindings, ...packageFindings];
    const score = calculateScore(allFindings);

    // Generate report
    let report = `Repository Security Analysis Report
====================================
Repository: ${repoUrl}
Timestamp: ${new Date().toISOString()}
Security Score: ${score}/100

Summary
-------
Total Issues Found: ${allFindings.length}
Critical: ${allFindings.filter((f) => f.severity === "critical").length}
High: ${allFindings.filter((f) => f.severity === "high").length}
Moderate: ${allFindings.filter((f) => f.severity === "moderate").length}
Low: ${allFindings.filter((f) => f.severity === "low").length}

Detailed Findings
-----------------
${allFindings.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.type}
   File: ${f.file}:${f.line}
   Issue: ${f.description}`).join("\n\n")}

Status: Analysis Complete
`;

    return new NextResponse(report, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=security-report.txt",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[VERCEL API] Error:", err);
    return NextResponse.json(
      { error: "Scan failed: " + (err instanceof Error ? err.message : "Unknown error") },
      { status: 500 }
    );
  }
}
