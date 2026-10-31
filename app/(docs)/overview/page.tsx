"use client";

import { useState } from "react";
import { 
  FiBook, FiAlertTriangle, FiPackage, FiKey, FiCodepen,
  FiAward, FiTag, FiZap, FiServer, FiArrowRight, FiCheckCircle,
  FiShield, FiBarChart, FiGlobe, FiLayers, FiCpu
} from "react-icons/fi";

interface TOCItem {
  id: string;
  label: string;
  level: number;
}

export default function OverviewPage() {
  const [activeSection, setActiveSection] = useState("intro");

  const toc: TOCItem[] = [
    { id: "intro", label: "Introduction", level: 0 },
    { id: "scoring", label: "Security Scoring System", level: 0 },
    { id: "severity-levels", label: "Severity Levels", level: 1 },
    { id: "grade-mapping", label: "Grade Mapping", level: 1 },
    { id: "tags", label: "Understanding Tags & Categories", level: 0 },
    { id: "bug-types", label: "Types of Bugs Detected", level: 0 },
    { id: "secret-types", label: "Secret Detection", level: 1 },
    { id: "dependency-types", label: "Dependency Vulnerabilities", level: 1 },
    { id: "how-it-works", label: "How the Scanner Works", level: 0 },
    { id: "usage", label: "Getting Started", level: 0 },
  ];

  return (
    <div className="overview-page">
      {/* Left Sidebar - Table of Contents (Internal to Overview - only on lg+) */}
      <aside className="overview-toc hidden w-64 bg-white p-6 lg:block">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
          Contents
        </h3>
        <nav className="space-y-1">
          {toc.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block w-full text-left rounded-md px-3 py-2 text-sm transition-all duration-200"
              style={{
                paddingLeft: `${12 + item.level * 16}px`,
                backgroundColor: activeSection === item.id ? "rgba(59,130,246,.14)" : "transparent",
                color: activeSection === item.id ? "var(--color-action)" : "var(--color-text-secondary)",
                fontWeight: activeSection === item.id ? "600" : "400",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="overview-content flex-1 px-6 py-12 lg:px-16 mx-auto">
        {/* Introduction */}
        <section id="intro" className="mb-20 scroll-mt-20">
          <h1 className="mb-4 text-4xl font-bold" style={{ color: "var(--color-navy)" }}>
            Welcome to Ephemeral
          </h1>
          <p className="text-lg mb-6" style={{ color: "var(--color-text-primary)" }}>
            The <strong>Ephemeral AI-Ready Security Scanner</strong> is a comprehensive static analysis security testing (SAST) tool designed to identify vulnerabilities, exposed secrets, and outdated dependencies in your codebase.
          </p>
          <div className="rounded-lg bg-white p-6 mb-6" style={{ border: "1px solid var(--color-border)" }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--color-navy)" }}>
              <FiShield size={20} style={{ color: "var(--color-action)" }} />
              Key Features
            </h3>
            <div className="space-y-3">
              {[
                { icon: FiKey, text: "Detect exposed secrets and credentials" },
                { icon: FiPackage, text: "Scan for vulnerable dependencies across multiple ecosystems" },
                { icon: FiBarChart, text: "Get a comprehensive security score with detailed reporting" },
                { icon: FiCodepen, text: "Export reports in multiple formats (text, AI-friendly, PDF)" },
                { icon: FiCpu, text: "AI-optimized reports for ChatGPT, Claude, and other LLMs" },
                { icon: FiZap, text: "Real-time scanning with progress logs" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <item.icon size={18} style={{ color: "var(--color-action)", marginTop: "2px", flexShrink: 0 }} />
                  <span style={{ color: "var(--color-text-primary)" }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Scoring */}
        <section id="scoring" className="mb-20 scroll-mt-20">
          <h2 className="mb-6 text-3xl font-bold flex items-center gap-3" style={{ color: "var(--color-navy)" }}>
            <FiAward size={28} style={{ color: "var(--color-action)" }} />
            Security Scoring System
          </h2>
          <p style={{ color: "var(--color-text-primary)" }} className="mb-8 text-lg">
            The scanner assigns a <strong>Security Score (0-100)</strong> based on the types and severity of vulnerabilities found. The score reflects your repository&apos;s overall security posture.
          </p>

          {/* Severity Levels */}
          <div id="severity-levels" className="mb-16 scroll-mt-20">
            <h3 className="mb-6 text-2xl font-semibold" style={{ color: "var(--color-navy)" }}>
              Severity Levels
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  level: "Critical",
                  color: "#E11D48",
                  bgColor: "#351823",
                  borderColor: "#6B2037",
                  icon: FiAlertTriangle,
                  description: "Immediate action required. Exposed credentials or critical vulnerabilities that could be exploited immediately.",
                },
                {
                  level: "High",
                  color: "#FBBF24",
                  bgColor: "#342B16",
                  borderColor: "#67531F",
                  icon: FiAlertTriangle,
                  description: "Serious security risk. Known vulnerabilities with high CVSS scores that could lead to system compromise.",
                },
                {
                  level: "Medium",
                  color: "#FBBF24",
                  bgColor: "#342B16",
                  borderColor: "#67531F",
                  icon: FiAlertTriangle,
                  description: "Noteworthy vulnerabilities. Issues that may be exploited in specific conditions or combined with other vectors.",
                },
                {
                  level: "Low",
                  color: "#3B82F6",
                  bgColor: "#17263B",
                  borderColor: "#2A4C78",
                  icon: FiAlertTriangle,
                  description: "Minor issues. Vulnerabilities with limited impact or that require specific conditions to exploit.",
                },
              ].map((sev) => (
                <div
                  key={sev.level}
                  className="rounded-lg p-4 transition-all duration-200"
                  style={{
                    backgroundColor: sev.bgColor,
                    border: `1.5px solid ${sev.borderColor}`,
                  }}
                >
                  <h4 className="mb-3 flex items-center gap-2 font-semibold">
                    <sev.icon size={18} style={{ color: sev.color }} />
                    <span style={{ color: sev.color }}>{sev.level}</span>
                  </h4>
                  <p style={{ color: "var(--color-text-primary)" }} className="text-sm">
                    {sev.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Grade Mapping */}
          <div id="grade-mapping" className="scroll-mt-20">
            <h3 className="mb-6 text-2xl font-semibold" style={{ color: "var(--color-navy)" }}>
              Grade Mapping
            </h3>
            <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--color-border)" }}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-bg-input)", borderBottom: "1px solid var(--color-border)" }}>
                    <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-navy)" }}>Score Range</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-navy)" }}>Grade</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-navy)" }}>Status</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-navy)" }}>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { range: "90-100", grade: "A+", status: "Secure", meaning: "Excellent security posture", color: "#10B981" },
                    { range: "75-89", grade: "A", status: "Good", meaning: "Generally secure with minor issues", color: "var(--color-action)" },
                    { range: "60-74", grade: "B", status: "At Risk", meaning: "Moderate vulnerabilities present", color: "#FBBF24" },
                    { range: "40-59", grade: "C", status: "Critical", meaning: "Significant security concerns", color: "#E11D48" },
                    { range: "0-39", grade: "F", status: "Failed", meaning: "Severe security issues", color: "#FDA4AF" },
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {row.range}
                      </td>
                      <td className="px-4 py-3 font-bold" style={{ color: row.color }}>
                        {row.grade}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--color-text-primary)" }}>
                        {row.status}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--color-text-secondary)" }}>
                        {row.meaning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Tags & Categories */}
        <section id="tags" className="mb-20 scroll-mt-20">
          <h2 className="mb-6 text-3xl font-bold flex items-center gap-3" style={{ color: "var(--color-navy)" }}>
            <FiTag size={28} style={{ color: "var(--color-action)" }} />
            Understanding Tags & Categories
          </h2>
          <p style={{ color: "var(--color-text-primary)" }} className="mb-8 text-lg">
            Every finding is tagged with a category to help you understand what type of issue was discovered.
          </p>

          <div className="grid gap-4 md:grid-cols-2 mb-8">
            {[
              {
                tag: "Secret",
                icon: FiKey,
                description: "Exposed sensitive data like API keys, passwords, tokens, or credentials found in source code.",
              },
              {
                tag: "Dependency",
                icon: FiPackage,
                description: "Known vulnerabilities in third-party packages and libraries used by your project.",
              },
            ].map((item) => (
              <div
                key={item.tag}
                className="rounded-lg p-5 transition-all duration-200 hover:shadow-md"
                style={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
              >
                <h4 className="mb-2 flex items-center gap-2 font-semibold">
                  <item.icon size={20} style={{ color: "var(--color-action)" }} />
                  <span style={{ color: "var(--color-navy)" }}>{item.tag}</span>
                </h4>
                <p style={{ color: "var(--color-text-primary)" }} className="text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-6" style={{ backgroundColor: "#17263B", border: "1.5px solid #2A4C78" }}>
            <h4 className="mb-3 font-semibold flex items-center gap-2" style={{ color: "#93C5FD" }}>
              <FiBarChart size={18} />
              Coverage & Confidence
            </h4>
            <p style={{ color: "#BFDBFE" }} className="text-sm mb-3">
              Each report includes:
            </p>
            <ul style={{ color: "#BFDBFE" }} className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <FiCheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span><strong>Coverage:</strong> Percentage of your codebase analyzed. 100% means all checks completed successfully.</span>
              </li>
              <li className="flex items-start gap-2">
                <FiCheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span><strong>Confidence:</strong> For each finding, shows how confident the scanner is (typically 50-100%).</span>
              </li>
              <li className="flex items-start gap-2">
                <FiCheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span><strong>Provisional:</strong> If marked, some checks were incomplete (typically due to missing lockfiles).</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Bug Types */}
        <section id="bug-types" className="mb-20 scroll-mt-20">
          <h2 className="mb-6 text-3xl font-bold flex items-center gap-3" style={{ color: "var(--color-navy)" }}>
            <FiZap size={28} style={{ color: "var(--color-action)" }} />
            Types of Bugs Detected
          </h2>

          {/* Secret Detection */}
          <div id="secret-types" className="mb-16 scroll-mt-20">
            <h3 className="mb-6 text-2xl font-semibold flex items-center gap-2" style={{ color: "var(--color-navy)" }}>
              <FiKey size={24} style={{ color: "var(--color-action)" }} />
              Secret Detection
            </h3>
            <p style={{ color: "var(--color-text-primary)" }} className="mb-6">
              The scanner detects various types of exposed secrets using pattern matching and entropy analysis:
            </p>

            <div className="space-y-3">
              {[
                { name: "API Keys & Tokens", examples: "GitHub, AWS, Stripe, SendGrid tokens" },
                { name: "Database Credentials", examples: "Database URLs, connection strings, usernames/passwords" },
                { name: "Private Keys", examples: "SSH keys, RSA keys, encryption keys" },
                { name: "Cloud Credentials", examples: "AWS Access Keys, Google Cloud keys, Azure credentials" },
                { name: "OAuth Tokens", examples: "Bearer tokens, access tokens, refresh tokens" },
                { name: "High-Entropy Strings", examples: "Suspicious long hex/base64 strings that look like secrets" },
              ].map((item, idx) => (
                <div key={idx} className="rounded-lg p-4" style={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
                  <h4 className="font-semibold" style={{ color: "var(--color-navy)" }}>
                    {item.name}
                  </h4>
                  <p style={{ color: "var(--color-text-secondary)" }} className="text-sm mt-1">
                    Examples: {item.examples}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg p-4" style={{ backgroundColor: "#351823", border: "1.5px solid #6B2037" }}>
              <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "#FDA4AF" }}>
                <FiAlertTriangle size={18} />
                Immediate Action Required
              </h4>
              <p style={{ color: "#FDA4AF" }} className="text-sm">
                If any secrets are detected, you must immediately rotate the exposed credentials. Attackers can use exposed secrets to compromise your systems.
              </p>
            </div>
          </div>

          {/* Dependency Vulnerabilities */}
          <div id="dependency-types" className="scroll-mt-20">
            <h3 className="mb-6 text-2xl font-semibold flex items-center gap-2" style={{ color: "var(--color-navy)" }}>
              <FiPackage size={24} style={{ color: "var(--color-action)" }} />
              Dependency Vulnerabilities
            </h3>
            <p style={{ color: "var(--color-text-primary)" }} className="mb-6">
              The scanner checks your dependencies against known vulnerability databases. Supports multiple ecosystems:
            </p>

            <div className="grid gap-4">
              {[
                { eco: "npm (Node.js)", vulnDB: "NPM Security Database" },
                { eco: "PyPI (Python)", vulnDB: "PyPA Vulnerability Database" },
                { eco: "Go Modules", vulnDB: "Go Vulnerability Database" },
                { eco: "RubyGems", vulnDB: "RubySec Advisories" },
                { eco: "Cargo (Rust)", vulnDB: "Rustsec Advisory Database" },
                { eco: "Composer (PHP)", vulnDB: "FriendsOfPHP Advisories" },
                { eco: "Maven (Java)", vulnDB: "NVD / OSS Index" },
                { eco: "NuGet (.NET)", vulnDB: "NVD / GitHub Advisories" },
              ].map((item) => (
                <div
                  key={item.eco}
                  className="flex items-start gap-4 rounded-lg p-4"
                  style={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
                >
                  <FiServer size={20} style={{ color: "var(--color-action)", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <h4 className="font-semibold" style={{ color: "var(--color-navy)" }}>
                      {item.eco}
                    </h4>
                    <p style={{ color: "var(--color-text-secondary)" }} className="text-sm">
                      Uses: {item.vulnDB}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg p-4" style={{ backgroundColor: "#17263B", border: "1.5px solid #2A4C78" }}>
              <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "#93C5FD" }}>
                <FiLayers size={18} />
                Priority
              </h4>
              <p style={{ color: "#BFDBFE" }} className="text-sm mb-3">
                <strong>Production dependencies</strong> are higher priority than dev-only dependencies.
              </p>
              <p style={{ color: "#BFDBFE" }} className="text-sm">
                Focus on upgrading production vulnerabilities first, as they affect users of your application.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="mb-20 scroll-mt-20">
          <h2 className="mb-6 text-3xl font-bold flex items-center gap-3" style={{ color: "var(--color-navy)" }}>
            <FiGlobe size={28} style={{ color: "var(--color-action)" }} />
            How the Scanner Works
          </h2>

          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "Repository Analysis",
                description: "Clones or accesses your GitHub repository and analyzes all files in the codebase.",
              },
              {
                step: "2",
                title: "Secret Detection",
                description: "Scans files for patterns matching known secret formats (API keys, tokens, credentials). Uses entropy analysis to detect suspicious strings.",
              },
              {
                step: "3",
                title: "Dependency Scanning",
                description: "Identifies all package.json, requirements.txt, go.mod, Gemfile, Cargo.toml, composer.json, pom.xml, and .csproj files. Checks versions against vulnerability databases.",
              },
              {
                step: "4",
                title: "Severity Assessment",
                description: "Categorizes each finding by severity (Critical, High, Medium, Low) based on CVSS scores and impact.",
              },
              {
                step: "5",
                title: "Scoring Calculation",
                description: "Computes your Security Score (0-100) based on finding count, severity distribution, and coverage. Assigns a letter grade (A+, A, B, C, F).",
              },
              {
                step: "6",
                title: "Report Generation",
                description: "Generates three report formats: beautiful hierarchical text (for humans), AI-friendly key=value pairs (for LLMs), and polished PDF.",
              },
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white font-bold"
                  style={{ backgroundColor: "var(--color-action)" }}
                >
                  {item.step}
                </div>
                <div className="pt-1">
                  <h4 className="font-semibold mb-1" style={{ color: "var(--color-navy)" }}>
                    {item.title}
                  </h4>
                  <p style={{ color: "var(--color-text-primary)" }} className="text-sm">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Getting Started */}
        <section id="usage" className="mb-20 scroll-mt-20">
          <h2 className="mb-6 text-3xl font-bold flex items-center gap-3" style={{ color: "var(--color-navy)" }}>
            <FiArrowRight size={28} style={{ color: "var(--color-action)" }} />
            Getting Started
          </h2>

          <div className="space-y-4 mb-8">
            {[
              {
                num: "1",
                title: "Enter Your Repository",
                desc: "Go to the Scanner page and paste your GitHub repository URL:",
                code: "https://github.com/username/repository",
                note: "Make sure the repository is public so our scanner can access it.",
              },
              {
                num: "2",
                title: "Start Scanning",
                desc: "Click the Scan Repository button. Watch the live logs as the scanner analyzes your code.",
              },
              {
                num: "3",
                title: "Review Results",
                desc: "Once complete, view your Security Score, findings grid, and detailed report.",
              },
              {
                num: "4",
                title: "Export Reports",
                desc: "Download your results in three formats: beautiful text, AI-friendly, and polished PDF.",
              },
              {
                num: "5",
                title: "Take Action",
                desc: "Use the AI Prompt report in ChatGPT or Claude to get automated fix suggestions.",
              },
            ].map((item) => (
              <div key={item.num} className="rounded-lg p-6" style={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
                <h3 className="mb-2 font-semibold flex items-center gap-2" style={{ color: "var(--color-navy)" }}>
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full text-white text-sm font-bold" style={{ backgroundColor: "var(--color-action)" }}>
                    {item.num}
                  </span>
                  {item.title}
                </h3>
                <p style={{ color: "var(--color-text-primary)" }} className="mb-2">
                  {item.desc}
                </p>
                {item.code && (
                  <code style={{ backgroundColor: "var(--color-bg-input)", color: "var(--color-text-primary)", padding: "8px 12px", borderRadius: "6px", display: "block", fontSize: "13px", marginTop: "8px", border: "1px solid var(--color-border)" }}>
                    {item.code}
                  </code>
                )}
                {item.note && (
                  <p style={{ color: "var(--color-text-secondary)" }} className="text-xs mt-2">
                    {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-lg p-6" style={{ backgroundColor: "#142D29", border: "1.5px solid #1E5A4C" }}>
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#6EE7B7" }}>
              <FiCheckCircle size={18} />
              Tips for Best Results
            </h3>
            <ul style={{ color: "#6EE7B7" }} className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span><strong>Commit lockfiles:</strong> Ensure package-lock.json, requirements.txt, go.sum, etc. are committed for complete dependency scanning</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span><strong>Public repository:</strong> The scanner needs access to your repository files</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span><strong>Check frequently:</strong> Run scans regularly as new vulnerabilities are discovered</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span><strong>Fix secrets first:</strong> If secrets are detected, rotate them immediately before other fixes</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t pt-8 text-center text-sm" style={{ borderTopColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
          <p>Built with security in mind • Ephemeral AI-Ready Security Scanner</p>
        </footer>
      </main>
    </div>
  );
}
