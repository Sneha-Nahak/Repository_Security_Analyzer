import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "./components/Header";
import "./globals.css";
import { siteUrl } from "../lib/site-url";

const siteDescription =
  "Scan public GitHub repositories for exposed secrets and known dependency vulnerabilities. Review security scores and export clear reports with Ephemeral.";

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  alternates: siteUrl ? { canonical: siteUrl } : undefined,
  title: {
    default: "Ephemeral | GitHub Repository Security Scanner",
    template: "%s | Ephemeral",
  },
  description: siteDescription,
  applicationName: "Ephemeral",
  keywords: [
    "GitHub repository security scanner",
    "repository vulnerability scanner",
    "secret scanning",
    "dependency vulnerability scanning",
    "static application security testing",
    "SAST",
    "AI-ready security report",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Ephemeral",
    title: "Ephemeral | GitHub Repository Security Scanner",
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: "Ephemeral | GitHub Repository Security Scanner",
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="app-body">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <Header />
        {children}
      </body>
    </html>
  );
}
