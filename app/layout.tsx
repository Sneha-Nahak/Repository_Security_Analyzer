import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-Ready Security Scanner",
  description: "Ephemeral SAST security analysis pipeline",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white">{children}</body>
    </html>
  );
}
