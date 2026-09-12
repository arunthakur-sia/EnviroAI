"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Textarea, Label, NativeSelect, Input } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

type Initial = {
  bioEn: string;
  bioAr: string;
  positionEn: string;
  positionAr: string;
  availability: string;
  languages: string[];
  yearsExperience: number | null;
  localePref: "en" | "ar";
  numeralsPref: "western" | "eastern";
  quietMode: boolean;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const t = useTranslations("profile");
  const te = useTranslations("experts");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          yearsExperience: form.yearsExperience,
        }),
      });
      if (res.ok) {
        toast(t("saved"), "success");
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-5">
        <p className="text-sm font-medium text-ink-900">{t("aboutSection")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{te("position")} (EN)</Label>
            <Input value={form.positionEn} dir="ltr" onChange={(e) => set("positionEn", e.target.value)} />
          </div>
          <div>
            <Label>{te("position")} (AR)</Label>
            <Input value={form.positionAr} dir="rtl" onChange={(e) => set("positionAr", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>{te("bio")} (EN)</Label>
          <Textarea value={form.bioEn} dir="ltr" rows={3} onChange={(e) => set("bioEn", e.target.value)} />
        </div>
        <div>
          <Label>{te("bio")} (AR)</Label>
          <Textarea value={form.bioAr} dir="rtl" rows={3} onChange={(e) => set("bioAr", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>{te("filterAvailability")}</Label>
            <NativeSelect value={form.availability} onChange={(e) => set("availability", e.target.value)}>
              {["available", "limited", "unavailable"].map((v) => (
                <option key={v} value={v}>
                  {te(`availability.${v}` as never)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>{te("yearsLabel")}</Label>
            <Input
              type="number"
              dir="ltr"
              value={form.yearsExperience ?? ""}
              onChange={(e) => set("yearsExperience", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>{t("languagesLabel")}</Label>
            <Input
              value={form.languages.join(", ")}
              onChange={(e) =>
                set(
                  "languages",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
              placeholder={t("languagesPlaceholder")}
            />
          </div>
        </div>
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <p className="text-sm font-medium text-ink-900">{t("preferences")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("languagePref")}</Label>
            <NativeSelect value={form.localePref} onChange={(e) => set("localePref", e.target.value as "en" | "ar")}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </NativeSelect>
          </div>
          <div>
            <Label>{t("numeralsPref")}</Label>
            <NativeSelect
              value={form.numeralsPref}
              onChange={(e) => set("numeralsPref", e.target.value as "western" | "eastern")}
            >
              <option value="western">{t("numeralsWestern")}</option>
              <option value="eastern">{t("numeralsEastern")}</option>
            </NativeSelect>
          </div>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm text-ink-900">{t("quietMode")}</span>
            <span className="block text-xs text-ink-600">{t("quietModeHint")}</span>
          </span>
          <Switch checked={form.quietMode} onCheckedChange={(v) => set("quietMode", v)} />
        </label>
      </div>

      <div className="flex justify-end">
        <Button size="lg" loading={busy} onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
