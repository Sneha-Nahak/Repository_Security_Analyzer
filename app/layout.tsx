import type { ReactNode } from "react";
import Header from "./components/Header";
import "./globals.css";

export const metadata = {
  title: "Ephemeral Security Scanner",
  description: "AI-ready security scanning for your repositories",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <Header />
        {children}
      </body>
    </html>
  );
}
