import type { ScanResult } from "./scanner";

/**
 * Converts a security report into polished HTML suitable for PDF rendering.
 * Used with client-side jspdf/html2pdf for PDF generation.
 */
export function convertReportToHTML(report: string, result: ScanResult): string {
  const secrets = result.findings.filter((f) => f.category === "secret");
  const deps = result.findings.filter((f) => f.category === "dependency");
  const s = result.summary;

  const getSecurityColor = (score: number) => {
    if (score >= 90) return "#4ade80"; // green
    if (score >= 75) return "#facc15"; // yellow
    if (score >= 50) return "#fb923c"; // orange
    return "#ef4444"; // red
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "#dc2626";
      case "high":
        return "#ea580c";
      case "moderate":
        return "#ca8a04";
      case "low":
        return "#2563eb";
      default:
        return "#6b7280";
    }
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Scan Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: white;
      padding: 40px;
    }
    
    .page {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      background: white;
    }
    
    .header {
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 10px;
    }
    
    .header p {
      font-size: 12px;
      color: #6b7280;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .overview {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .overview-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    
    .overview-card .value {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .overview-card .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .score-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      color: white;
      background: ${getSecurityColor(result.score)};
      margin-bottom: 10px;
    }
    
    .severity-bar {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 15px;
      margin: 15px 0;
    }
    
    .bar-item {
      flex: 1;
    }
    
    .bar-label {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
    }
    
    .bar {
      height: 24px;
      border-radius: 4px;
      background: #e5e7eb;
      overflow: hidden;
    }
    
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, currentColor, currentColor);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 11px;
      font-weight: 600;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    .severity-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: white;
    }
    
    .finding {
      background: #fafbfc;
      border-left: 4px solid #e5e7eb;
      padding: 15px;
      margin: 12px 0;
      border-radius: 4px;
    }
    
    .finding.critical {
      border-left-color: #dc2626;
      background: #fee2e2;
    }
    
    .finding.high {
      border-left-color: #ea580c;
      background: #fed7aa;
    }
    
    .finding.moderate {
      border-left-color: #ca8a04;
      background: #fef3c7;
    }
    
    .finding.low {
      border-left-color: #2563eb;
      background: #dbeafe;
    }
    
    .finding-title {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
      font-weight: 700;
    }
    
    .finding-detail {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 4px 0;
      font-size: 12px;
    }
    
    .finding-detail-label {
      flex: 0 0 80px;
      min-width: 80px;
      color: #4b5563;
      font-weight: 600;
    }
    
    .finding-detail-value {
      min-width: 0;
      color: #1f2937;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    
    .empty-state {
      background: #f0fdf4;
      border: 1px solid #dcfce7;
      border-radius: 6px;
      padding: 20px;
      text-align: center;
      color: #15803d;
      font-size: 13px;
    }
    
    .remediation-steps {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 15px;
      margin-top: 10px;
    }
    
    .remediation-steps ol {
      margin-left: 20px;
      margin-top: 10px;
    }
    
    .remediation-steps li {
      margin: 8px 0;
      font-size: 13px;
    }
    
    .code {
      background: #1f2937;
      color: #e5e7eb;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      display: inline-block;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    
    @media (max-width: 760px) {
      body { padding: 20px 16px; }
      .header { margin-bottom: 24px; }
      .header h1 { font-size: 24px; }
      .section { margin-bottom: 24px; }
      .overview { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .overview-card { padding: 12px 10px; }
      .overview-card .value { font-size: 22px; }
      .severity-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .finding { padding: 12px; }
      .code { max-width: 100%; overflow-wrap: anywhere; }
    }

    @media (max-width: 420px) {
      body { padding: 16px 12px; }
      .header h1 { font-size: 22px; }
      .section-title { font-size: 15px; }
      .severity-bar { grid-template-columns: minmax(0, 1fr); gap: 10px; }
      .finding-detail { flex-direction: column; gap: 2px; }
      .finding-detail-label { flex: 0 0 auto; min-width: 0; }
    }
    @media print {
      body {
        padding: 0;
      }
      .page-break {
        page-break-after: always;
      }
    }
    body, .page { background: #0A0E17 !important; color: #D6DFEA !important; }
    .header { border-bottom-color: #3B82F6 !important; }
    .header h1, .section-title, .finding-title, th { color: #E6EDF7 !important; }
    .header p, .overview-card .label, .footer { color: #9AA8BA !important; }
    .overview-card { background: #1E2533 !important; border-color: #303A4B !important; }
    .score-badge { background: #3B82F6 !important; color: #fff !important; }
    .bar { background: #303A4B !important; }
    .bar-label { color: #D6DFEA !important; }
    .severity-bar .bar-item:nth-child(1) .bar-label,
    .severity-bar .bar-item:nth-child(1) .bar-fill { color: #E11D48 !important; }
    .severity-bar .bar-item:nth-child(2) .bar-label,
    .severity-bar .bar-item:nth-child(2) .bar-fill { color: #FB7185 !important; }
    .severity-bar .bar-item:nth-child(3) .bar-label,
    .severity-bar .bar-item:nth-child(3) .bar-fill { color: #FBBF24 !important; }
    .severity-bar .bar-item:nth-child(4) .bar-label,
    .severity-bar .bar-item:nth-child(4) .bar-fill { color: #3B82F6 !important; }
    th { background: #1E2533 !important; border-color: #303A4B !important; }
    td { color: #D6DFEA !important; border-color: #303A4B !important; }
    .finding { background: #1E2533 !important; border-left-color: #46546B !important; }
    .finding.critical { background: rgba(225,29,72,.15) !important; border-left-color: #E11D48 !important; }
    .finding.high { background: rgba(225,29,72,.10) !important; border-left-color: #FB7185 !important; }
    .finding.medium, .finding.moderate { background: rgba(251,191,36,.11) !important; border-left-color: #FBBF24 !important; }
    .finding.low { background: rgba(59,130,246,.12) !important; border-left-color: #3B82F6 !important; }
    .severity-badge { color: #0A0E17 !important; }
    .finding.critical .severity-badge { background: #E11D48 !important; color: #fff !important; }
    .finding.high .severity-badge { background: #FB7185 !important; color: #0A0E17 !important; }
    .finding.medium .severity-badge, .finding.moderate .severity-badge { background: #FBBF24 !important; color: #0A0E17 !important; }
    .finding.low .severity-badge { background: #3B82F6 !important; color: #fff !important; }
    .finding-detail-label { color: #A8B5C8 !important; }
    .finding-detail-value { color: #D6DFEA !important; }
    .empty-state { background: rgba(16,185,129,.11) !important; border-color: rgba(16,185,129,.3) !important; color: #6EE7B7 !important; }
    .remediation-steps { background: rgba(59,130,246,.11) !important; border-color: rgba(59,130,246,.3) !important; color: #D6DFEA !important; }
    .code { background: #0A0E17 !important; color: #D6DFEA !important; }
    .footer { border-top-color: #303A4B !important; }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <h1>Security Scan Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <!-- Overview Section -->
    <div class="section">
      <div class="section-title">Overview</div>
      <div class="score-badge">Security Score: ${result.score}/100</div>
      
      <div class="overview">
        <div class="overview-card">
          <div class="value">${result.score}</div>
          <div class="label">Score</div>
        </div>
        <div class="overview-card">
          <div class="value">${result.grade}</div>
          <div class="label">Grade</div>
        </div>
        <div class="overview-card">
          <div class="value">${result.coverage}%</div>
          <div class="label">Coverage</div>
        </div>
        <div class="overview-card">
          <div class="value">${result.findings.length}</div>
          <div class="label">Total Issues</div>
        </div>
      </div>
      
      <div class="severity-bar">
        <div class="bar-item">
          <div class="bar-label" style="color: #dc2626;">
            <span>Critical</span>
            <span>${s.secrets.critical + s.dependencies.production.critical}</span>
          </div>
          <div class="bar">
            <div class="bar-fill" style="color: #dc2626; width: ${Math.min(100, ((s.secrets.critical + s.dependencies.production.critical) / Math.max(1, result.findings.length)) * 100)}%;">
            </div>
          </div>
        </div>
        <div class="bar-item">
          <div class="bar-label" style="color: #ea580c;">
            <span>High</span>
            <span>${s.secrets.high + s.dependencies.production.high}</span>
          </div>
          <div class="bar">
            <div class="bar-fill" style="color: #ea580c; width: ${Math.min(100, ((s.secrets.high + s.dependencies.production.high) / Math.max(1, result.findings.length)) * 100)}%;">
            </div>
          </div>
        </div>
        <div class="bar-item">
          <div class="bar-label" style="color: #ca8a04;">
            <span>Medium</span>
            <span>${s.secrets.medium + s.dependencies.production.medium}</span>
          </div>
          <div class="bar">
            <div class="bar-fill" style="color: #ca8a04; width: ${Math.min(100, ((s.secrets.medium + s.dependencies.production.medium) / Math.max(1, result.findings.length)) * 100)}%;">
            </div>
          </div>
        </div>
        <div class="bar-item">
          <div class="bar-label" style="color: #2563eb;">
            <span>Low</span>
            <span>${s.secrets.low + s.dependencies.production.low}</span>
          </div>
          <div class="bar">
            <div class="bar-fill" style="color: #2563eb; width: ${Math.min(100, ((s.secrets.low + s.dependencies.production.low) / Math.max(1, result.findings.length)) * 100)}%;">
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Secrets Section -->
    <div class="section">
      <div class="section-title">Exposed Secrets (${secrets.length})</div>
      ${secrets.length === 0
        ? '<div class="empty-state">No exposed secrets were detected.</div>'
        : secrets
            .slice(0, 50)
            .map(
              (f) =>
                `<div class="finding ${f.severity}">
                  <div class="finding-title">
                    <span>${f.type}</span>
                    <span class="severity-badge" style="background: ${getSeverityColor(f.severity)}">${f.severity}</span>
                  </div>
                  <div class="finding-detail">
                    <span class="finding-detail-label">Location:</span>
                    <span class="finding-detail-value">${f.file}:${f.line}${f.occurrences > 1 ? ` (+${f.occurrences - 1} more)` : ""}</span>
                  </div>
                  <div class="finding-detail">
                    <span class="finding-detail-label">Issue:</span>
                    <span class="finding-detail-value">${f.description}</span>
                  </div>
                  ${f.match ? `<div class="finding-detail">
                    <span class="finding-detail-label">Match:</span>
                    <span class="finding-detail-value">${f.match.substring(0, 4)}${"*".repeat(Math.max(0, f.match.length - 4))}</span>
                  </div>` : ""}
                </div>`
            )
            .join("")}
    </div>
    
    <!-- Dependencies Section -->
    <div class="section">
      <div class="section-title">Vulnerable Dependencies (${deps.length})</div>
      ${deps.length === 0
        ? '<div class="empty-state">No known vulnerabilities were found in the checked dependencies.</div>'
        : deps
            .slice(0, 50)
            .map(
              (f) =>
                `<div class="finding ${f.severity}">
                  <div class="finding-title">
                    <span>${f.package} v${f.version}</span>
                    <span class="severity-badge" style="background: ${getSeverityColor(f.severity)}">${f.severity}</span>
                  </div>
                  <div class="finding-detail">
                    <span class="finding-detail-label">Type:</span>
                    <span class="finding-detail-value">${f.type}</span>
                  </div>
                  <div class="finding-detail">
                    <span class="finding-detail-label">Scope:</span>
                    <span class="finding-detail-value">${f.scope || "production"}</span>
                  </div>
                  <div class="finding-detail">
                    <span class="finding-detail-label">Issue:</span>
                    <span class="finding-detail-value">${f.description}</span>
                  </div>
                </div>`
            )
            .join("")}
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>Security scan report generated by Repository Security Analyzer</p>
      <p style="margin-top: 10px; font-size: 11px;">For detailed information and remediation steps, download the text report.</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}
