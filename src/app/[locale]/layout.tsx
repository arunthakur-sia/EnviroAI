import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { awaitingSetup } from "@/server/setup-state";
import { AwaitingSetup } from "@/components/nexus/AwaitingSetup";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "SiaNexus",
    template: "%s · SiaNexus",
  },
  description: "The knowledge memory of the National Planning Council",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  /* A deployment whose volume is still empty shows one honest screen instead
     of an error on every page. /api/health does not pass through here and
     keeps answering 200, so the platform leaves the service alone while the
     operator uploads the bundle at /setup/restore. */
  const waiting = await awaitingSetup();

  return (
    <html lang={locale} dir={dir}>
      <head>
        {/* CR08 Phase B: the two faces of the first screen, fetched with the
            document instead of after the stylesheet parses. The rest of the
            family loads on demand through font-display: swap. */}
        <link
          rel="preload"
          href="/fonts/fraunces-var-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href={locale === "ar" ? "/fonts/plex-sans-arabic-400.woff2" : "/fonts/inter-var-latin.woff2"}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {waiting ? (
          <AwaitingSetup />
        ) : (
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        )}
      </body>
    </html>
  );
}
