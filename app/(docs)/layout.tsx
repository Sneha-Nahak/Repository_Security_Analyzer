import type { Metadata } from "next";
import type { ReactNode } from "react";
import Sidebar from "../components/Sidebar";
import { siteUrl } from "../../lib/site-url";

export const metadata: Metadata = {
  alternates: siteUrl ? { canonical: `${siteUrl}/overview` } : undefined,
  title: "Repository Security Scanner Guide",
  description:
    "Learn how Ephemeral scans public GitHub repositories, detects exposed secrets and vulnerable dependencies, and calculates security scores.",
  keywords: [
    "GitHub security scanner guide",
    "security score explained",
    "secret detection",
    "dependency vulnerability scanning",
  ],
  openGraph: {
    title: "Repository Security Scanner Guide | Ephemeral",
    description:
      "Learn how Ephemeral scans public GitHub repositories, detects exposed secrets and vulnerable dependencies, and calculates security scores.",
  },
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">{children}</div>
    </div>
  );
}
