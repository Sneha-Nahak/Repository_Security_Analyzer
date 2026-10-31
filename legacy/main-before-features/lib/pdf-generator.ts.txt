import { Readable } from "stream";
import type { ScanResult } from "./scanner";

export async function generatePDF(
  scanResult: ScanResult,
  repoUrl: string
): Promise<Readable> {
  return new Promise((resolve) => {
    // Generate detailed text-based report
    let content = "";
    
    content += "SECURITY SCAN REPORT\n";
    content += "=".repeat(70) + "\n\n";
    
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Repository: ${repoUrl}\n\n`;
    
    // Summary
    content += "SUMMARY\n";
    content += "-".repeat(70) + "\n";
    content += `Security Score: ${scanResult.score}/100\n`;
    content += `Total Issues: ${scanResult.vulnerabilities.length}\n`;
    if (scanResult.depScanFailed) {
      content += "WARNING: Dependency scan did not complete successfully\n";
    }
    content += "\n";
    
    // Vulnerabilities by severity
    content += "VULNERABILITIES BY SEVERITY\n";
    content += "-".repeat(70) + "\n";
    
    const bySeverity = groupBySeverity(scanResult.vulnerabilities);
    ["critical", "high", "moderate", "low"].forEach((sev) => {
      const count = bySeverity[sev]?.length || 0;
      content += `${sev.toUpperCase().padEnd(10)}: ${count}\n`;
    });
    content += "\n";
    
    // Detailed findings
    content += "DETAILED FINDINGS\n";
    content += "-".repeat(70) + "\n\n";
    
    if (scanResult.vulnerabilities.length === 0) {
      content += "No vulnerabilities detected.\n\n";
    } else {
      scanResult.vulnerabilities.slice(0, 100).forEach((vuln, idx) => {
        content += `${idx + 1}. [${vuln.severity.toUpperCase()}] ${vuln.type}\n`;
        content += `   File: ${vuln.file}:${vuln.line}\n`;
        content += `   Issue: ${vuln.description}\n`;
        if (vuln.match) {
          content += `   Match: ${vuln.match}\n`;
        }
        if (vuln.count && vuln.count > 1) {
          content += `   Count: ${vuln.count} occurrences\n`;
        }
        content += "\n";
      });
      
      if (scanResult.vulnerabilities.length > 100) {
        content += `... and ${scanResult.vulnerabilities.length - 100} more issues\n\n`;
      }
    }
    
    // Dependency Analysis
    content += "DEPENDENCY ANALYSIS\n";
    content += "-".repeat(70) + "\n";
    if (scanResult.depScanFailed) {
      content += "Dependency scan could not be completed.\n";
      content += "This may be due to:\n";
      content += "- Missing package-lock.json or yarn.lock\n";
      content += "- Network issues accessing npm registry\n";
      content += "- Large number of dependencies\n";
    } else {
      content += `Critical: ${scanResult.dependencies.critical}\n`;
      content += `High: ${scanResult.dependencies.high}\n`;
      content += `Medium: ${scanResult.dependencies.medium}\n`;
      content += `Low: ${scanResult.dependencies.low}\n`;
    }
    content += "\n";
    
    // Remediation
    content += "REMEDIATION GUIDANCE\n";
    content += "-".repeat(70) + "\n";
    content += "1. CRITICAL: Review all exposed secrets immediately\n";
    content += "   - Rotate any credentials found\n";
    content += "   - Remove from git history using BFG or git-filter-branch\n";
    content += "   - Use environment variables or secret management tools\n\n";
    content += "2. HIGH: Fix vulnerable dependencies\n";
    content += "   - Run: npm update\n";
    content += "   - For pre-release security fixes: npm install --save-dev\n";
    content += "   - Review dependency changelogs\n\n";
    content += "3. MEDIUM/LOW: Plan updates\n";
    content += "   - Schedule regular security updates\n";
    content += "   - Enable automated dependency scanning\n";
    content += "   - Implement pre-commit hooks\n\n";
    content += "4. PREVENTION\n";
    content += "   - Add .env to .gitignore\n";
    content += "   - Use git-secrets or similar tools\n";
    content += "   - Enable branch protection and code review\n";
    content += "   - Run security scans in CI/CD\n\n";
    
    // Metadata for LLM parsing
    content += "<!-- SCAN_DATA_BEGIN -->\n";
    content += JSON.stringify({
      vulnerabilityCount: scanResult.vulnerabilities.length,
      score: scanResult.score,
      timestamp: new Date().toISOString(),
      bySeverity: {
        critical: bySeverity.critical?.length || 0,
        high: bySeverity.high?.length || 0,
        moderate: bySeverity.moderate?.length || 0,
        low: bySeverity.low?.length || 0,
      },
      depScanFailed: scanResult.depScanFailed,
    }, null, 2) + "\n";
    content += "<!-- SCAN_DATA_END -->\n";
    
    // Create readable stream
    const readable = Readable.from([content]);
    resolve(readable);
  });
}

function groupBySeverity(vulns: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {
    critical: [],
    high: [],
    moderate: [],
    low: [],
  };
  
  vulns.forEach(v => {
    const sev = v.severity || "low";
    if (grouped[sev]) {
      grouped[sev].push(v);
    }
  });
  
  return grouped;
}
