"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SIDEBAR_LINKS = [
  { href: "/admin/generate", label: "Generate Contents with AI" },
  { href: "/admin/manual", label: "Pre-Set Contents Manually" },
];

export default function AdminContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      <nav className="admin-sidebar" aria-label="Content creation mode">
        {SIDEBAR_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname?.startsWith(link.href) ? "active" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="admin-shell-content">{children}</div>
    </div>
  );
}
