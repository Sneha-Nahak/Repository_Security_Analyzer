import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { performScan } from "@/lib/scanner";
import { generatePDF } from "@/lib/pdf-generator";
import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const maxDuration = 300; // 5-minute timeout

async function cleanupDirectory(dir: string) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}

function validateGitHubUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Strict check: must be https and exactly github.com
    if (urlObj.protocol !== "https:") return false;
    if (urlObj.hostname !== "github.com") return false;
    
    // Must match user/repo pattern
    const pathParts = urlObj.pathname.split("/").filter(p => p);
    if (pathParts.length < 2) return false;
    
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let scanDir: string | null = null;

  try {
    const { repoUrl } = await request.json();
    console.log(`[API] Scan request for: ${repoUrl}`);

    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Invalid repository URL" },
        { status: 400 }
      );
    }

    // Strict validation
    if (!validateGitHubUrl(repoUrl)) {
      console.error(`[API] Invalid URL format: ${repoUrl}`);
      return NextResponse.json(
        { error: "Only HTTPS GitHub repository URLs are supported" },
        { status: 400 }
      );
    }

    // Create ephemeral scan directory using mkdtemp
    try {
      scanDir = await fs.mkdtemp(path.join(os.tmpdir(), "scan_"));
      console.log(`[API] Created scan directory: ${scanDir}`);
    } catch (err) {
      console.error(`[API] Failed to create scan directory:`, err);
      return NextResponse.json(
        { error: "Failed to create scan directory" },
        { status: 500 }
      );
    }

    // Clone repository with depth 1 using execFile (no shell injection)
    try {
      console.log(`[API] Cloning ${repoUrl} to ${scanDir}`);
      await execFileAsync("git", ["clone", "--depth", "1", "--", repoUrl, scanDir], {
        timeout: 60000,
      });
      console.log(`[API] Clone successful`);
    } catch (err: any) {
      await cleanupDirectory(scanDir);
      console.error(`[API] Clone error:`, err.message);
      return NextResponse.json(
        { error: "Failed to clone repository: " + err.message },
        { status: 400 }
      );
    }

    // Perform security scan
    console.log(`[API] Starting security scan`);
    const scanResult = await performScan(scanDir);
    console.log(`[API] Security scan complete: ${scanResult.vulnerabilities.length} findings, score ${scanResult.score}`);

    // Generate report
    const reportContent = await generatePDF(scanResult, repoUrl);

    // Create response with stream
    const response = new NextResponse(reportContent as any, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=security-report.txt",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });

    // Cleanup in background (fire and forget)
    setImmediate(() => {
      if (scanDir) {
        console.log(`[API] Cleaning up ${scanDir}`);
        cleanupDirectory(scanDir).catch(console.error);
      }
    });

    return response;
  } catch (err) {
    console.error("[API] Scan error:", err);

    if (scanDir) {
      await cleanupDirectory(scanDir);
    }

    return NextResponse.json(
      { error: "Scan failed: " + (err instanceof Error ? err.message : "Unknown error") },
      { status: 500 }
    );
  }
}
