"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiChevronLeft, FiMenu, FiBook, FiSearch } from "react-icons/fi";

interface NavSection {
  title: string;
  icon: React.ReactNode;
  href: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  const sections: NavSection[] = [
    { title: "Overview", icon: <FiBook size={20} />, href: "/overview" },
    { title: "Scanner", icon: <FiSearch size={20} />, href: "/" },
  ];

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? "w-64" : "w-20"
        } fixed left-0 top-0 h-screen bg-white transition-all duration-300 lg:relative flex flex-col`}
        style={{
          borderRight: "1px solid var(--color-border)",
          boxShadow: isOpen ? "0 1px 2px rgba(30, 58, 138, 0.05)" : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4" style={{ borderBottomColor: "var(--color-border)" }}>
          {isOpen && (
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white text-sm"
                style={{ backgroundColor: "var(--color-action)" }}
              >
                E
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm font-semibold" style={{ color: "var(--color-navy)" }}>
                  Ephemeral
                </h1>
                <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  Security Scanner
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            aria-label="Toggle sidebar"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {isOpen ? <FiChevronLeft size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 p-4">
          {sections.map((section) => {
            const isActive = pathname === section.href || (pathname.startsWith("/overview") && section.href === "/overview");
            return (
              <Link
                key={section.href}
                href={section.href}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200"
                style={{
                  backgroundColor: isActive ? "rgba(79, 127, 236, 0.1)" : "transparent",
                  color: isActive ? "var(--color-action)" : "var(--color-text-secondary)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {section.icon}
                </span>
                {isOpen && <span>{section.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        {isOpen && (
          <div className="border-t p-4" style={{ borderTopColor: "var(--color-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Security by design
            </p>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
