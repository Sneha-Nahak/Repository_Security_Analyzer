"use client";

import { useState, useEffect, useRef } from "react";

type ScanState = "idle" | "cloning" | "scanning" | "compiling" | "complete" | "error";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

interface Finding {
  type: string;
  severity: "critical" | "high" | "moderate" | "low";
  file: string;
  line: number;
  description: string;
  match?: string;
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [state, setState] = useState<ScanState>("idle");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [score, setScore] = useState(0);
  const [reportData, setReportData] = useState<string>("");
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: string, level: "info" | "warn" | "error" | "success" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, level, message }]);
  };

  const getSeverityColors = (severity: string) => {
    switch(severity) {
      case "critical":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "moderate":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const downloadReport = () => {
    if (!reportData) return;
    const blob = new Blob([reportData], { type: "text/plain" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "security-report.txt";
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    addLog("📥 Report downloaded manually", "success");
  };

  const handleScan = async (e: React.FormEvent, isTestScan = false) => {
    e.preventDefault();
    const url = isTestScan ? "" : repoUrl;
    
    if (!isTestScan && !url.trim()) {
      setError("Please enter a repository URL");
      addLog("❌ Empty repository URL", "error");
      return;
    }

    setLogs([]);
    setFindings([]);
    setScore(0);
    setError("");

    try {
      if (isTestScan) {
        addLog(`📍 Starting TEST scan with vulnerable code`, "info");
        const response = await fetch("/api/scan-local");
        if (!response.ok) throw new Error("Test scan failed");
        const data = await response.json();
        setReportData(JSON.stringify(data, null, 2));
        setFindings(data.findings || []);
        setScore(data.score || 0);
        addLog(`✅ Test scan complete! Found ${data.findings?.length || 0} issues`, "success");
        addLog(`📈 Security Score: ${data.score}/100`, data.score >= 70 ? "success" : data.score >= 50 ? "warn" : "error");
        setState("complete");
      } else {
        addLog(`📍 Starting scan for: ${url}`, "info");
        setState("cloning");
        addLog("🔄 Cloning repository...", "info");

        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl: url }),
        });

        setState("scanning");
        addLog("🔍 Running security analysis...", "info");

        if (!response.ok) {
          try {
            const data = await response.json();
            throw new Error(data.error || "Scan failed");
          } catch (parseErr) {
            throw new Error("Scan failed with status " + response.status);
          }
        }

        setState("compiling");
        addLog("📊 Compiling report...", "info");

        const reportText = await response.text();
        setReportData(reportText);
        const parsedFindings = parseReportForFindings(reportText);
        const parsedScore = parseReportForScore(reportText);

        setFindings(parsedFindings);
        setScore(parsedScore);

        addLog(`✅ Scan complete! Found ${parsedFindings.length} issues`, "success");
        addLog(`📈 Security Score: ${parsedScore}/100`, parsedScore >= 70 ? "success" : parsedScore >= 50 ? "warn" : "error");

        const blob = new Blob([reportText], { type: "text/plain" });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "security-report.txt";
        a.click();
        window.URL.revokeObjectURL(downloadUrl);

        addLog("📥 Report downloaded", "success");
        setState("complete");
        setRepoUrl("");
      }
    } catch (err) {
      setState("error");
      const errMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errMsg);
      addLog(`❌ ${errMsg}`, "error");
    }
  };

  const parseReportForScore = (text: string): number => {
    const match = text.match(/Security Score: (\d+)\/100/);
    return match ? parseInt(match[1]) : 0;
  };

  const parseReportForFindings = (text: string): Finding[] => {
    const findings: Finding[] = [];
    const detailedSection = text.match(/DETAILED FINDINGS\n-+\n([\s\S]*?)DEPENDENCY ANALYSIS/);
    if (!detailedSection) return findings;

    const lines = detailedSection[1].split("\n");
    let currentFinding: Partial<Finding> | null = null;

    for (const line of lines) {
      const numMatch = line.match(/^\d+\. \[(.+?)\] (.+)$/);
      if (numMatch) {
        if (currentFinding) findings.push(currentFinding as Finding);
        currentFinding = { severity: numMatch[1].toLowerCase() as any, type: numMatch[2] };
      } else if (line.includes("File:") && currentFinding) {
        const fileMatch = line.match(/File: (.+):(\d+)/);
        if (fileMatch) {
          currentFinding.file = fileMatch[1];
          currentFinding.line = parseInt(fileMatch[2]);
        }
      } else if (line.includes("Issue:") && currentFinding) {
        currentFinding.description = line.replace(/\s*Issue:\s*/, "");
      }
    }

    if (currentFinding) findings.push(currentFinding as Finding);
    return findings;
  };

  const stateMessages: Record<ScanState, string> = {
    idle: "Ready to scan",
    cloning: "Cloning project...",
    scanning: "Analyzing code...",
    compiling: "Generating report...",
    complete: "Scan completed",
    error: "Scan failed",
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-blue-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white px-8 py-8">
        <h1 className="text-4xl font-bold">Repository Security Analyzer</h1>
        <p className="text-blue-200 mt-2 text-lg">On-Demand Security Check</p>
      </header>

      {/* Main Content */}
      <main className="px-2 py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Left Sidebar - New Scan Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-wider">New Scan</h2>

              <form onSubmit={(e) => handleScan(e, false)} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Repository URL</label>
                  <input
                    type="url"
                    placeholder="https://github.com/user/repo"
                    value={repoUrl}
                    onChange={(e) => { setRepoUrl(e.target.value); if (state === "error") setError(""); }}
                    disabled={state !== "idle" && state !== "complete" && state !== "error"}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 disabled:opacity-50 focus:outline-none focus:border-blue-500 transition text-sm"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={state !== "idle" && state !== "complete" && state !== "error"} 
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold rounded-lg transition"
                >
                  Scan Repository
                </button>

                <button 
                  type="button" 
                  onClick={(e) => handleScan(e as any, true)} 
                  disabled={state !== "idle" && state !== "complete" && state !== "error"} 
                  className="w-full px-4 py-3 bg-white border-2 border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-900 font-semibold rounded-lg transition"
                >
                  Test Demo
                </button>

                {state === "complete" && reportData && (
                  <button 
                    type="button" 
                    onClick={downloadReport} 
                    className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition mt-4"
                  >
                    📥 Download Report
                  </button>
                )}
              </form>

              <div className="h-px bg-gray-200 my-6"></div>

              {state !== "idle" && (
                <div className="mb-6">
                  <div className="flex items-center gap-3">
                    {state !== "error" && state !== "complete" ? (
                      <>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                        </div>
                        <span className="text-sm text-gray-700 font-medium">{stateMessages[state]}</span>
                      </>
                    ) : (
                      <span className={`text-sm font-semibold ${state === "error" ? "text-red-600" : "text-green-600"}`}>{stateMessages[state]}</span>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded text-sm">
                  <p className="font-semibold mb-1">Error</p>
                  <p className="text-xs">{error}</p>
                </div>
              )}

              {score > 0 && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Security Score</p>
                    <div className="bg-orange-50 rounded-xl p-6 border-2 border-orange-100">
                      <div className="flex items-baseline gap-2 mb-4">
                        <div className="text-5xl font-bold text-red-500">{score}</div>
                        <div className="text-sm text-gray-600 font-semibold">/ 100</div>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden mb-4">
                        <div 
                          className={`h-full transition-all ${score >= 70 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"}`} 
                          style={{ width: `${score}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 font-semibold">{score >= 70 ? "Secure" : score >= 50 ? "At Risk" : "Critical Issues"}</p>
                    </div>
                  </div>

                  {findings.length > 0 && (
                    <div>
                      <p className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Summary</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-red-50 border-2 border-red-100 p-4 rounded-xl text-center">
                          <div className="text-4xl font-bold text-red-600">{findings.filter(f => f.severity === "critical").length}</div>
                          <div className="text-xs text-gray-600 mt-2 font-semibold">Critical</div>
                        </div>
                        <div className="bg-orange-50 border-2 border-orange-100 p-4 rounded-xl text-center">
                          <div className="text-4xl font-bold text-orange-600">{findings.filter(f => f.severity === "high").length}</div>
                          <div className="text-xs text-gray-600 mt-2 font-semibold">High</div>
                        </div>
                        <div className="bg-yellow-50 border-2 border-yellow-100 p-4 rounded-xl text-center">
                          <div className="text-4xl font-bold text-yellow-600">{findings.filter(f => f.severity === "moderate").length}</div>
                          <div className="text-xs text-gray-600 mt-2 font-semibold">Medium</div>
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-100 p-4 rounded-xl text-center">
                          <div className="text-4xl font-bold text-blue-600">{findings.filter(f => f.severity === "low").length}</div>
                          <div className="text-xs text-gray-600 mt-2 font-semibold">Low</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Findings Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-8 shadow-lg h-full">
              <h2 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wider">Security Findings</h2>
              {findings.length > 0 && <p className="text-sm text-gray-600 mb-6">{findings.length} issue{findings.length !== 1 ? 's' : ''} detected</p>}
              
              {findings.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-400 text-center">
                    <span className="block mb-2">Security finding window is empty.</span>
                    <span>Nothing to show now.</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {findings.map((finding, idx) => (
                    <div key={idx} className="border-b border-gray-200 pb-4 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{finding.type}</h3>
                          <p className="text-sm text-gray-600 mt-1">{finding.description}</p>
                          <div className="flex gap-2 text-xs mt-2">
                            <span className="font-mono text-gray-500">{finding.file}:{finding.line}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${getSeverityColors(finding.severity)}`}>{finding.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom - Activity Log */}
        <div className="bg-gray-700 rounded-2xl p-8 shadow-lg">
          <h2 className="text-xl font-bold text-white mb-2">Activity Log</h2>
          <p className="text-gray-300 text-sm mb-6">Real-time Scan Execution</p>
          
          <div className="bg-white rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Logs</p>
              <div className="flex gap-2">
                {state === "complete" && reportData && (
                  <button 
                    type="button" 
                    onClick={downloadReport} 
                    className="text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded transition"
                  >
                    📥 Download
                  </button>
                )}
                <button onClick={() => setLogs([])} className="text-xs px-3 py-1.5 hover:bg-gray-200 text-gray-600 rounded transition border border-gray-300">Clear</button>
              </div>
            </div>
            <div className="h-80 overflow-y-auto font-mono text-sm space-y-1 p-6 bg-white">
              {logs.length === 0 ? (
                <p className="text-gray-400">Logs will appear here...</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex gap-4">
                    <span className="text-gray-400 flex-shrink-0 font-semibold">{log.timestamp}</span>
                    <span className={log.level === "info" ? "text-gray-600" : log.level === "warn" ? "text-yellow-700" : log.level === "error" ? "text-red-700" : "text-green-700"}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
