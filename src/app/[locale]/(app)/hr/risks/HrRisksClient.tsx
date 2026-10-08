"use client";
// CR05 5.6.5: the full risk register: filters, grouped views, resolve with a
// note, and the 12-week open-risk trend.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Chip, Input, NativeSelect } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { SEVERITY_TONE, riskLink } from "../HrOverviewClient";
import type { getHrRisks } from "@/server/services/hr";

type Data = NonNullable<Awaited<ReturnType<typeof getHrRisks>>>;
type Risk = Data["risks"][number];

const KINDS = [
  "incomplete_handover",
  "outdated_content",
  "missing_knowledge",
  "overdue_update",
  "single_point_of_failure",
  "no_backup",
];

export function HrRisksClient({ data }: { data: Data }) {
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [kind, setKind] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [dept, setDept] = React.useState("");
  const [showResolved, setShowResolved] = React.useState(false);
  const [groupBy, setGroupBy] = React.useState<"severity" | "kind">("severity");
  const [resolving, setResolving] = React.useState<Risk | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const filtered = data.risks.filter((r) => {
    if (!showResolved && r.resolvedAt) return false;
    if (kind && r.kind !== kind) return false;
    if (severity && r.severity !== severity) return false;
    if (dept && r.departmentId !== dept) return false;
    return true;
  });

  const groups =
    groupBy === "severity"
      ? (["critical", "high", "medium", "low"] as const).map(
          (g) => [g, filtered.filter((r) => r.severity === g)] as const
        )
      : KINDS.map((g) => [g, filtered.filter((r) => r.kind === g)] as const);

  async function resolve() {
    if (!resolving) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/hr/risks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: resolving.id, note }),
      });
      if (res.ok) {
        toast(t("riskResolved"), "points");
        setResolving(null);
        setNote("");
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  const maxOpen = Math.max(1, ...data.weeks.map((w) => w.open));

  return (
    <div data-testid="hr-risks">
      {/* 12-week trend */}
      <div className="card mb-5 p-4" data-testid="hr-risk-trend">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
          {t("riskTrend")} <span className="ms-1 font-medium normal-case tracking-normal tnum">{t("openNow", { count: data.openCount })}</span>
        </p>
        <div className="flex h-16 items-end gap-1" dir="ltr">
          {data.weeks.map((w) => (
            <span
              key={w.week}
              className="flex-1 rounded-t bg-navy-300/70"
              style={{ height: `${(w.open / maxOpen) * 100}%` }}
              title={`${w.week}: ${w.open}`}
            />
          ))}
        </div>
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} className="w-52" aria-label={t("filterKind")}>
          <option value="">{t("allKinds")}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`riskKinds.${k}` as never)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-36" aria-label={t("filterSeverity")}>
          <option value="">{t("allSeverities")}</option>
          {["critical", "high", "medium", "low"].map((s) => (
            <option key={s} value={s}>
              {t(`severity.${s}` as never)}
            </option>
          ))}
        </NativeSelect>
        {data.scope.all ? (
          <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)} className="w-56" aria-label={t("filterDepartment")}>
            <option value="">{t("allDepartments")}</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {bi(locale, d.nameEn, d.nameAr)}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <label className="flex items-center gap-1.5 text-xs text-ink-600">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-navy-700"
          />
          {t("showResolved")}
        </label>
        <span className="ms-auto inline-flex items-center gap-0.5 rounded-lg bg-mist-100 p-0.5">
          {(["severity", "kind"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                groupBy === g ? "bg-white font-medium text-navy-900 shadow-sm" : "text-ink-600"
              )}
            >
              {t(`groupBy.${g}`)}
            </button>
          ))}
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map(([g, rows]) =>
          rows.length ? (
            <section key={g}>
              <p className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
                {groupBy === "severity" ? t(`severity.${g}` as never) : t(`riskKinds.${g}` as never)}
                <span className="tnum font-medium">{rows.length}</span>
              </p>
              <div className="card divide-y divide-mist-100">
                {rows.map((r) => (
                  <div key={r.id} className={cn("flex items-center gap-3 px-4 py-2.5", r.resolvedAt && "opacity-60")} data-testid="hr-risk-row">
                    <Chip tone={SEVERITY_TONE[r.severity]} className="shrink-0">
                      {t(`severity.${r.severity}` as never)}
                    </Chip>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{r.title}</p>
                      <p className="truncate text-xs text-ink-600">
                        {bi(locale, r.detailEn ?? "", r.detailAr ?? "")}
                        {r.owner ? (
                          <span className="text-ink-400"> · {t("shouldAct", { name: bi(locale, r.owner.nameEn, r.owner.nameAr) })}</span>
                        ) : null}
                        {r.resolvedAt ? (
                          <span className="text-ok"> · {t("resolvedOn", { date: r.resolvedAt.slice(0, 10) })}{r.resolutionNote ? `: ${r.resolutionNote}` : ""}</span>
                        ) : null}
                      </p>
                    </div>
                    <span className="text-[11px] text-ink-400 tnum">{r.detectedAt.slice(0, 10)}</span>
                    {!r.resolvedAt ? (
                      <>
                        <Link
                          href={riskLink(r) as never}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-mist-300 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:border-navy-300 hover:text-navy-700"
                        >
                          {t("actOn")} <ArrowUpRight className="size-3 flip-rtl" />
                        </Link>
                        <button
                          onClick={() => setResolving(r)}
                          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ok hover:bg-ok-light cursor-pointer"
                          data-testid="resolve-risk"
                        >
                          <CheckCircle2 className="size-3.5" /> {t("resolve")}
                        </button>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null
        )}
        {!filtered.length ? (
          <p className="card px-4 py-8 text-center text-sm text-ink-600">{t("noRisks")}</p>
        ) : null}
      </div>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent title={t("resolveTitle")}>
          <p className="mb-3 text-sm text-ink-600">{resolving?.title}</p>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("resolveNote")} aria-label={t("resolveNote")} />
          <div className="mt-4 flex justify-end">
            <Button loading={busy} onClick={resolve}>
              {t("resolve")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
