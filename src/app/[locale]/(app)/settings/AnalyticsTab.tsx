"use client";
// Analytics dashboard: KPI tiles, contributions chart, zero-result searches,
// top reused items, Ask confidence, KM health narrative on demand.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { bi } from "@/lib/utils";
import { Button, Chip, Skeleton, SectionTitle } from "@/components/ui/primitives";

export type AnalyticsData = {
  dailyActive: number;
  weeklyActive: number;
  contributionSeries: {
    week: string;
    uploads: number;
    answers: number;
    lessons: number;
    verifications: number;
    other: number;
  }[];
  totalDocs: number;
  verifiedDocs: number;
  verifiedRatio: number;
  staleDocs: number;
  zeroResults: { query: string; count: number }[];
  openGaps: number;
  topReused: { id: string; titleEn: string; titleAr: string; reuseCount: number; viewCount: number }[];
  askConfidence: { level: string; count: number }[];
  openExpertRequests: number;
  gamificationParticipants: number;
};

export function AnalyticsTab({ data }: { data: AnalyticsData | null }) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [narrative, setNarrative] = React.useState<string | null>(null);
  const [actions, setActions] = React.useState<{ text_en: string; text_ar: string }[]>([]);
  const [generating, setGenerating] = React.useState(false);

  if (!data) return null;

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/v1/analytics", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setNarrative(locale === "ar" ? json.data.narrative_ar : json.data.narrative_en);
        setActions(json.data.actions ?? []);
      }
    } finally {
      setGenerating(false);
    }
  }

  const tiles: { label: string; value: string }[] = [
    { label: t("kDaily"), value: String(data.dailyActive) },
    { label: t("kWeekly"), value: String(data.weeklyActive) },
    { label: t("kDocs"), value: String(data.totalDocs) },
    { label: t("kVerified"), value: `${Math.round(data.verifiedRatio * 100)}%` },
    { label: t("kStale"), value: String(data.staleDocs) },
    { label: t("kGaps"), value: String(data.openGaps) },
    { label: t("kRequests"), value: String(data.openExpertRequests) },
    { label: t("kParticipants"), value: String(data.gamificationParticipants) },
  ];

  return (
    <div>
      {/* Health narrative */}
      <div className="card mb-6 p-5">
        {narrative ? (
          <div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-900">{narrative}</p>
            {actions.length ? (
              <ul className="mt-3 space-y-1 border-t border-mist-100 pt-3 text-sm text-navy-900">
                {actions.map((a, i) => (
                  <li key={i}>· {locale === "ar" ? a.text_ar : a.text_en}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : generating ? (
          <div className="space-y-2" aria-busy>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-600">{t("healthHint")}</p>
            <Button onClick={generate}>
              <Sparkles /> {t("generateHealth")}
            </Button>
          </div>
        )}
      </div>

      {/* KPI tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="card px-4 py-3.5">
            <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-navy-900 tnum">
              {tile.value}
            </p>
            <p className="mt-0.5 text-xs text-ink-600">{tile.label}</p>
          </div>
        ))}
      </div>

      {/* Contributions chart */}
      {data.contributionSeries.length ? (
        <div className="card mb-6 p-5">
          <SectionTitle>{t("contributionsWeekly")}</SectionTitle>
          <div style={{ height: 240, direction: "ltr" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.contributionSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "var(--color-ink-400)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-mist-300)" }}
                />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-ink-400)" }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, borderColor: "var(--color-mist-300)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="uploads" stackId="a" fill="var(--color-navy-700)" name={t("cUploads")} />
                <Bar dataKey="answers" stackId="a" fill="var(--color-teal-600)" name={t("cAnswers")} />
                <Bar dataKey="lessons" stackId="a" fill="var(--color-aqua-500)" name={t("cLessons")} />
                <Bar dataKey="verifications" stackId="a" fill="var(--color-navy-300)" name={t("cVerifications")} />
                <Bar dataKey="other" stackId="a" fill="var(--color-mist-300)" name={t("cOther")} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Zero results */}
        <div className="card p-5">
          <SectionTitle>{t("zeroResults")}</SectionTitle>
          {data.zeroResults.length ? (
            <ul className="space-y-1.5">
              {data.zeroResults.map((z, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink-900">{z.query}</span>
                  <span className="shrink-0 text-xs text-ink-400 tnum">{z.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-400">{t("noZeroResults")}</p>
          )}
        </div>

        {/* Top reused + confidence */}
        <div className="space-y-6">
          <div className="card p-5">
            <SectionTitle>{t("topReused")}</SectionTitle>
            <ul className="space-y-1.5">
              {data.topReused.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink-900">{bi(locale, d.titleEn, d.titleAr)}</span>
                  <span className="shrink-0 text-xs text-ink-400 tnum">
                    {d.reuseCount} · {d.viewCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <SectionTitle>{t("askConfidence")}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {data.askConfidence.map((c) => (
                <Chip
                  key={c.level}
                  tone={c.level === "high" ? "ok" : c.level === "medium" ? "warn" : "danger"}
                  className="tnum"
                >
                  {c.level}: {c.count}
                </Chip>
              ))}
              {data.askConfidence.length === 0 ? (
                <p className="text-sm text-ink-400">{t("noAskYet")}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
