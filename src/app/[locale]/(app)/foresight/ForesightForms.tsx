"use client";
// Simple add-signal and add-risk dialogs.
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Radar, ShieldAlert } from "lucide-react";
import { Button, Input, Textarea, Label, NativeSelect } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

export function ForesightForms() {
  const t = useTranslations("foresight");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();

  const [sOpen, setSOpen] = React.useState(false);
  const [rOpen, setROpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [signal, setSignal] = React.useState({ title: "", description: "", impact: "medium", horizon: "mid" });
  const [risk, setRisk] = React.useState({ title: "", mitigation: "", likelihood: 3, impact: 3 });

  async function addSignal() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/foresight/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signal),
      });
      if (res.ok) {
        toast(t("signalAdded"), "success");
        setSOpen(false);
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function addRisk() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/foresight/risks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(risk),
      });
      if (res.ok) {
        toast(t("riskAdded"), "success");
        setROpen(false);
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Dialog open={sOpen} onOpenChange={setSOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary">
            <Radar /> {t("addSignal")}
          </Button>
        </DialogTrigger>
        <DialogContent title={t("addSignal")}>
          <div className="flex flex-col gap-3.5">
            <div>
              <Label htmlFor="signal-title">{t("signalTitle")}</Label>
              <Input id="signal-title" value={signal.title} onChange={(e) => setSignal({ ...signal, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="signal-description">{t("signalDescription")}</Label>
              <Textarea
                id="signal-description"
                value={signal.description}
                rows={3}
                onChange={(e) => setSignal({ ...signal, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="signal-impact">{t("impactLabel")}</Label>
                <NativeSelect id="signal-impact" value={signal.impact} onChange={(e) => setSignal({ ...signal, impact: e.target.value })}>
                  {["low", "medium", "high"].map((v) => (
                    <option key={v} value={v}>
                      {t(`impact.${v}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="signal-horizon">{t("horizonLabel")}</Label>
                <NativeSelect id="signal-horizon" value={signal.horizon} onChange={(e) => setSignal({ ...signal, horizon: e.target.value })}>
                  {["near", "mid", "long"].map((v) => (
                    <option key={v} value={v}>
                      {t(`horizon.${v}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="flex justify-end">
              <Button loading={busy} onClick={addSignal} disabled={!signal.title.trim()}>
                {tc("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rOpen} onOpenChange={setROpen}>
        <DialogTrigger asChild>
          <Button variant="secondary">
            <ShieldAlert /> {t("addRisk")}
          </Button>
        </DialogTrigger>
        <DialogContent title={t("addRisk")}>
          <div className="flex flex-col gap-3.5">
            <div>
              <Label htmlFor="risk-title">{t("riskTitle")}</Label>
              <Input id="risk-title" value={risk.title} onChange={(e) => setRisk({ ...risk, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="risk-mitigation">{t("mitigation")}</Label>
              <Textarea
                id="risk-mitigation"
                value={risk.mitigation}
                rows={2}
                onChange={(e) => setRisk({ ...risk, mitigation: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="risk-likelihood">
                  {t("likelihoodAxis")}: <span className="tnum">{risk.likelihood}</span>
                </Label>
                <input
                  id="risk-likelihood"
                  type="range"
                  min={1}
                  max={5}
                  value={risk.likelihood}
                  onChange={(e) => setRisk({ ...risk, likelihood: Number(e.target.value) })}
                  className="w-full accent-maroon-700"
                  aria-label={t("likelihoodAxis")}
                />
              </div>
              <div>
                <Label htmlFor="risk-impact">
                  {t("impactAxis")}: <span className="tnum">{risk.impact}</span>
                </Label>
                <input
                  id="risk-impact"
                  type="range"
                  min={1}
                  max={5}
                  value={risk.impact}
                  onChange={(e) => setRisk({ ...risk, impact: Number(e.target.value) })}
                  className="w-full accent-maroon-700"
                  aria-label={t("impactAxis")}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button loading={busy} onClick={addRisk} disabled={!risk.title.trim()}>
                {tc("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
