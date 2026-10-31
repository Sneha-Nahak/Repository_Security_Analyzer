"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import PDFViewer from "../components/PDFViewer";
import type { Severity } from "@/lib/patterns";
import type { Finding, ScanResult } from "@/lib/scanner";

type ScanState = "idle" | "scanning" | "complete" | "error";
type LogLevel = "info" | "warn" | "error" | "success";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

/** Shape returned by POST /api/scan. */
interface ScanResponse {
  repo: string;
  result: ScanResult;
  findingsTotal: number;
  report: string;
  reportAI: string;
  reportHTML: string;
}

/** Public repo used by the "Test Demo" button. Change it to any public repo. */
const DEMO_REPO = "https://github.com/Sneha-Nahak/soulartistics_website";

const SEVERITIES: Array<{ key: Severity; label: string; box: string; text: string; pill: string }> = [
  { key: "critical", label: "Critical", box: "bg-red-50 border-red-100", text: "text-red-600", pill: "bg-red-100 text-red-700" },
  { key: "high", label: "High", box: "bg-orange-50 border-orange-100", text: "text-orange-600", pill: "bg-orange-100 text-orange-700" },
  { key: "medium", label: "Medium", box: "bg-yellow-50 border-yellow-100", text: "text-yellow-600", pill: "bg-yellow-100 text-yellow-700" },
  { key: "low", label: "Low", box: "bg-blue-50 border-blue-100", text: "text-blue-600", pill: "bg-blue-100 text-blue-700" },
];

const LOG_COLORS: Record<LogLevel, string> = {
  info: "text-slate-600",
  warn: "text-orange-700",
  error: "text-red-700",
  success: "text-green-700",
};

const CHECK_LEVEL = { ok: "success", partial: "warn", failed: "error", skipped: "info" } as const;

function scoreTone(score: number) {
  if (score >= 90) return { label: "Secure", bar: "bg-green-500", text: "text-green-600", card: "bg-green-50 border-green-100" };
  if (score >= 75) return { label: "Good", bar: "bg-blue-500", text: "text-blue-600", card: "bg-blue-50 border-blue-100" };
  if (score >= 60) return { label: "At Risk", bar: "bg-orange-500", text: "text-orange-600", card: "bg-orange-50 border-orange-100" };
  return { label: "Critical Issues", bar: "bg-red-500", text: "text-red-600", card: "bg-red-50 border-red-100" };
}

function severityCounts(result: ScanResult): Record<Severity, number> {
  const { secrets, dependencies } = result.summary;
  const total = {} as Record<Severity, number>;
  for (const { key } of SEVERITIES) {
    total[key] = secrets[key] + dependencies.production[key] + dependencies.dev[key];
  }
  return total;
}

