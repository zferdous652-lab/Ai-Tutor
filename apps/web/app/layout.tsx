import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { I18nProvider } from "../lib/i18n";
import { SessionProvider } from "../lib/session";
import { NavBar } from "./nav-bar";
import "./globals.css";

const heading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MYTAMAN AI Tutor",
  description: "AI Tutor MVP for MYTAMAN",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        <div className="bg-glow" aria-hidden="true" />
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
