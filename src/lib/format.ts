/** Localised number and date formatting. Numerals preference: western (default) or eastern. */

export function formatNumber(
  value: number | null | undefined,
  locale: string,
  opts: { decimals?: number; numerals?: string; compact?: boolean } = {}
): string {
  // CR08 housekeeping: the repository forbids em dashes, so a missing value
  // reads as a hyphen (the placeholder the rest of the product already uses)
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const numerals = opts.numerals === "eastern" ? "arab" : "latn";
  const tag = locale === "ar" ? `ar-SA-u-nu-${numerals}` : `en-SA-u-nu-${numerals}`;
  return new Intl.NumberFormat(tag, {
    maximumFractionDigits: opts.decimals ?? 1,
    minimumFractionDigits: 0,
    notation: opts.compact ? "compact" : "standard",
  }).format(value);
}

export function formatDate(
  iso: string | null | undefined,
  locale: string,
  opts: { style?: "long" | "medium" | "short"; numerals?: string } = {}
): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const numerals = opts.numerals === "eastern" ? "arab" : "latn";
  const tag = locale === "ar" ? `ar-SA-u-nu-${numerals}` : `en-SA-u-nu-${numerals}`;
  const style = opts.style ?? "medium";
  return new Intl.DateTimeFormat(tag, {
    dateStyle: style,
  }).format(d);
}

export function formatHijri(iso: string, locale: string): string {
  const d = new Date(iso);
  const tag = locale === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-SA-u-ca-islamic-umalqura";
  return new Intl.DateTimeFormat(tag, { dateStyle: "long" }).format(d);
}

export function relativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

/** Period labels like 2025, 2025-Q2, 2025-06 localised lightly. */
export function formatPeriod(period: string, locale: string): string {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
      month: "short",
      year: "numeric",
    }).format(d);
  }
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const [y, q] = period.split("-");
    return locale === "ar" ? `الربع ${q.slice(1)} ${y}` : `Q${q.slice(1)} ${y}`;
  }
  return period;
}
