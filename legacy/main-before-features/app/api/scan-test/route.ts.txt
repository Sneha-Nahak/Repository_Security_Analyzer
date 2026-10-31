import { NextResponse } from "next/server";
import { performScan } from "@/lib/scanner";
import { generatePDF } from "@/lib/pdf-generator";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function GET() {
  // Test with a known vulnerable repo
  const testRepos = [
    "https://github.com/npm/npm", // Large project, likely has vulns
  ];

  let scanDir: string | null = null;

  try {
    scanDir = await fs.mkdtemp(path.join(os.tmpdir(), "scan_"));
    const repoUrl = testRepos[0];

    console.log(`[TEST] Cloning ${repoUrl}`);
    await execFileAsync("git", ["clone", "--depth", "1", "--", repoUrl, scanDir], {
      timeout: 60000,
    });

    console.log(`[TEST] Scanning ${scanDir}`);
    const result = await performScan(scanDir);

    return NextResponse.json({
      status: "scan complete",
      repo: repoUrl,
      vulnerabilities: result.vulnerabilities,
      score: result.score,
      summary: {
        total: result.vulnerabilities.length,
        critical: result.dependencies.critical,
        high: result.dependencies.high,
        medium: result.dependencies.medium,
        low: result.dependencies.low,
      },
    });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  } finally {
    if (scanDir) {
      try {
        await fs.rm(scanDir, { recursive: true, force: true });
      } catch { }
    }
  }
}