function findingTitle(f: Finding): string {
  return f.category === "dependency" ? `${f.package}@${f.version}` : f.type;
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [state, setState] = useState<ScanState>("idle");
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [data, setData] = useState<ScanResponse | null>(null);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const busy = state === "scanning";
  const result = data?.result;
  const findings = result?.findings ?? [];
  const tone = result ? scoreTone(result.score) : null;
  const counts = result ? severityCounts(result) : null;
  // Once results exist the log tucks under the findings panel, as in the design.
  const hasResult = state === "complete" && !!result;

  useEffect(() => {
    const box = logBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [logs]);

  const addLogs = (...entries: Array<[string, LogLevel?]>) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, ...entries.map(([message, level = "info"]) => ({ timestamp, level, message }))]);
  };

  const downloadReport = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data.report], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-report-${data.repo.replace("https://github.com/", "").replace("/", "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLogs(["📥 Report downloaded (text format)", "success"]);
  };

  const downloadAIReport = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data.reportAI], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-report-ai-prompt-${data.repo.replace("https://github.com/", "").replace("/", "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLogs(["� AI prompt downloaded - feed this to ChatGPT/Claude for automatic fixes", "success"]);
  };

  const downloadPDF = async () => {
    if (!data) return;
    try {
      // Dynamically import jspdf and html2canvas
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const container = document.createElement("div");
      container.innerHTML = data.reportHTML;
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { useCORS: true, logging: false });
      document.body.removeChild(container);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      let heightLeft = canvas.height * imgWidth / canvas.width;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, heightLeft);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - canvas.height * imgWidth / canvas.width;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, heightLeft);
        heightLeft -= pageHeight;
      }

      pdf.save(`security-report-${data.repo.replace("https://github.com/", "").replace("/", "-")}.pdf`);
      addLogs(["📥 PDF report downloaded", "success"]);
    } catch (err) {
      addLogs(["❌ Failed to generate PDF", "error"]);
      console.error("PDF generation failed:", err);
    }
  };

  const runScan = async (url: string) => {
    if (!url.trim()) {
      setError("Please enter a repository URL");
      setState("error");
      addLogs(["❌ Empty repository URL", "error"]);
      return;
    }

    setState("scanning");
    setError("");
    setData(null);
    setLogs([]);
    addLogs([`📍 Starting scan for: ${url.trim()}`], ["⬇️ Downloading repository and scanning (usually under 20s)..."]);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url.trim() }),
      });

      let body: (Partial<ScanResponse> & { error?: string }) | null = null;
      try {
        body = await res.json();
      } catch {
        // Not JSON, e.g. a platform timeout page.
      }
      if (!res.ok || !body?.result) {
        throw new Error(body?.error ?? (res.status === 504 ? "The scan took too long. Try a smaller repository." : `Scan failed with status ${res.status}`));
      }

      const scan = body as ScanResponse;
      const { result: r } = scan;
      setData(scan);
      setState("complete");
      setShowPDFModal(true); // Auto-show PDF modal
      addLogs(
        ...r.checks.map((c): [string, LogLevel] => [`${c.name}: ${c.detail}`, CHECK_LEVEL[c.status]]),
        ...r.notes.map((n): [string, LogLevel] => [`⚠️ ${n}`, "warn"]),
        [`✅ Scan complete! Found ${scan.findingsTotal} issue${scan.findingsTotal === 1 ? "" : "s"}`, "success"],
        [
          `📈 Security Score: ${r.score}/100 · Coverage: ${r.coverage}%${r.provisional ? " (provisional)" : ""}`,
          r.score >= 75 ? "success" : r.score >= 60 ? "warn" : "error",
        ]
      );
      setRepoUrl("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setState("error");
      setError(message);
      addLogs([`❌ ${message}`, "error"]);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runScan(repoUrl);
  };

  return (
    <div style={{ backgroundColor: "var(--color-bg-page)", minHeight: "100vh" }}>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          {/* New scan + score + summary */}
          <section className={`min-w-0 rounded-2xl bg-white p-5 shadow-lg sm:p-8 ${hasResult ? "lg:row-span-2" : ""}`} style={{ border: "1px solid var(--color-border)" }}>
            <h2 className="mb-6 text-lg font-bold uppercase tracking-wider" style={{ color: "var(--color-navy)" }}>New Scan</h2>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="repo-url" className="mb-2 block text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-navy)" }}>
                  Repository URL
                </label>
                <input
                  id="repo-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://github.com/user/repo"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    if (state === "error") { setState("idle"); setError(""); }
                  }}
                  disabled={busy}
                  className="w-full rounded-lg border-2 px-4 py-3 text-sm transition focus:outline-none disabled:opacity-50"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-bg-input)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-action)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
              </div>

              <button type="submit" disabled={busy} className="w-full rounded-lg px-4 py-3 font-bold text-white transition" style={{ backgroundColor: "var(--color-action)" }}>
                {busy ? "Scanning…" : "Scan Repository"}
              </button>

              <button
                type="button"
                onClick={() => void runScan(DEMO_REPO)}
                disabled={busy}
                className="w-full rounded-lg border-2 bg-white px-4 py-3 font-semibold transition hover:bg-slate-50 disabled:opacity-50"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
              >
                Test Demo
              </button>

              {hasResult && (
                <button type="button" onClick={downloadReport} className="w-full rounded-lg px-4 py-3 font-semibold text-white transition" style={{ backgroundColor: "#16A34A" }}>
                  📥 Download Report
                </button>
              )}
            </form>

            {state !== "idle" && <div className="my-6 h-px" style={{ backgroundColor: "var(--color-border)" }} />}

            <div aria-live="polite">
              {busy && (
                <div className="flex items-center gap-3">
                  <div className="flex gap-1" aria-hidden>
                    {[0, 0.1, 0.2].map((delay) => (
                      <div key={delay} className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "var(--color-action)", animationDelay: `${delay}s` }} />
                    ))}
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Scanning repository...</span>
                </div>
              )}
              {hasResult && <p className="text-sm font-semibold" style={{ color: "#16A34A" }}>Scan completed</p>}
              {state === "error" && error && (
                <div role="alert" className="rounded border-l-4 border-red-500 p-4 text-sm text-red-700" style={{ backgroundColor: "#FEE2E2" }}>
                  <p className="mb-1 font-semibold">Error</p>
                  <p className="break-words text-xs">{error}</p>
                </div>
              )}
            </div>

            {hasResult && result && tone && counts && (
              <div className="mt-6 space-y-6">
                <div>
                  <p className="mb-4 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--color-navy)" }}>Security Score</p>
                  <div className={`rounded-xl border-2 p-5 sm:p-6 ${tone.card}`}>
                    <div className="mb-4 flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-5xl font-bold ${tone.text}`}>{result.score}</span>
                      <span className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>/ 100 · grade {result.grade}</span>
                    </div>
                    <div className="mb-4 h-4 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-border)" }}>
                      <div className={`h-full transition-all ${tone.bar}`} style={{ width: `${result.score}%` }} />
                    </div>
                    <p className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>{tone.label}</p>
                    <p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      Coverage {result.coverage}%
                      {result.summary.cleanPackagesPct !== null && ` · ${result.summary.cleanPackagesPct}% of ${result.summary.packagesChecked} packages clean`}
                    </p>
                    {result.provisional && (
                      <p className="mt-2 inline-block rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#FEFCE8", color: "#854D0E" }}>
                        Provisional: some checks could not run
                      </p>
                    )}
                    {result.capReason && <p className="mt-2 text-xs" style={{ color: "#EA580C" }}>Capped because {result.capReason}.</p>}
                  </div>
                </div>

                <div>
                  <p className="mb-4 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--color-navy)" }}>Summary</p>
                  <div className="grid grid-cols-2 gap-3">
                    {SEVERITIES.map((s) => (
                      <div key={s.key} className={`rounded-xl border-2 p-4 text-center ${s.box}`}>
                        <div className={`text-3xl font-bold sm:text-4xl ${s.text}`}>{counts[s.key]}</div>
                        <div className="mt-2 text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Findings */}
          <section className="min-w-0 rounded-2xl bg-white p-5 shadow-lg sm:p-8 lg:col-span-2" style={{ border: "1px solid var(--color-border)" }}>
            <h2 className="mb-2 text-lg font-bold uppercase tracking-wider" style={{ color: "var(--color-navy)" }}>Security Findings</h2>
            {data && findings.length > 0 && (
              <p className="mb-6 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {data.findingsTotal} issue{data.findingsTotal === 1 ? "" : "s"} detected
                {data.findingsTotal > findings.length && ` (showing ${findings.length})`}
              </p>
            )}

            {findings.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-center sm:h-64" style={{ color: "var(--color-text-secondary)" }}>
                <p>
                  {hasResult ? (
                    "No issues found in what was checked."
                  ) : (
                    <>
                      <span className="mb-2 block">Security finding window is empty.</span>
                      <span>Nothing to show now.</span>
                    </>
                  )}
                </p>
              </div>
            ) : (
              <ul className="max-h-96 space-y-4 overflow-y-auto pr-1">
                {findings.map((f, i) => {
                  const style = SEVERITIES.find((s) => s.key === f.severity)!;
                  return (
                    <li key={i} className="pb-4 last:border-b-0" style={{ borderBottom: `1px solid var(--color-border)` }}>
                      <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold" style={{ color: "var(--color-navy)" }}>{findingTitle(f)}</h3>
                          <p className="mt-1 break-words text-sm" style={{ color: "var(--color-text-primary)" }}>{f.description}</p>
                          <p className="mt-2 break-all font-mono text-xs" style={{ color: "var(--color-text-secondary)" }}>
                            {f.line > 0 ? `${f.file}:${f.line}` : f.file}
                            {f.occurrences > 1 && ` (+${f.occurrences - 1} more)`}
                            {f.scope === "dev" && " · dev-only"}
                            {f.match && ` · ${f.match}`}
                          </p>
                        </div>
                        <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${style.pill}`}>{f.severity}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Activity log: full width until a result exists, then under the findings */}
          <section className={`min-w-0 rounded-2xl p-5 shadow-lg sm:p-8 ${hasResult ? "lg:col-span-2" : "lg:col-span-3"}`} style={{ backgroundColor: "var(--color-primary)", border: "1px solid var(--color-border)" }}>
            <h2 className="mb-2 text-xl font-bold" style={{ color: "white" }}>Activity Log</h2>
            <p className="mb-6 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>Real-time Scan Execution</p>

            <div className="overflow-hidden rounded-lg">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-6 sm:py-4" style={{ backgroundColor: "var(--color-bg-input)", borderColor: "var(--color-border)" }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-navy)" }}>Logs</p>
                <div className="flex gap-2">
                  {/* Buttons hidden on mobile, shown on sm+ */}
                  {hasResult && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowPDFModal(true)}
                        className="hidden rounded px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 sm:inline-block"
                        style={{ backgroundColor: "#3B82F6" }}
                      >
                        👁️ Preview
                      </button>
                      <button
                        type="button"
                        onClick={downloadPDF}
                        className="hidden rounded px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 md:inline-block"
                        style={{ backgroundColor: "#9333EA" }}
                        title="Download PDF for manual review and fixing"
                      >
                        📥 PDF
                      </button>
                      <button
                        type="button"
                        onClick={downloadAIReport}
                        className="hidden rounded px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 lg:inline-block"
                        style={{ backgroundColor: "#6366F1" }}
                        title="Download text format optimized for feeding to ChatGPT/Claude for automatic fixes"
                      >
                        📋 AI Prompt
                      </button>
                    </>
                  )}
                  
                  {/* Dropdown menu for mobile - shown when has result */}
                  {hasResult && (
                    <div className="relative" ref={moreMenuRef}>
                      <button
                        type="button"
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className="sm:hidden rounded border px-2 py-1.5 text-xs font-semibold transition"
                        style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg-card)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-input)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-card)")}
                        aria-label="More options"
                      >
                        ⋮
                      </button>
                      {showMoreMenu && (
                        <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-10" style={{ border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-card)" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPDFModal(true);
                              setShowMoreMenu(false);
                            }}
                            className="block w-full px-4 py-2 text-left text-sm first:rounded-t-lg transition"
                            style={{ color: "var(--color-text-primary)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-input)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            👁️ Show Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              downloadPDF();
                              setShowMoreMenu(false);
                            }}
                            className="block w-full px-4 py-2 text-left text-sm transition"
                            style={{ color: "var(--color-text-primary)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-input)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            📥 Download PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              downloadAIReport();
                              setShowMoreMenu(false);
                            }}
                            className="block w-full px-4 py-2 text-left text-sm last:rounded-b-lg transition"
                            style={{ color: "var(--color-text-primary)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-input)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            📋 AI Prompt
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button type="button" onClick={() => setLogs([])} className="rounded border px-3 py-1.5 text-xs transition" style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg-card)" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-input)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-card)")}>
                    Clear
                  </button>
                </div>
              </div>
              <div ref={logBoxRef} className="h-64 space-y-2 overflow-y-auto p-4 font-mono text-sm sm:h-80 sm:space-y-1 sm:p-6" style={{ backgroundColor: "var(--color-bg-card)", color: "var(--color-text-primary)" }}>
                {logs.length === 0 ? (
                  <p style={{ color: "var(--color-text-secondary)" }}>Logs will appear here...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:gap-4">
                      <span className="shrink-0 font-semibold" style={{ color: "var(--color-text-secondary)" }}>{log.timestamp}</span>
                      <span className={`break-words ${LOG_COLORS[log.level]}`}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* PDF Viewer Modal */}
      {data && <PDFViewer htmlContent={data.reportHTML} isOpen={showPDFModal} onClose={() => setShowPDFModal(false)} />}
    </div>
  );
}