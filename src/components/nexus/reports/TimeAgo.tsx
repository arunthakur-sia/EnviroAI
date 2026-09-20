"use client";
// CR08 5: a relative time that hydrates cleanly. The server renders the
// absolute date (deterministic), the client switches to "5 minutes ago"
// after mount, so a row updated seconds ago never mismatches.
import * as React from "react";
import { useLocale } from "next-intl";
import { formatDate, relativeTime } from "@/lib/format";

export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const locale = useLocale();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return (
    <time dateTime={iso} title={formatDate(iso, locale)} className={className} suppressHydrationWarning>
      {mounted ? relativeTime(iso, locale) : formatDate(iso, locale)}
    </time>
  );
}
