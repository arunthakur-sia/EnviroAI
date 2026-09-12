"use client";
// 5x5 likelihood x impact heat map. Cells warm from sand to danger.
// CR01: risks with related signals link into the filtered signal stream.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { bi } from "@/lib/utils";
import { Tip } from "@/components/ui/overlays";

type Risk = {
  id: string;
  titleEn: string;
  titleAr: string;
  likelihood: number;
  impact: number;
  mitigationEn: string | null;
  mitigationAr: string | null;
  status: string;
};

function cellColor(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 16) return "#B3261E22";
  if (score >= 10) return "#B7791F22";
  if (score >= 5) return "#C9A24D1e";
  return "#F4F0E8";
}

export function RiskHeatmap({
  risks,
  signalCounts,
}: {
  risks: Risk[];
  signalCounts?: Record<string, number>;
}) {
  const t = useTranslations("foresight");
  const locale = useLocale();

  const byCell = new Map<string, Risk[]>();
  for (const r of risks) {
    const key = `${r.likelihood}:${r.impact}`;
    (byCell.get(key) ?? byCell.set(key, []).get(key)!).push(r);
  }

  return (
    <div className="card p-5">
      <div className="flex gap-3">
        {/* Y axis label */}
        <div className="flex flex-col items-center justify-center">
          <span className="rotate-180 text-[11px] font-medium text-ink-400 [writing-mode:vertical-rl]">
            {t("impactAxis")}
          </span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1.5" style={{ direction: "ltr" }}>
            {[5, 4, 3, 2, 1].map((impact) =>
              [1, 2, 3, 4, 5].map((likelihood) => {
                const cellRisks = byCell.get(`${likelihood}:${impact}`) ?? [];
                return (
                  <div
                    key={`${likelihood}:${impact}`}
                    className="flex min-h-[72px] flex-wrap content-start gap-1 rounded-lg border border-sand-200 p-1.5"
                    style={{ background: cellColor(likelihood, impact) }}
                  >
                    {cellRisks.map((r) => {
                      const related = signalCounts?.[r.id] ?? 0;
                      const dot = (
                        <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-maroon-700 text-[10px] font-semibold text-white shadow-sm">
                          {bi(locale, r.titleEn, r.titleAr)
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")}
                          {related > 0 ? (
                            <span className="absolute -end-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gulf-600 px-0.5 text-[8px] font-bold text-white tnum">
                              {related}
                            </span>
                          ) : null}
                        </span>
                      );
                      return (
                        <Tip
                          key={r.id}
                          content={
                            <span className="block max-w-60">
                              <span className="block font-medium">{bi(locale, r.titleEn, r.titleAr)}</span>
                              {(r.mitigationEn || r.mitigationAr) ? (
                                <span className="mt-1 block text-ink-600">
                                  {t("mitigation")}: {bi(locale, r.mitigationEn ?? "", r.mitigationAr ?? "")}
                                </span>
                              ) : null}
                              {related > 0 ? (
                                <span className="mt-1 block text-gulf-600">
                                  {t("relatedSignals", { count: related })}
                                </span>
                              ) : null}
                            </span>
                          }
                        >
                          {related > 0 ? (
                            <Link href={`/trends?riskId=${r.id}` as never} className="cursor-pointer">
                              {dot}
                            </Link>
                          ) : (
                            <span className="cursor-default">{dot}</span>
                          )}
                        </Tip>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-2 text-center text-[11px] font-medium text-ink-400">{t("likelihoodAxis")}</p>
        </div>
      </div>
    </div>
  );
}
