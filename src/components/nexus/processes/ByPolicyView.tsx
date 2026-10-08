"use client";
// CR08 10.1: the by-policy-type view. The four tabs of the Organisation's
// unit panels across every unit: the documents of the chosen type grouped by
// the unit that publishes them, visibility already applied by the service.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FileStack } from "lucide-react";
import { bi } from "@/lib/utils";
import { Chip, EmptyState } from "@/components/ui/primitives";
import type { PolicyDoc, ProcessMap } from "@/server/services/operating-model";
import type { PolicyTab } from "@/server/services/organisation";
import { PolicyTabStrip } from "./ByUnitView";
import { PolicyDocRow } from "./PolicyDocRow";
import { POLICY_TABS, unitHref } from "./shared";

export function ByPolicyView({
  byPolicyType,
  tab,
  onTab,
}: {
  byPolicyType: ProcessMap["byPolicyType"];
  tab: PolicyTab;
  onTab: (tab: PolicyTab) => void;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const idBase = React.useId();
  const counts = Object.fromEntries(POLICY_TABS.map((k) => [k, byPolicyType.find((x) => x.tab === k)?.documents.length ?? 0])) as Record<PolicyTab, number>;
  const docs = byPolicyType.find((x) => x.tab === tab)?.documents ?? [];

  /* grouped by the publishing unit, in the service's org order */
  const groups: { key: string; unit: PolicyDoc["unit"]; docs: PolicyDoc[] }[] = [];
  for (const d of docs) {
    const key = d.unit?.id ?? "none";
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, unit: d.unit, docs: [] };
      groups.push(g);
    }
    g.docs.push(d);
  }

  return (
    <section aria-label={t("byPolicy.aria")} data-testid="by-policy-view">
      <div className="flex flex-wrap items-center gap-3">
        <PolicyTabStrip tab={tab} counts={counts} onTab={onTab} idBase={idBase} />
        <span className="text-[11px] text-ink-600 tnum">
          {t("byPolicy.docCount", { count: docs.length })}
          {groups.length ? ` · ${t("byPolicy.unitsCount", { count: groups.length })}` : ""}
        </span>
      </div>
      <div role="tabpanel" id={`${idBase}-panel-${tab}`} aria-labelledby={`${idBase}-tab-${tab}`} tabIndex={-1} className="mt-4">
        {docs.length ? (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.key} data-testid="by-policy-group" data-unit={g.unit?.code ?? ""}>
                <p className="mb-2 flex flex-wrap items-center gap-2">
                  {g.unit ? (
                    <Link
                      href={unitHref(g.unit.code)}
                      className="link-draw text-sm font-medium text-navy-700 hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
                    >
                      <span className="me-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400 tnum rtl:tracking-normal">{g.unit.code}</span>
                      {bi(locale, g.unit.nameEn, g.unit.nameAr)}
                    </Link>
                  ) : null}
                  <Chip tone="mist">{t("byPolicy.docCount", { count: g.docs.length })}</Chip>
                </p>
                <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                  {g.docs.map((d, i) => (
                    <PolicyDocRow key={d.id} doc={d} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<FileStack />} title={t("byPolicy.empty")} hint={t("byPolicy.emptyHint")} className="py-10" />
        )}
      </div>
    </section>
  );
}
