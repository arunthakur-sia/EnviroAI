"use client";
// CR08 10.1: the RACI row of a process. Read: the units as chips grouped R, A,
// C, I with a coloured role badge. Edit (Strategy Office and Super Admins): a
// role select per unit, a picker to add a unit (it joins as Informed and the
// role is changed in place), every change one PUT to
// /api/v1/operating-model/raci; a second Accountable is refused by the API and
// said so in a toast.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Check, Plus } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, NativeSelect } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { RaciRole, UnitRef } from "@/server/services/operating-model";
import { callApi } from "./shared";

const ROLES: readonly RaciRole[] = ["R", "A", "C", "I"];

const ROLE_CLASS: Record<RaciRole, string> = {
  A: "bg-navy-700 text-white",
  R: "bg-teal-600 text-white",
  C: "bg-aqua-300 text-navy-900",
  I: "bg-mist-200 text-ink-600",
};

export function RoleBadge({ role, className }: { role: RaciRole; className?: string }) {
  const t = useTranslations("processes");
  return (
    <span
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tnum", ROLE_CLASS[role], className)}
      title={t(`raci.roles.${role}` as never)}
      aria-label={t(`raci.roles.${role}` as never)}
    >
      {role}
    </span>
  );
}

export function RaciRow({
  processId,
  raci,
  units,
  canEdit,
  onChanged,
}: {
  processId: string;
  raci: { unit: UnitRef; role: RaciRole }[];
  /** every active unit, for the picker */
  units: UnitRef[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("processes");
  const locale = useLocale();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState("");

  const sorted = [...raci].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.unit.nameEn.localeCompare(b.unit.nameEn));
  const inRaci = new Set(raci.map((r) => r.unit.id));
  const candidates = units.filter((u) => !inRaci.has(u.id));

  async function put(unitId: string, role: RaciRole | null) {
    setBusy(unitId);
    try {
      const res = await callApi("/api/v1/operating-model/raci", { method: "PUT", body: { processId, unitId, role } });
      if (res.status === 200) {
        toast(t("raci.saved"), "success");
        onChanged();
      } else if (res.body.error === "accountable_exists") {
        toast(t("raci.accountableExists"), "error");
      } else {
        toast(t("raci.failed"), "error");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div data-testid="process-raci" data-editing={editing || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        {sorted.length ? (
          sorted.map((r) => (
            <span
              key={r.unit.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-mist-200 bg-white px-2 py-1 text-xs text-ink-900"
              data-testid="raci-cell"
              data-role={r.role}
              data-unit={r.unit.code}
            >
              {editing ? (
                <NativeSelect
                  value={r.role}
                  disabled={busy === r.unit.id}
                  aria-label={t("raci.roleFor", { unit: bi(locale, r.unit.nameEn, r.unit.nameAr) })}
                  onChange={(e) => void put(r.unit.id, (e.target.value || null) as RaciRole | null)}
                  className="h-7 w-auto px-1.5 text-[11px]"
                  data-testid="raci-role-select"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role} · {t(`raci.roles.${role}` as never)}
                    </option>
                  ))}
                  <option value="">{t("raci.none")}</option>
                </NativeSelect>
              ) : (
                <RoleBadge role={r.role} />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400 tnum rtl:tracking-normal">{r.unit.code}</span>
              <span className="truncate">{bi(locale, r.unit.nameEn, r.unit.nameAr)}</span>
            </span>
          ))
        ) : (
          <span className="text-xs text-ink-600">{t("panel.noRaci")}</span>
        )}
      </div>
      {canEdit ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <NativeSelect
                value={adding}
                onChange={(e) => {
                  const unitId = e.target.value;
                  setAdding("");
                  if (unitId) void put(unitId, "I");
                }}
                aria-label={t("raci.addUnit")}
                className="h-8 w-auto max-w-64 text-xs"
                data-testid="raci-add-unit"
              >
                <option value="">
                  {t("raci.chooseUnit")}
                </option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} · {bi(locale, u.nameEn, u.nameAr)}
                  </option>
                ))}
              </NativeSelect>
              <Plus className="size-3.5 text-ink-400" aria-hidden />
              <span className="text-[11px] text-ink-600">{t("raci.rule")}</span>
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)} className="ms-auto" data-testid="raci-done">
                <Check /> {t("raci.done")}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} data-testid="raci-edit">
              <Pencil /> {t("raci.edit")}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
