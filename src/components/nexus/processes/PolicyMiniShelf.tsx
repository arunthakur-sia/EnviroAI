"use client";
// CR08 10.1: the governing policies and SOPs of a process as a mini shelf of
// the Library's real books (140px, the project mini shelf height), with a
// legend beneath naming each book's tab, version and effective date.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Shelf } from "@/components/nexus/Shelf";
import type { PolicyDoc } from "@/server/services/operating-model";
import { PolicyDocRow } from "./PolicyDocRow";
import { SubHeading, toShelfDoc, usePolicyTabLabels } from "./shared";

export function PolicyMiniShelf({ policies, sops }: { policies: PolicyDoc[]; sops: PolicyDoc[] }) {
  const t = useTranslations("processes");
  const tabLabels = usePolicyTabLabels();
  const docs = [...policies, ...sops.filter((s) => !policies.some((p) => p.id === s.id))];
  if (!docs.length) {
    return (
      <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-4 text-center text-xs text-ink-600" data-testid="process-docs-empty">
        {t("panel.noDocuments")}
      </p>
    );
  }
  return (
    <div data-testid="process-mini-shelf">
      <Shelf docs={docs.map((d) => toShelfDoc(d, tabLabels))} height={140} className="mb-3" />
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {policies.length ? (
          <div>
            <SubHeading>{t("panel.policies")}</SubHeading>
            <div className="divide-y divide-sand-100">
              {policies.map((d, i) => (
                <PolicyDocRow key={d.id} doc={d} index={i} compact />
              ))}
            </div>
          </div>
        ) : null}
        {sops.length ? (
          <div>
            <SubHeading>{t("panel.sops")}</SubHeading>
            <div className="divide-y divide-sand-100">
              {sops.map((d, i) => (
                <PolicyDocRow key={d.id} doc={d} index={i} compact />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
