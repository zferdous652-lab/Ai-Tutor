import type { Metadata } from "next";
import { I18nProvider } from "../lib/i18n";
import { SessionProvider } from "../lib/session";
import { NavBar } from "./nav-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MYTAMAN AI Tutor",
  description: "AI Tutor MVP for MYTAMAN",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <SessionProvider>
            <NavBar />
            <main>{children}</main>
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
