"use client";
// Status update composer + KPI value entry, in dialogs.
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MessageSquarePlus, Gauge } from "lucide-react";
import {
  Button,
  Textarea,
  Label,
  NativeSelect,
  Input,
} from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

export function NodeActions({
  nodeId,
  kpis,
}: {
  nodeId: string;
  kpis: { id: string; nameEn: string; nameAr: string; unit: string | null }[];
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
                <Label>{t("statusLabel")}</Label>
                <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["not_started", "on_track", "at_risk", "delayed", "completed"].map((s) => (
                    <option key={s} value={s}>
                      {tc(`status.${s}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>
                  {t("progress")}: <span className="tnum">{progress}%</span>
                </Label>
                <input
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
              <Label>{t("updateSummary")}</Label>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>{t("risksLines")}</Label>
              <Textarea value={risks} onChange={(e) => setRisks(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>{t("nextStepsLines")}</Label>
              <Textarea value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} rows={2} />
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
                <Label>{t("kpi")}</Label>
                <NativeSelect value={kpiId} onChange={(e) => setKpiId(e.target.value)}>
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
                  <Label>{t("period")}</Label>
                  <Input
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="2026-Q3"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>{t("valueLabel")}</Label>
                  <Input
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
