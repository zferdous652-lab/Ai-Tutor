"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const SIDEBAR_LINKS = [
  { href: "/admin/generate", icon: "🤖", label: "Generate Contents with AI" },
  { href: "/admin/manual", icon: "✍️", label: "Pre-Set Contents Manually" },
];

const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

export default function AdminContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Starts false on both server and initial client render (matching, so no hydration
  // mismatch), then picks up the saved preference right after mount.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div className={`admin-shell ${collapsed ? "admin-shell-collapsed" : ""}`}>
      <nav className="admin-sidebar" aria-label="Content creation mode">
        <button
          type="button"
          className="admin-sidebar-toggle"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
        {SIDEBAR_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname?.startsWith(link.href) ? "active" : undefined}
            title={collapsed ? link.label : undefined}
          >
            <span className="admin-sidebar-icon" aria-hidden="true">
              {link.icon}
            </span>
            <span className="admin-sidebar-label">{link.label}</span>
          </Link>
        ))}
      </nav>
      <div className="admin-shell-content">{children}</div>
    </div>
  );
}
