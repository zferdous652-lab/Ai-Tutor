"use client";

import Link from "next/link";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/session";

export function NavBar() {
  const { t, language, setLanguage } = useI18n();
  const { me } = useSession();

  return (
    <nav>
      <Link href="/" className="brand">
        <span className="brand-mark">🎓</span>
        {t("appName")}
      </Link>
      <div className="nav-links">
        {me?.role === "ADMIN" && <Link href="/admin">{t("nav.admin")}</Link>}
        {me?.role === "PARENT" && <Link href="/parent">{t("nav.parent")}</Link>}
        {me?.role === "STUDENT" && <Link href="/student">{t("nav.student")}</Link>}
      </div>
      <div className="spacer" />
      <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "ms")}>
        <option value="en">English</option>
        <option value="ms">Bahasa Malaysia</option>
      </select>
    </nav>
  );
}
