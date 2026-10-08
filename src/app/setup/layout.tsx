/**
 * The setup pages sit outside the locale tree on purpose: they run before
 * anyone can sign in, before there is a database to read a preference from,
 * and they must not depend on the translation files loading. They carry their
 * own root layout and their own bilingual strings.
 */
import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "EnviroAI setup",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
