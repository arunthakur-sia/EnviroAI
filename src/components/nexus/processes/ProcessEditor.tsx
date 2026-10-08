"use client";
// CR08 10.1: the add and edit dialog of a process, over every field of
// ProcessInput: code, level and parent, the names and the purpose in both
// languages, the owner unit, the status, the steps (add, remove, reorder,
// each with a unit and a system), inputs and outputs, systems, KPIs, and the
// governing policies and SOPs picked from the owner unit's documents. One
// POST or PATCH to /api/v1/processes; the API's error codes are named back.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Input, Label, NativeSelect, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, Switch } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type { PolicyDoc, ProcessDetail, ProcessLevel, ProcessSummary, UnitRef } from "@/server/services/operating-model";
import type { PolicyTab } from "@/server/services/organisation";
import { SubHeading, callApi, usePolicyTabLabels } from "./shared";

type StepRow = { key: number; textEn: string; textAr: string; roleUnitCode: string; system: string };
type IoRow = { key: number; textEn: string; textAr: string; fromUnitCode: string };
type PairRow = { key: number; en: string; ar: string };
type KpiRow = { key: number; nameEn: string; nameAr: string; target: string; unit: string };

type Form = {
  code: string;
  level: ProcessLevel;
  parentId: string;
  nameEn: string;
  nameAr: string;
  purposeEn: string;
  purposeAr: string;
  ownerUnitId: string;
  status: "active" | "draft" | "retired";
  isIllustrative: boolean;
  steps: StepRow[];
  inputs: IoRow[];
  outputs: IoRow[];
  systems: PairRow[];
  kpis: KpiRow[];
  policyDocumentIds: string[];
  sopDocumentIds: string[];
};

export type EditorDefaults = { level: ProcessLevel; parentId: string | null; ownerUnitId: string | null };

let keySeq = 1;
const nextKey = () => keySeq++;

function fromDetail(d: ProcessDetail): Form {
  return {
    code: d.code,
    level: d.level,
    parentId: d.parentId ?? "",
    nameEn: d.nameEn,
    nameAr: d.nameAr,
    purposeEn: d.purposeEn ?? "",
    purposeAr: d.purposeAr ?? "",
    ownerUnitId: d.ownerUnit?.id ?? "",
    status: (["active", "draft", "retired"].includes(d.status) ? d.status : "active") as Form["status"],
    isIllustrative: d.isIllustrative,
    steps: d.steps.map((s) => ({ key: nextKey(), textEn: s.textEn, textAr: s.textAr, roleUnitCode: s.roleUnitCode ?? "", system: s.system ?? "" })),
    inputs: d.inputs.map((i) => ({ key: nextKey(), textEn: i.textEn, textAr: i.textAr, fromUnitCode: i.fromUnitCode ?? "" })),
    outputs: d.outputs.map((i) => ({ key: nextKey(), textEn: i.textEn, textAr: i.textAr, fromUnitCode: i.fromUnitCode ?? "" })),
    systems: d.systems.map((s) => ({ key: nextKey(), en: s.nameEn, ar: s.nameAr })),
    kpis: d.kpis.map((k) => ({ key: nextKey(), nameEn: k.nameEn, nameAr: k.nameAr, target: k.target ?? "", unit: k.unit ?? "" })),
    policyDocumentIds: d.policies.map((p) => p.id),
    sopDocumentIds: d.sops.map((p) => p.id),
  };
}

function blank(defaults: EditorDefaults | null): Form {
  return {
    code: "",
    level: defaults?.level ?? 0,
    parentId: defaults?.parentId ?? "",
    nameEn: "",
    nameAr: "",
    purposeEn: "",
    purposeAr: "",
    ownerUnitId: defaults?.ownerUnitId ?? "",
    status: "active",
    isIllustrative: false,
    steps: [],
    inputs: [],
    outputs: [],
    systems: [],
    kpis: [],
    policyDocumentIds: [],
    sopDocumentIds: [],
  };
}

/** The next free code beneath a parent (P4.3 after P4.2), or the next Level 0 code. */
function suggestCode(level: ProcessLevel, parent: ProcessSummary | null, processes: ProcessSummary[]): string {
  const taken = new Set(processes.map((p) => p.code.toUpperCase()));
  if (level === 0 || !parent) {
    let n = processes.filter((p) => p.level === 0).length + 1;
    while (taken.has(`P${n}`)) n++;
    return `P${n}`;
  }
  let n = processes.filter((p) => p.parentId === parent.id).length + 1;
  while (taken.has(`${parent.code}.${n}`.toUpperCase())) n++;
  return `${parent.code}.${n}`;
}

