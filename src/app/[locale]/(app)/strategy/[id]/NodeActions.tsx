"use client";
// Status update composer + KPI value entry + the CR05 leads editor, in dialogs.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MessageSquarePlus, Gauge, Building2, Plus, X } from "lucide-react";
import {
  Button,
  Textarea,
  Label,
  NativeSelect,
  Input,
} from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { bi } from "@/lib/utils";
import type { LeadChip } from "@/server/services/strategy";

/* CR05 2.2: the leads editor. Two pickers (lead departments, lead entities)
   plus Supporting, with entity search and create-new. Replaces on save. */
function LeadsEditor({
  nodeId,
  departments,
}: {
  nodeId: string;
  departments: { id: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("strategy.leadsEditor");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<LeadChip[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [deptPick, setDeptPick] = React.useState("");
  const [entityQ, setEntityQ] = React.useState("");
  const [entityRole, setEntityRole] = React.useState<"lead" | "supporting">("lead");
  const [hits, setHits] = React.useState<
    { id: string; nameEn: string; nameAr: string; kind: string }[]
  >([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/v1/strategy/leads?nodeId=${encodeURIComponent(nodeId)}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded, nodeId]);

  React.useEffect(() => {
    if (entityQ.trim().length < 2) {
      setHits([]);
      return;
    }
    const h = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/entities?q=${encodeURIComponent(entityQ.trim())}`);
        const j = await res.json();
        setHits(j.data ?? []);
      } catch {
        setHits([]);
      }
    }, 250);
    return () => clearTimeout(h);
  }, [entityQ]);

  const addRow = (chip: LeadChip) => {
    setRows((r) =>
      r.some((x) => x.kind === chip.kind && x.id === chip.id && x.role === chip.role)
        ? r
        : [...r, chip]
    );
  };

  async function createEntity() {
    const name = entityQ.trim();
    if (name.length < 2) return;
    const res = await fetch("/api/v1/entities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nameEn: name, kind: "other" }),
    });
    const j = await res.json();
    if (j.data) {
      addRow({
        kind: "entity",
        role: entityRole,
        id: j.data.id,
        nameEn: j.data.nameEn,
        nameAr: j.data.nameAr,
        shortEn: j.data.shortNameEn ?? j.data.nameEn,
        shortAr: j.data.shortNameAr ?? j.data.nameAr,
        entityKind: j.data.kind,
        verified: true,
      });
      setEntityQ("");
      setHits([]);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/strategy/leads", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nodeId,
          leads: rows.map((r) => ({ kind: r.kind, id: r.id, role: r.role })),
        }),
      });
      if (res.ok) {
        toast(t("saved"), "points");
        setOpen(false);
        router.refresh();
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  const group = (role: "lead" | "supporting") => rows.filter((r) => r.role === role);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" data-testid="edit-leads">
          <Building2 /> {t("cta")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("title")}>
        <div className="flex flex-col gap-4">
          {(["lead", "supporting"] as const).map((role) => (
            <div key={role}>
              {/* names the chips already chosen, which are not a form control */}
              <span id={`leads-${role}-label`} className="mb-1.5 block text-xs font-medium text-ink-600">
                {role === "lead" ? t("leads") : t("supporting")}
              </span>
              <div
                className="mt-1 flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-sand-300 bg-sand-50 p-1.5"
                role="group"
                aria-labelledby={`leads-${role}-label`}
              >
                {group(role).map((r) => (
                  <span
                    key={`${r.kind}:${r.id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-xs shadow-sm"
                  >
                    {bi(locale, r.nameEn, r.nameAr)}
                    <button
                      aria-label={tc("remove")}
                      onClick={() =>
                        setRows((rs) =>
                          rs.filter((x) => !(x.kind === r.kind && x.id === r.id && x.role === role))
                        )
                      }
                      className="text-ink-400 hover:text-danger cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {!group(role).length ? (
                  <span className="px-1 text-xs text-ink-400">{t("none")}</span>
                ) : null}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="leads-add-department">{t("addDepartment")}</Label>
              <div className="flex gap-1.5">
                <NativeSelect id="leads-add-department" value={deptPick} onChange={(e) => setDeptPick(e.target.value)} className="flex-1">
                  <option value="">{t("pickDepartment")}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {bi(locale, d.nameEn, d.nameAr)}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!deptPick}
                  onClick={() => {
                    const d = departments.find((x) => x.id === deptPick);
                    if (d)
                      addRow({
                        kind: "department",
                        role: "lead",
                        id: d.id,
                        nameEn: d.nameEn,
                        nameAr: d.nameAr,
                        shortEn: d.nameEn.replace(/^Department of /i, ""),
                        shortAr: d.nameAr.replace(/^إدارة /, ""),
                        entityKind: null,
                        verified: true,
                      });
                  }}
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <div>
              {/* two controls under one caption, each already named in place */}
              <span id="leads-add-entity-label" className="mb-1.5 block text-xs font-medium text-ink-600">
                {t("addEntity")}
              </span>
              <div className="flex gap-1.5" role="group" aria-labelledby="leads-add-entity-label">
                <NativeSelect
                  value={entityRole}
                  onChange={(e) => setEntityRole(e.target.value as "lead" | "supporting")}
                  className="w-32"
                  aria-label={t("entityRole")}
                >
                  <option value="lead">{t("asLead")}</option>
                  <option value="supporting">{t("asSupporting")}</option>
                </NativeSelect>
                <div className="relative flex-1">
                  <Input
                    value={entityQ}
                    onChange={(e) => setEntityQ(e.target.value)}
                    placeholder={t("entityPlaceholder")}
                    aria-label={t("entityPlaceholder")}
                  />
                  {entityQ.trim().length >= 2 ? (
                    <div className="absolute top-11 z-30 w-full overflow-hidden rounded-xl border border-sand-300 bg-white shadow-[var(--shadow-pop)]">
                      {hits.map((h) => (
                        <button
                          key={h.id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-maroon-100/50 cursor-pointer"
                          onClick={() => {
                            addRow({
                              kind: "entity",
                              role: entityRole,
                              id: h.id,
                              nameEn: h.nameEn,
                              nameAr: h.nameAr,
                              shortEn: h.nameEn,
                              shortAr: h.nameAr,
                              entityKind: h.kind,
                              verified: true,
                            });
                            setEntityQ("");
                            setHits([]);
                          }}
                        >
                          <span className="truncate">{bi(locale, h.nameEn, h.nameAr)}</span>
                          <span className="ms-auto text-xs text-ink-400">{h.kind}</span>
                        </button>
                      ))}
                      <button
                        className="flex w-full items-center gap-2 bg-sand-50 px-3 py-2 text-start text-sm font-medium text-maroon-700 hover:bg-maroon-100/50 cursor-pointer"
                        onClick={createEntity}
                      >
                        <Plus className="size-3.5" /> {t("createNew", { name: entityQ.trim() })}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button loading={busy} onClick={save}>
              {tc("save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NodeActions({
  nodeId,
  kpis,
  departments = [],
  canEditLeads = false,
}: {
  nodeId: string;
  kpis: { id: string; nameEn: string; nameAr: string; unit: string | null }[];
  departments?: { id: string; nameEn: string; nameAr: string }[];
  canEditLeads?: boolean;
}) {
  const t = useTranslations("strategy");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();

  // status update state
  const [updOpen, setUpdOpen] = React.useState(false);
  const [status, setStatus] = React.useState("on_track");
  const [progress, setProgress] = React.useState(50);
  const [summary, setSummary] = React.useState("");
  const [risks, setRisks] = React.useState("");
  const [nextSteps, setNextSteps] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // kpi entry state
  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [kpiId, setKpiId] = React.useState(kpis[0]?.id ?? "");
  const [period, setPeriod] = React.useState("");
  const [value, setValue] = React.useState("");

  async function postUpdate() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/strategy/updates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nodeId,
          status,
          progressPct: progress,
          summaryEn: summary,
          risks: risks
            .split("\n")
            .filter(Boolean)
            .map((r) => ({ text_en: r })),
          nextSteps: nextSteps
            .split("\n")
            .filter(Boolean)
            .map((s) => ({ text_en: s })),
        }),
      });
      if (res.ok) {
        toast(t("updatePosted"), "points");
        setUpdOpen(false);
        router.refresh();
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function postKpiValue() {
    if (!kpiId || !period || !value) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/strategy/kpis/${kpiId}/values`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ period, value: Number(value) }),
      });
      if (res.ok) {
        toast(t("kpiValueSaved"), "points");
        setKpiOpen(false);
        router.refresh();
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canEditLeads ? <LeadsEditor nodeId={nodeId} departments={departments} /> : null}
      <Dialog open={updOpen} onOpenChange={setUpdOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary">
            <MessageSquarePlus /> {t("postUpdate")}
          </Button>
        </DialogTrigger>
        <DialogContent title={t("postUpdate")}>
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="node-status">{t("statusLabel")}</Label>
                <NativeSelect id="node-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["not_started", "on_track", "at_risk", "delayed", "completed"].map((s) => (
                    <option key={s} value={s}>
                      {tc(`status.${s}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="node-progress">
                  {t("progress")}: <span className="tnum">{progress}%</span>
                </Label>
                <input
                  id="node-progress"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="mt-2.5 w-full accent-maroon-700"
                  aria-label={t("progress")}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="node-summary">{t("updateSummary")}</Label>
              <Textarea id="node-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
            </div>
            <div>
              <Label htmlFor="node-risks">{t("risksLines")}</Label>
              <Textarea id="node-risks" value={risks} onChange={(e) => setRisks(e.target.value)} rows={2} />
            </div>
            <div>
              <Label htmlFor="node-next-steps">{t("nextStepsLines")}</Label>
              <Textarea id="node-next-steps" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end">
              <Button loading={busy} onClick={postUpdate}>
                {t("postUpdateCta")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {kpis.length ? (
        <Dialog open={kpiOpen} onOpenChange={setKpiOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary">
              <Gauge /> {t("enterKpiValue")}
            </Button>
          </DialogTrigger>
          <DialogContent title={t("enterKpiValue")}>
            <div className="flex flex-col gap-3.5">
              <div>
                <Label htmlFor="node-kpi">{t("kpi")}</Label>
                <NativeSelect id="node-kpi" value={kpiId} onChange={(e) => setKpiId(e.target.value)}>
                  {kpis.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nameEn}
                      {k.unit ? ` (${k.unit})` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="node-period">{t("period")}</Label>
                  <Input
                    id="node-period"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="2026-Q3"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label htmlFor="node-value">{t("valueLabel")}</Label>
                  <Input
                    id="node-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    type="number"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button loading={busy} onClick={postKpiValue}>
                  {tc("save")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
