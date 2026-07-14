"use client";

import Link from "next/link";
import { useI18n } from "../lib/i18n";

export function NavBar() {
  const { t, language, setLanguage } = useI18n();

  return (
    <nav>
      <Link href="/">{t("appName")}</Link>
      <Link href="/upload">{t("nav.upload")}</Link>
      <Link href="/parent">{t("nav.parent")}</Link>
      <div className="spacer" />
      <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "ms")}>
        <option value="en">English</option>
        <option value="ms">Bahasa Malaysia</option>
      </select>
    </nav>
  );
}
