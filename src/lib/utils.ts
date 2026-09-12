import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Picks the right bilingual field for the current locale, falling back to the other. */
export function bi(
  locale: string,
  en: string | null | undefined,
  ar: string | null | undefined
): string {
  if (locale === "ar") return ar || en || "";
  return en || ar || "";
}

/** True when the string is mostly Arabic script. */
export function isArabicText(s: string): boolean {
  if (!s) return false;
  const arabic = (s.match(/[؀-ۿݐ-ݿ]/g) || []).length;
  const latin = (s.match(/[a-zA-Z]/g) || []).length;
  return arabic > latin;
}

export function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
