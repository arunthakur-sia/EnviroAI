"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Textarea, Label, NativeSelect, Input } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { DelegateBlock } from "@/components/nexus/people/DelegateBlock";

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
            <Label htmlFor="profile-position-en">{te("position")} (EN)</Label>
            <Input id="profile-position-en" value={form.positionEn} dir="ltr" onChange={(e) => set("positionEn", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="profile-position-ar">{te("position")} (AR)</Label>
            <Input id="profile-position-ar" value={form.positionAr} dir="rtl" onChange={(e) => set("positionAr", e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="profile-bio-en">{te("bio")} (EN)</Label>
          <Textarea id="profile-bio-en" value={form.bioEn} dir="ltr" rows={3} onChange={(e) => set("bioEn", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="profile-bio-ar">{te("bio")} (AR)</Label>
          <Textarea id="profile-bio-ar" value={form.bioAr} dir="rtl" rows={3} onChange={(e) => set("bioAr", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="profile-availability">{te("filterAvailability")}</Label>
            <NativeSelect id="profile-availability" value={form.availability} onChange={(e) => set("availability", e.target.value)}>
              {["available", "limited", "unavailable"].map((v) => (
                <option key={v} value={v}>
                  {te(`availability.${v}` as never)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="profile-years">{te("yearsLabel")}</Label>
            <Input
              id="profile-years"
              type="number"
              dir="ltr"
              value={form.yearsExperience ?? ""}
              onChange={(e) => set("yearsExperience", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <Label htmlFor="profile-languages">{t("languagesLabel")}</Label>
            <Input
              id="profile-languages"
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
            <Label htmlFor="profile-locale-pref">{t("languagePref")}</Label>
            <NativeSelect id="profile-locale-pref" value={form.localePref} onChange={(e) => set("localePref", e.target.value as "en" | "ar")}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="profile-numerals-pref">{t("numeralsPref")}</Label>
            <NativeSelect
              id="profile-numerals-pref"
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
          {/* a Radix switch is a button: the wrapping label does not name it */}
          <Switch checked={form.quietMode} onCheckedChange={(v) => set("quietMode", v)} aria-label={t("quietMode")} />
        </label>
        {/* CR05 6.3: sessions end after 12 hours idle and 7 days absolute */}
        <div className="flex items-center justify-between gap-3 border-t border-sand-100 pt-4">
          <span>
            <span className="block text-sm text-ink-900">{t("signOutAll")}</span>
            <span className="block text-xs text-ink-600">{t("signOutAllHint")}</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await fetch("/api/v1/auth/logout-all", { method: "POST" });
              window.location.href = "/login";
            }}
            data-testid="logout-all"
          >
            {t("signOutAllCta")}
          </Button>
        </div>
      </div>

      {/* CR08 9.3: delegate my messages to (self-saving over /api/v1/profile/delegate) */}
      <DelegateBlock />

      <div className="flex justify-end">
        <Button size="lg" loading={busy} onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
