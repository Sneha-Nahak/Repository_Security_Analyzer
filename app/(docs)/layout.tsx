"use client";

import type { ReactNode } from "react";
import Sidebar from "../components/Sidebar";

export default function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 transition-all duration-300 lg:ml-0 ml-20">
        {children}
      </div>
    </div>
  );
}
