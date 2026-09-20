"use client";
// CR08 10.1: "Processes this unit owns", the tab the Organisation unit panel
// mounts. It loads itself from /api/v1/processes?view=unit so the unit panel's
// data loader stays untouched: the panel hands it the unit only. Each row is a
// link into the Processes page with that process open, and the footer link
// opens the unit in the by-unit view.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Workflow } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import type { ProcessSummary, UnitRef } from "@/server/services/operating-model";
import { ProcessList } from "@/components/nexus/processes/ProcessList";

type ByUnit = { unit: UnitRef; processes: ProcessSummary[] };

export function UnitProcessesTab({
  unitId,
  unitCode,
  /** the panel may hand the processes over when it already holds them */
  processes: given,
}: {
  unitId: string;
  unitCode: string;
  processes?: ProcessSummary[];
}) {
  const t = useTranslations("processes");
  const [processes, setProcesses] = React.useState<ProcessSummary[] | null>(given ?? null);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (given) return;
    let alive = true;
    setFailed(false);
    void (async () => {
      try {
        const res = await fetch("/api/v1/processes?view=unit");
        const json = (await res.json()) as { data?: { byUnit?: ByUnit[] } };
        if (!alive) return;
        if (!res.ok || !json.data?.byUnit) {
          setFailed(true);
          return;
        }
        setProcesses(json.data.byUnit.find((u) => u.unit.id === unitId)?.processes ?? []);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [unitId, given, attempt]);

  return (
    <section data-testid="unit-processes-tab" data-unit-id={unitId}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600 rtl:tracking-normal" style={{ fontFamily: "inherit" }}>
        {t("unitTab.title")}
      </p>
      {processes === null && !failed ? (
        <div className="flex flex-col gap-1.5" aria-busy>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-2/3 rounded-xl" />
        </div>
      ) : failed ? (
        <div className="rounded-xl border border-dashed border-sand-300 bg-sand-50 px-3 py-5 text-center">
          <p className="text-sm text-ink-600">{t("unitTab.failed")}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => setAttempt((a) => a + 1)} data-testid="unit-processes-retry">
            {t("panel.retry")}
          </Button>
        </div>
      ) : processes?.length ? (
        <ProcessList processes={processes} />
      ) : (
        <EmptyState icon={<Workflow />} title={t("unitTab.empty")} className="py-8" />
      )}
      <Link
        href={`/processes?view=unit&unit=${encodeURIComponent(unitCode)}`}
        className="link-draw mt-3 inline-block text-[11px] font-medium text-maroon-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
      >
        {t("unitTab.openAll")}
      </Link>
    </section>
  );
}
