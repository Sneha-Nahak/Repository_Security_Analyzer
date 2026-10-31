import type { Metadata } from "next";
import type { ReactNode } from "react";
import Sidebar from "../components/Sidebar";
import { siteUrl } from "../../lib/site-url";

export const metadata: Metadata = {
  alternates: siteUrl ? { canonical: `${siteUrl}/scanner` } : undefined,
  title: "GitHub Repository Security Scanner",
  description:
    "Analyze a public GitHub repository for exposed secrets and known dependency vulnerabilities. Review security findings and export PDF or AI-ready reports.",
  openGraph: {
    title: "GitHub Repository Security Scanner | Ephemeral",
    description:
      "Analyze a public GitHub repository for exposed secrets and known dependency vulnerabilities. Review security findings and export PDF or AI-ready reports.",
  },
};

export default function ScannerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">{children}</div>
    </div>
  );
}
