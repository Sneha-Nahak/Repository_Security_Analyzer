"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import PDFViewer from "../../components/PDFViewer";
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
const DEMO_REPO = "https://github.com/octocat/Hello-World";

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
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const renderedReport = await (async () => {
        const renderFrame = document.createElement("iframe");
        renderFrame.setAttribute("aria-hidden", "true");
        renderFrame.title = "PDF rendering document";
        renderFrame.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0;pointer-events:none;";
        const frameReady = new Promise<void>((resolve, reject) => {
          renderFrame.onload = () => resolve();
          renderFrame.onerror = () => reject(new Error("Could not load the report for PDF rendering."));
        });
        renderFrame.srcdoc = data.reportHTML;
        document.body.appendChild(renderFrame);

        try {
          await frameReady;
          const reportDocument = renderFrame.contentDocument;
          const reportPage = reportDocument?.querySelector<HTMLElement>(".page");
          if (!reportDocument || !reportPage) {
            throw new Error("The report content could not be prepared for PDF rendering.");
          }
          await reportDocument.fonts.ready;
          const pageBounds = reportPage.getBoundingClientRect();
          const pageWidth = pageBounds.width;
          const cssBreakPoints = Array.from(reportPage.querySelectorAll<HTMLElement>(".header, .overview, .severity-bar, .finding, .empty-state, .footer"))
            .map((element) => element.getBoundingClientRect().bottom - pageBounds.top)
            .sort((a, b) => a - b);
          const canvas = await html2canvas(reportPage, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#0A0E17",
            windowWidth: 900,
            windowHeight: 1200,
          });
          const scale = canvas.width / pageWidth;
          return {
            canvas,
            safeBreakPoints: cssBreakPoints.map((point) => Math.round(point * scale)),
          };
        } finally {
          renderFrame.remove();
        }
      })();

      const { canvas, safeBreakPoints } = renderedReport;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const pixelsPerMm = canvas.width / contentWidth;
      const maxSliceHeight = Math.floor(contentHeight * pixelsPerMm);

      let startY = 0;
      let pageNumber = 0;
      while (startY < canvas.height) {
        const maxEndY = Math.min(startY + maxSliceHeight, canvas.height);
        let endY = maxEndY;
        if (maxEndY < canvas.height) {
          const minEndY = startY + Math.floor(maxSliceHeight * 0.58);
          const possibleBreaks = safeBreakPoints.filter((point) => point >= minEndY && point <= maxEndY);
          if (possibleBreaks.length > 0) endY = possibleBreaks[possibleBreaks.length - 1];
        }

        const sliceHeight = endY - startY;
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const context = pageCanvas.getContext("2d");
        if (!context) throw new Error("Could not prepare a PDF page.");
        context.drawImage(canvas, 0, startY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        if (pageNumber > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, contentWidth, sliceHeight / pixelsPerMm);
        startY = endY;
        pageNumber += 1;
      }

      pdf.save("security-report-" + data.repo.replace("https://github.com/", "").replace("/", "-") + ".pdf");
      addLogs(["PDF report downloaded", "success"]);
    } catch (err) {
      addLogs(["Failed to generate PDF", "error"]);
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
    <div className="scanner-page">
      <main id="main-content" className="dashboard-main" tabIndex={-1}>
        <div className="dashboard-intro">
          <div className="dashboard-intro-copy">
            <p className="dashboard-eyebrow">REPOSITORY SECURITY</p>
            <h1>GitHub Repository Security Scanner</h1>
            <p>Scan public GitHub repositories for exposed secrets and known dependency vulnerabilities with static analysis and clear security reports.</p>
          </div>
          <div className="workspace-status"><span className="workspace-status-dot" />On-demand analysis</div>
        </div>
        <div className={"dashboard-grid " + (hasResult ? "has-results" : "")}>
          {/* New scan + score + summary */}
          <section className={"dashboard-panel scan-panel " + (hasResult ? "has-result" : "")}>
            <h2 className="panel-title">New scan</h2>

            <form onSubmit={onSubmit}>
              <div>
                <label htmlFor="repo-url" className="mb-2 block text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-navy)" }}>
                  Repository URL
                </label>
                <input
                  id="repo-url"
                  type="url"
                  inputMode="url"
                  aria-describedby={state === "error" && error ? "scan-error" : undefined}
                  autoComplete="off"
                  placeholder="https://github.com/user/repo"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    if (state === "error") { setState("idle"); setError(""); }
                  }}
                  disabled={busy}
                  className="repo-input w-full px-4 py-3 disabled:opacity-50"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-bg-input)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-action)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                />
              </div>

              <button type="submit" disabled={busy} className="button-primary w-full px-4 py-3 font-bold text-white">
                {busy ? "Scanning…" : "Scan Repository"}
              </button>

              <button
                type="button"
                onClick={() => void runScan(DEMO_REPO)}
                disabled={busy}
                className="button-secondary w-full px-4 py-3 font-semibold disabled:opacity-50"
                style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
              >
                Test Demo
              </button>

              {hasResult && (
                <div className="report-download-actions">
                  <button type="button" onClick={downloadAIReport} className="button-secondary button-ai-prompt w-full px-4 py-3 font-semibold">
                    Download AI Prompt
                  </button>
                  <button type="button" onClick={downloadPDF} className="button-primary w-full px-4 py-3 font-semibold text-white">
                    Download PDF Report
                  </button>
                </div>
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
              {hasResult && <p className="text-sm font-semibold" style={{ color: "#10B981" }}>Scan completed</p>}
              {state === "error" && error && (
                <div role="alert" className="rounded border-l-4 border-red-500 p-4 text-sm text-red-700" style={{ backgroundColor: "#351823" }}>
                  <p className="mb-1 font-semibold">Error</p>
                  <p id="scan-error" className="break-words text-xs">{error}</p>
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
                    <div
                      className="mb-4 h-4 w-full overflow-hidden rounded-full"
                      role="progressbar"
                      aria-label="Security score out of 100"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={result.score}
                      aria-valuetext={`${result.score} out of 100, grade ${result.grade}`}
                      style={{ backgroundColor: "var(--color-border)" }}
                    >
                      <div aria-hidden="true" className={`h-full transition-all ${tone.bar}`} style={{ width: `${result.score}%` }} />
                    </div>
                    <p className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>{tone.label}</p>
                    <p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      Coverage {result.coverage}%
                      {result.summary.cleanPackagesPct !== null && ` · ${result.summary.cleanPackagesPct}% of ${result.summary.packagesChecked} packages clean`}
                    </p>
                    {result.provisional && (
                      <p className="mt-2 inline-block rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#342B16", color: "#FBBF24" }}>
                        Provisional: some checks could not run
                      </p>
                    )}
                    {result.capReason && <p className="mt-2 text-xs" style={{ color: "#FBBF24" }}>Capped because {result.capReason}.</p>}
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
          <section className="dashboard-panel findings-panel">
            <div className="findings-head"><h2 className="panel-title">Security findings</h2></div>
            {data && findings.length > 0 && (
              <p className="findings-count">
                {data.findingsTotal} issue{data.findingsTotal === 1 ? "" : "s"} detected
                {data.findingsTotal > findings.length && ` (showing ${findings.length})`}
              </p>
            )}

            {findings.length === 0 ? (
              <div className="empty-state flex items-center justify-center text-center" role="status" aria-live="polite">
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
              <ul className="finding-list space-y-3 overflow-y-auto">
                {findings.map((f, i) => {
                  const style = SEVERITIES.find((s) => s.key === f.severity)!;
                  return (
                    <li key={i} className="finding-card">
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
          <section className={"dashboard-panel activity-panel " + (hasResult ? "has-result" : "")}>
            <h2 className="mb-2 text-xl font-bold" style={{ color: "white" }}>Activity Log</h2>
            <p className="mb-6 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>Real-time Scan Execution</p>

            <div className="activity-log-frame" role="group" aria-label="Scan activity log">
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
                        onClick={downloadReport}
                        className="hidden rounded px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 md:inline-block"
                        style={{ backgroundColor: "#3B82F6" }}
                        title="Download the human-readable text report"
                      >
                        Text Report
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
                        aria-expanded={showMoreMenu}
                        aria-controls="report-more-options"
                        aria-label="More report options"
                      >
                        ⋮
                      </button>
                      {showMoreMenu && (
                        <div id="report-more-options" role="group" aria-label="Report actions" className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-10" style={{ border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-card)" }}>
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
                              downloadReport();
                              setShowMoreMenu(false);
                            }}
                            className="block w-full px-4 py-2 text-left text-sm last:rounded-b-lg transition"
                            style={{ color: "var(--color-text-primary)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-input)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            Download Text Report
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button type="button" onClick={() => setLogs([])} aria-label="Clear activity log" className="rounded border px-3 py-1.5 text-xs transition" style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)", backgroundColor: "var(--color-bg-card)" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-input)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--color-bg-card)")}>
                    Clear
                  </button>
                </div>
              </div>
              <div ref={logBoxRef} role="log" aria-live="polite" aria-relevant="additions" aria-busy={busy} className="activity-log-output h-64 space-y-2 overflow-y-auto p-4 font-mono text-sm sm:h-80 sm:space-y-1 sm:p-6" style={{ backgroundColor: "var(--color-bg-card)", color: "var(--color-text-primary)" }}>
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
