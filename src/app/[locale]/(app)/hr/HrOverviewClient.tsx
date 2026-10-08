"use client";
// CR05 5.6.1. Never shows points, badges, streaks, or Learn data (5.1).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Chip, ProgressRing, SectionTitle } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ReportButton } from "@/components/nexus/ReportButton";
import type { HrOverview } from "@/server/services/hr";

export const SEVERITY_TONE: Record<string, "danger" | "warn" | "mist" | "ghost"> = {
  critical: "danger",
  high: "warn",
  medium: "mist",
  low: "ghost",
};

export function riskLink(r: { resourceType: string | null; resourceId: string | null }): string {
  switch (r.resourceType) {
    case "document":
      return `/vault/${r.resourceId}`;
    case "node":
      return `/strategy/${r.resourceId}`;
    case "handover":
      return `/hr/handovers/${r.resourceId}`;
    case "user":
      return `/hr/people?focus=${r.resourceId}`;
    case "indicator":
      return `/statistics/${r.resourceId}`;
    default:
      return "/hr/risks";
  }
}

function heatColor(score: number): string {
  if (score >= 85) return "bg-ok-light text-ok";
  if (score >= 70) return "bg-aqua-100 text-navy-900";
  if (score >= 50) return "bg-warn-light text-warn";
  return "bg-danger-light text-danger";
}

export function HrOverviewClient({ data }: { data: HrOverview }) {
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function recompute() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/hr/risks", { method: "POST" });
      if (res.ok) {
        toast(t("recomputed"), "points");
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="hr-overview">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {data.scope.all ? (
          <Button size="sm" variant="secondary" onClick={recompute} loading={busy} data-testid="hr-recompute">
            <RefreshCw /> {t("recompute")}
          </Button>
        ) : null}
        <span className="ms-auto">
          <ReportButton
            scope={{
              kind: "hr",
              ids: data.scope.departmentId ? [data.scope.departmentId] : [],
              labelEn: "Knowledge continuity",
              labelAr: "استمرارية المعرفة",
            }}
          />
        </span>
      </div>

      {/* three rings */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="hr-rings">
        {(
          [
            ["readiness", data.rings.readiness],
            ["continuity", data.rings.continuity],
            ["handoversComplete", data.rings.handoversComplete],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="card flex items-center gap-4 p-5">
            <ProgressRing
              value={value / 100}
              size={88}
              stroke={8}
              color={value >= 80 ? "var(--color-ok)" : value >= 55 ? "var(--color-aqua-500)" : "var(--color-danger)"}
            >
              <span className="text-lg font-semibold text-ink-900 tnum">{value}</span>
            </ProgressRing>
            <div>
              <p className="text-sm font-semibold text-ink-900">{t(`rings.${key}`)}</p>
              <p className="mt-0.5 max-w-44 text-xs leading-snug text-ink-600">{t(`rings.${key}Hint`)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* risk counts */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-mist-100 px-4 py-2.5 text-sm" data-testid="hr-risk-counts">
        {(["critical", "high", "medium", "low"] as const).map((sev) => (
          <span key={sev} className="flex items-center gap-1.5">
            <Chip tone={SEVERITY_TONE[sev]}>{t(`severity.${sev}`)}</Chip>
            <span className="tnum font-semibold">{data.riskCounts[sev]}</span>
          </span>
        ))}
        <Link href="/hr/risks" className="link-draw ms-auto text-xs font-medium text-navy-700">
          {t("allRisks")}
        </Link>
      </div>

      {/* department heat strip */}
      {data.heat.length > 1 ? (
        <div className="mt-6" data-testid="hr-heat">
          <SectionTitle>{t("heatTitle")}</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {data.heat.map((d) => (
              <Link
                key={d.id}
                href={`/hr/departments?focus=${d.code}` as never}
                className={cn(
                  "rounded-xl px-3 py-2.5 transition-transform hover:-translate-y-0.5",
                  heatColor(d.continuity)
                )}
              >
                <span className="block truncate text-xs font-medium">{bi(locale, d.nameEn, d.nameAr)}</span>
                <span className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-semibold tnum">{d.continuity}</span>
                  <span className="text-[11px] tnum">{t("openRisks", { count: d.openRisks })}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* top 10 risks */}
      <div className="mt-6" data-testid="hr-top-risks">
        <SectionTitle>{t("topRisks")}</SectionTitle>
        <div className="card divide-y divide-mist-100">
          {data.topRisks.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <Chip tone={SEVERITY_TONE[r.severity]} className="shrink-0">
                {t(`severity.${r.severity}`)}
              </Chip>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{r.title}</p>
                <p className="truncate text-xs text-ink-600">
                  {bi(locale, r.detailEn ?? "", r.detailAr ?? "")}
                  {r.owner ? (
                    <span className="text-ink-400"> · {t("shouldAct", { name: bi(locale, r.owner.nameEn, r.owner.nameAr) })}</span>
                  ) : null}
                </p>
              </div>
              <Link
                href={riskLink(r) as never}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-mist-300 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:border-navy-300 hover:text-navy-700"
              >
                {t("actOn")} <ArrowUpRight className="size-3 flip-rtl" />
              </Link>
            </div>
          ))}
          {!data.topRisks.length ? (
            <p className="px-4 py-6 text-center text-sm text-ink-600">{t("noRisks")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
