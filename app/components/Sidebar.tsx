"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiChevronLeft, FiMenu, FiX, FiBook, FiSearch } from "react-icons/fi";

interface NavSection {
  title: string;
  icon: React.ReactNode;
  href: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const sections: NavSection[] = [
    { title: "Overview", icon: <FiBook size={20} />, href: "/overview" },
    { title: "Scanner", icon: <FiSearch size={20} />, href: "/" },
  ];

  return (
    <>
      <aside className={"app-sidebar " + (isOpen ? "is-open" : "is-collapsed")}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="sidebar-brand-mark" aria-hidden="true">E</span>
            {isOpen && (
              <div className="sidebar-brand-copy">
                <strong>Ephemeral</strong>
                <span>Security Scanner</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="sidebar-toggle desktop-sidebar-toggle"
            aria-label="Toggle sidebar"
            aria-expanded={isOpen}
            title={isOpen ? "Collapse navigation" : "Expand navigation"}
          >
            {isOpen ? <FiChevronLeft size={19} /> : <FiMenu size={19} />}
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="mobile-menu-toggle"
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="primary-navigation"
          >
            {isMobileMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        <nav
          id="primary-navigation"
          className={"sidebar-nav " + (isMobileMenuOpen ? "is-mobile-open" : "")}
          aria-label="Main navigation"
        >
          {sections.map((section) => {
            const isActive = pathname === section.href || (pathname.startsWith("/overview") && section.href === "/overview");
            return (
              <Link
                key={section.href}
                href={section.href}
                className={"sidebar-link " + (isActive ? "is-active" : "")}
                aria-current={isActive ? "page" : undefined}
                title={!isOpen ? section.title : undefined}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="sidebar-icon" aria-hidden="true">{section.icon}</span>
                <span className="sidebar-link-label">{section.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        {isOpen && <div className="sidebar-footer">Security by design</div>}
      </aside>

      {isOpen && <div className="sidebar-backdrop" onClick={() => setIsOpen(false)} aria-hidden="true" />}
    </>
  );
}