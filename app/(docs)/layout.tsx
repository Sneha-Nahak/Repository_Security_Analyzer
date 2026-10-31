"use client";

import type { ReactNode } from "react";
import Sidebar from "../components/Sidebar";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">{children}</div>
    </div>
  );
}