const FIELD = "h-9 text-sm";
const SMALL_ICON = "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-600 hover:bg-mist-100 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500 disabled:cursor-not-allowed disabled:opacity-30";

export function ProcessEditor({
  open,
  mode,
  initial,
  defaults,
  units,
  allowedUnitIds,
  processes,
  unitDocs,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: ProcessDetail | null;
  defaults: EditorDefaults | null;
  /** every active unit */
  units: UnitRef[];
  /** the units the reader may write under; null for any */
  allowedUnitIds: string[] | null;
  /** every process, for the parent picker */
  processes: ProcessSummary[];
  /** the policy documents of every unit, by unit id */
  unitDocs: Record<string, Record<PolicyTab, PolicyDoc[]>>;
  onClose: () => void;
  onSaved: (result: { id: string; code: string }) => void;
}) {
  const t = useTranslations("processes");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const tabLabels = usePolicyTabLabels();
  const uid = React.useId();
  const [form, setForm] = React.useState<Form>(() => (initial ? fromDetail(initial) : blank(defaults)));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* a fresh form each time the dialog opens */
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    const next = initial ? fromDetail(initial) : blank(defaults);
    if (!initial) {
      const parent = next.parentId ? processes.find((p) => p.id === next.parentId) ?? null : null;
      next.code = suggestCode(next.level, parent, processes);
      if (parent && !next.ownerUnitId && parent.ownerUnit) next.ownerUnitId = parent.ownerUnit.id;
    }
    setForm(next);
  }, [open, initial, defaults, processes]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const unitName = (u: UnitRef) => `${u.code} · ${bi(locale, u.nameEn, u.nameAr)}`;
  const pickableUnits = allowedUnitIds ? units.filter((u) => allowedUnitIds.includes(u.id)) : units;
  const parentCandidates = processes
    .filter((p) => p.level < form.level && p.id !== initial?.id)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const ownerDocs = form.ownerUnitId ? unitDocs[form.ownerUnitId] : undefined;
  const policyPool = (ownerDocs ? [...ownerDocs.policy_internal, ...ownerDocs.service] : []) as PolicyDoc[];
  const sopPool = (ownerDocs ? [...ownerDocs.procedure, ...ownerDocs.form_template] : []) as PolicyDoc[];
  const withLinked = (pool: PolicyDoc[], linked: PolicyDoc[]) => [...pool, ...linked.filter((d) => !pool.some((p) => p.id === d.id))];
  const policyChoices = withLinked(policyPool, initial?.policies ?? []);
  const sopChoices = withLinked(sopPool, initial?.sops ?? []);

  function changeLevel(level: ProcessLevel) {
    setForm((f) => {
      const parentStillValid = f.parentId ? (processes.find((p) => p.id === f.parentId)?.level ?? 99) < level : false;
      return { ...f, level, parentId: level === 0 ? "" : parentStillValid ? f.parentId : "" };
    });
  }

  function toggleDoc(kind: "policyDocumentIds" | "sopDocumentIds", id: string) {
    setForm((f) => {
      const has = f[kind].includes(id);
      return { ...f, [kind]: has ? f[kind].filter((x) => x !== id) : [...f[kind], id] };
    });
  }

  const moveStep = (index: number, delta: number) =>
    setForm((f) => {
      const steps = [...f.steps];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return f;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...f, steps };
    });

  const valid = form.code.trim().length > 0 && form.nameEn.trim().length > 0 && form.nameAr.trim().length > 0 && (form.level === 0 || form.parentId);

  async function save() {
    if (!valid) {
      setError(t("editor.errors.invalid"));
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      id: initial?.id,
      code: form.code.trim(),
      level: form.level,
      parentId: form.level === 0 ? null : form.parentId || null,
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim(),
      purposeEn: form.purposeEn.trim() || null,
      purposeAr: form.purposeAr.trim() || null,
      ownerUnitId: form.ownerUnitId || null,
      status: form.status,
      isIllustrative: form.isIllustrative,
      steps: form.steps
        .filter((s) => s.textEn.trim() || s.textAr.trim())
        .map((s, i) => ({ n: i + 1, textEn: s.textEn.trim(), textAr: s.textAr.trim(), roleUnitCode: s.roleUnitCode || null, system: s.system.trim() || null })),
      inputs: form.inputs.filter((i) => i.textEn.trim() || i.textAr.trim()).map((i) => ({ textEn: i.textEn.trim(), textAr: i.textAr.trim(), fromUnitCode: i.fromUnitCode || null })),
      outputs: form.outputs.filter((i) => i.textEn.trim() || i.textAr.trim()).map((i) => ({ textEn: i.textEn.trim(), textAr: i.textAr.trim(), fromUnitCode: i.fromUnitCode || null })),
      systems: form.systems.filter((s) => s.en.trim() || s.ar.trim()).map((s) => ({ nameEn: s.en.trim() || s.ar.trim(), nameAr: s.ar.trim() || s.en.trim() })),
      kpis: form.kpis.filter((k) => k.nameEn.trim() || k.nameAr.trim()).map((k) => ({ nameEn: k.nameEn.trim(), nameAr: k.nameAr.trim(), target: k.target.trim() || null, unit: k.unit.trim() || null })),
      policyDocumentIds: form.policyDocumentIds,
      sopDocumentIds: form.sopDocumentIds,
    };
    try {
      const res = await callApi<{ id: string }>("/api/v1/processes", { method: mode === "edit" ? "PATCH" : "POST", body });
      if (res.status === 200 && res.body.data) {
        toast(t("editor.saved"), "success");
        onSaved({ id: res.body.data.id, code: body.code });
        return;
      }
      const code = res.body.error ?? "invalid";
      const known = ["code_taken", "code_required", "parent_required", "parent_level_invalid", "would_create_a_cycle", "forbidden", "invalid", "unknown_unit"];
      setError(known.includes(code) ? t(`editor.errors.${code}` as never) : t("editor.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  const unitSelect = (value: string, onChange: (v: string) => void, label: string, extra?: { any: string; testId?: string }) => (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={FIELD} data-testid={extra?.testId}>
      <option value="">{extra?.any ?? t("editor.anyUnit")}</option>
      {units.map((u) => (
        <option key={u.id} value={u.code}>
          {unitName(u)}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        title={mode === "edit" ? t("editor.editTitle", { code: initial?.code ?? "" }) : t("editor.addTitle")}
        /* above the 520px process panel (z-60), which opens it */
        /* pb-0: the sticky action bar carries the bottom padding itself, so no
           field peeks out beneath it */
        className="z-[75] max-h-[90vh] w-[min(820px,94vw)] overflow-y-auto pb-0"
        data-testid="process-editor"
        data-editor-dialog
        /* Escape belongs to the dialog alone: preventDefault marks the event so
           the panel beneath it leaves the same keystroke alone */
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          if (!busy) onClose();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-col gap-6"
        >
          {/* basics */}
          <section>
            <SubHeading>{t("editor.sections.basics")}</SubHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor={`${uid}-code`}>{t("editor.code")}</Label>
                <Input id={`${uid}-code`} value={form.code} onChange={(e) => set("code", e.target.value)} className={cn(FIELD, "tnum")} required data-testid="editor-code" />
                <p className="mt-1 text-[11px] text-ink-400">{t("editor.codeHint")}</p>
              </div>
              <div>
                <Label htmlFor={`${uid}-level`}>{t("editor.level")}</Label>
                <NativeSelect id={`${uid}-level`} value={String(form.level)} onChange={(e) => changeLevel(Number(e.target.value) as ProcessLevel)} className={FIELD} data-testid="editor-level">
                  {([0, 1, 2] as ProcessLevel[]).map((l) => (
                    <option key={l} value={l}>
                      {t(`level.${l}` as never)} · {t(`levelName.${l}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor={`${uid}-parent`}>{t("editor.parent")}</Label>
                <NativeSelect id={`${uid}-parent`} value={form.parentId} disabled={form.level === 0} onChange={(e) => set("parentId", e.target.value)} className={FIELD} data-testid="editor-parent">
                  <option value="">{t("editor.noParent")}</option>
                  {parentCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {bi(locale, p.nameEn, p.nameAr)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div dir="ltr" className="sm:col-span-1">
                <Label htmlFor={`${uid}-name-en`}>{t("editor.nameEn")}</Label>
                <Input id={`${uid}-name-en`} lang="en" value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} className={FIELD} required data-testid="editor-name-en" />
              </div>
              <div dir="rtl" className="sm:col-span-1">
                <Label htmlFor={`${uid}-name-ar`}>{t("editor.nameAr")}</Label>
                <Input id={`${uid}-name-ar`} lang="ar" value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} className={FIELD} required data-testid="editor-name-ar" />
              </div>
              <div>
                <Label htmlFor={`${uid}-owner`}>{t("editor.ownerUnit")}</Label>
                <NativeSelect id={`${uid}-owner`} value={form.ownerUnitId} onChange={(e) => set("ownerUnitId", e.target.value)} className={FIELD} data-testid="editor-owner">
                  {allowedUnitIds ? null : <option value="">{t("editor.noOwner")}</option>}
                  {pickableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {unitName(u)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div dir="ltr" className="sm:col-span-1">
                <Label htmlFor={`${uid}-purpose-en`}>{t("editor.purposeEn")}</Label>
                <Textarea id={`${uid}-purpose-en`} lang="en" value={form.purposeEn} onChange={(e) => set("purposeEn", e.target.value)} className="min-h-20 text-sm" />
              </div>
              <div dir="rtl" className="sm:col-span-1">
                <Label htmlFor={`${uid}-purpose-ar`}>{t("editor.purposeAr")}</Label>
                <Textarea id={`${uid}-purpose-ar`} lang="ar" value={form.purposeAr} onChange={(e) => set("purposeAr", e.target.value)} className="min-h-20 text-sm" />
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor={`${uid}-status`}>{t("editor.status")}</Label>
                  <NativeSelect id={`${uid}-status`} value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])} className={FIELD}>
                    {(["active", "draft", "retired"] as const).map((s) => (
                      <option key={s} value={s}>
                        {t(`panel.status.${s}` as never)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-ink-900">
                  <Switch checked={form.isIllustrative} onCheckedChange={(v) => set("isIllustrative", Boolean(v))} aria-label={t("editor.illustrative")} />
                  <span>
                    <span className="block font-medium">{t("editor.illustrative")}</span>
                    <span className="block text-[11px] text-ink-600">{t("editor.illustrativeHint")}</span>
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* steps */}
          <section>
            <SubHeading>{t("editor.sections.steps")}</SubHeading>
            {form.steps.length ? (
              <ol className="flex flex-col gap-2" data-testid="editor-steps">
                {form.steps.map((s, i) => (
                  <li key={s.key} className="rounded-xl border border-mist-200 bg-mist-50 p-2.5" data-testid="editor-step">
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-700 text-[11px] font-semibold text-white tnum" aria-hidden>
                        {i + 1}
                      </span>
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input dir="ltr" lang="en" value={s.textEn} placeholder={t("editor.stepEn")} aria-label={`${t("editor.stepEn")} ${i + 1}`} onChange={(e) => set("steps", form.steps.map((x) => (x.key === s.key ? { ...x, textEn: e.target.value } : x)))} className={FIELD} />
                        <Input dir="rtl" lang="ar" value={s.textAr} placeholder={t("editor.stepAr")} aria-label={`${t("editor.stepAr")} ${i + 1}`} onChange={(e) => set("steps", form.steps.map((x) => (x.key === s.key ? { ...x, textAr: e.target.value } : x)))} className={FIELD} />
                        {unitSelect(s.roleUnitCode, (v) => set("steps", form.steps.map((x) => (x.key === s.key ? { ...x, roleUnitCode: v } : x))), `${t("editor.roleUnit")} ${i + 1}`)}
                        <Input value={s.system} placeholder={t("editor.system")} aria-label={`${t("editor.system")} ${i + 1}`} onChange={(e) => set("steps", form.steps.map((x) => (x.key === s.key ? { ...x, system: e.target.value } : x)))} className={FIELD} />
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <button type="button" className={SMALL_ICON} disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label={t("editor.moveUp", { n: i + 1 })}>
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button type="button" className={SMALL_ICON} disabled={i === form.steps.length - 1} onClick={() => moveStep(i, 1)} aria-label={t("editor.moveDown", { n: i + 1 })}>
                          <ArrowDown className="size-3.5" />
                        </button>
                        <button type="button" className={cn(SMALL_ICON, "hover:text-danger")} onClick={() => set("steps", form.steps.filter((x) => x.key !== s.key))} aria-label={t("editor.removeStep", { n: i + 1 })}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed border-mist-300 bg-mist-50 px-3 py-3 text-center text-xs text-ink-600">{t("editor.noSteps")}</p>
            )}
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => set("steps", [...form.steps, { key: nextKey(), textEn: "", textAr: "", roleUnitCode: "", system: "" }])} data-testid="editor-add-step">
              <Plus /> {t("editor.addStep")}
            </Button>
          </section>

          {/* inputs and outputs */}
          <section>
            <SubHeading>{t("editor.sections.io")}</SubHeading>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {(["inputs", "outputs"] as const).map((kind) => (
                <div key={kind} className="rounded-xl border border-mist-200 p-2.5">
                  <p className="mb-2 text-xs font-medium text-ink-900">{t(`panel.${kind}`)}</p>
                  <div className="flex flex-col gap-2">
                    {form[kind].map((row, i) => (
                      <div key={row.key} className="flex items-start gap-1.5">
                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
                          <Input dir="ltr" lang="en" value={row.textEn} placeholder={t("editor.textEn")} aria-label={`${t(`panel.${kind}`)} ${t("editor.textEn")} ${i + 1}`} onChange={(e) => set(kind, form[kind].map((x) => (x.key === row.key ? { ...x, textEn: e.target.value } : x)))} className={FIELD} />
                          <Input dir="rtl" lang="ar" value={row.textAr} placeholder={t("editor.textAr")} aria-label={`${t(`panel.${kind}`)} ${t("editor.textAr")} ${i + 1}`} onChange={(e) => set(kind, form[kind].map((x) => (x.key === row.key ? { ...x, textAr: e.target.value } : x)))} className={FIELD} />
                          {unitSelect(row.fromUnitCode, (v) => set(kind, form[kind].map((x) => (x.key === row.key ? { ...x, fromUnitCode: v } : x))), `${t("editor.fromUnit")} ${i + 1}`, { any: t("editor.fromUnit") })}
                        </div>
                        <button type="button" className={cn(SMALL_ICON, "hover:text-danger")} onClick={() => set(kind, form[kind].filter((x) => x.key !== row.key))} aria-label={t("editor.remove")}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="mt-1.5" onClick={() => set(kind, [...form[kind], { key: nextKey(), textEn: "", textAr: "", fromUnitCode: "" }])}>
                    <Plus /> {kind === "inputs" ? t("editor.addInput") : t("editor.addOutput")}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* systems and KPIs */}
          <section>
            <SubHeading>{t("editor.sections.systemsKpis")}</SubHeading>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-mist-200 p-2.5">
                <p className="mb-2 text-xs font-medium text-ink-900">{t("panel.systems")}</p>
                <div className="flex flex-col gap-1.5">
                  {form.systems.map((row, i) => (
                    <div key={row.key} className="flex items-center gap-1.5">
                      <Input dir="ltr" lang="en" value={row.en} placeholder={t("editor.systemEn")} aria-label={`${t("editor.systemEn")} ${i + 1}`} onChange={(e) => set("systems", form.systems.map((x) => (x.key === row.key ? { ...x, en: e.target.value } : x)))} className={FIELD} />
                      <Input dir="rtl" lang="ar" value={row.ar} placeholder={t("editor.systemAr")} aria-label={`${t("editor.systemAr")} ${i + 1}`} onChange={(e) => set("systems", form.systems.map((x) => (x.key === row.key ? { ...x, ar: e.target.value } : x)))} className={FIELD} />
                      <button type="button" className={cn(SMALL_ICON, "hover:text-danger")} onClick={() => set("systems", form.systems.filter((x) => x.key !== row.key))} aria-label={t("editor.remove")}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button type="button" size="sm" variant="ghost" className="mt-1.5" onClick={() => set("systems", [...form.systems, { key: nextKey(), en: "", ar: "" }])}>
                  <Plus /> {t("editor.addSystem")}
                </Button>
              </div>
              <div className="rounded-xl border border-mist-200 p-2.5">
                <p className="mb-2 text-xs font-medium text-ink-900">{t("panel.kpis")}</p>
                <div className="flex flex-col gap-2">
                  {form.kpis.map((row, i) => (
                    <div key={row.key} className="flex items-start gap-1.5">
                      <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
                        <Input dir="ltr" lang="en" value={row.nameEn} placeholder={t("editor.kpiEn")} aria-label={`${t("editor.kpiEn")} ${i + 1}`} onChange={(e) => set("kpis", form.kpis.map((x) => (x.key === row.key ? { ...x, nameEn: e.target.value } : x)))} className={FIELD} />
                        <Input dir="rtl" lang="ar" value={row.nameAr} placeholder={t("editor.kpiAr")} aria-label={`${t("editor.kpiAr")} ${i + 1}`} onChange={(e) => set("kpis", form.kpis.map((x) => (x.key === row.key ? { ...x, nameAr: e.target.value } : x)))} className={FIELD} />
                        <Input value={row.target} placeholder={t("editor.target")} aria-label={`${t("editor.target")} ${i + 1}`} onChange={(e) => set("kpis", form.kpis.map((x) => (x.key === row.key ? { ...x, target: e.target.value } : x)))} className={cn(FIELD, "tnum")} />
                        <Input value={row.unit} placeholder={t("editor.unit")} aria-label={`${t("editor.unit")} ${i + 1}`} onChange={(e) => set("kpis", form.kpis.map((x) => (x.key === row.key ? { ...x, unit: e.target.value } : x)))} className={FIELD} />
                      </div>
                      <button type="button" className={cn(SMALL_ICON, "hover:text-danger")} onClick={() => set("kpis", form.kpis.filter((x) => x.key !== row.key))} aria-label={t("editor.remove")}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button type="button" size="sm" variant="ghost" className="mt-1.5" onClick={() => set("kpis", [...form.kpis, { key: nextKey(), nameEn: "", nameAr: "", target: "", unit: "" }])}>
                  <Plus /> {t("editor.addKpi")}
                </Button>
              </div>
            </div>
          </section>

          {/* policies and SOPs */}
          <section>
            <SubHeading>{t("editor.sections.documents")}</SubHeading>
            <p className="mb-2 text-[11px] text-ink-600">{t("editor.docsHint")}</p>
            {!form.ownerUnitId ? (
              <p className="rounded-lg border border-dashed border-mist-300 bg-mist-50 px-3 py-3 text-center text-xs text-ink-600">{t("editor.chooseOwnerFirst")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {(
                  [
                    ["policyDocumentIds", t("editor.policies"), policyChoices],
                    ["sopDocumentIds", t("editor.sops"), sopChoices],
                  ] as const
                ).map(([kind, label, choices]) => (
                  <div key={kind} className="rounded-xl border border-mist-200 p-2.5" data-testid={`editor-${kind}`}>
                    <p className="mb-2 text-xs font-medium text-ink-900">{label}</p>
                    {choices.length ? (
                      <ul className="flex flex-col gap-1">
                        {choices.map((d) => {
                          const checked = form[kind].includes(d.id);
                          const foreign = d.unit && d.unit.id !== form.ownerUnitId;
                          return (
                            <li key={d.id}>
                              <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-xs text-ink-900 hover:bg-mist-50">
                                <input type="checkbox" checked={checked} onChange={() => toggleDoc(kind, d.id)} className="mt-0.5 size-3.5 shrink-0 cursor-pointer rounded border-mist-300" style={{ accentColor: "var(--color-navy-700)" }} />
                                <span className="min-w-0">
                                  <span className="block leading-snug">{bi(locale, d.titleEn, d.titleAr)}</span>
                                  <span className="block text-[10px] text-ink-400">
                                    {tabLabels[d.tab]}
                                    {d.versionLabel ? ` · ${t("docs.version", { version: d.versionLabel })}` : ""}
                                    {foreign && d.unit ? ` · ${t("docs.linkedFrom", { unit: bi(locale, d.unit.nameEn, d.unit.nameAr) })}` : ""}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-ink-600">{t("editor.noUnitDocs")}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* the form is long: the actions and any error stay at the foot of
              the dialog rather than at the end of a scroll */}
          <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-2 border-t border-mist-100 bg-white px-6 pb-6 pt-3">
            {error ? (
              <p role="alert" className="me-auto rounded-lg bg-danger-light px-3 py-2 text-xs text-danger" data-testid="editor-error">
                {error}
              </p>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={busy} disabled={!valid} data-testid="editor-save">
              {t("editor.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
