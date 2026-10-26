import { NextResponse } from "next/server";
import { performScan } from "@/lib/scanner";
import path from "path";

export async function GET() {
  try {
    // Scan the test-repo directory locally
    const testRepoPath = path.join(process.cwd(), "test-repo");
    
    console.log(`[LOCAL_TEST] Scanning test repo at ${testRepoPath}`);
    
    const result = await performScan(testRepoPath);

    return NextResponse.json({
      status: "scan complete",
      path: testRepoPath,
      vulnerabilities: result.vulnerabilities,
      score: result.score,
      summary: {
        total: result.vulnerabilities.length,
        critical: result.dependencies.critical,
        high: result.dependencies.high,
        medium: result.dependencies.medium,
        low: result.dependencies.low,
      },
      findings: result.vulnerabilities.map(v => ({
        type: v.type,
        severity: v.severity,
        file: v.file,
        line: v.line,
        description: v.description,
        match: v.match,
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
