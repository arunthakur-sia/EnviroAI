"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sparkles } from "lucide-react";
import { cn, bi, isArabicText } from "@/lib/utils";
import { AVAILABILITY_VALUES, EXTERNAL_TYPES, KNOWN_COUNTRIES } from "@/lib/experts-constants";
import {
  Button,
  Input,
  Textarea,
  Label,
  NativeSelect,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export function NewExpertForm({
  topics,
}: {
  topics: { code: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("experts");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [cv, setCv] = React.useState("");
  const [form, setForm] = React.useState({
    nameEn: "",
    nameAr: "",
    type: "academic",
    organisationEn: "",
    organisationAr: "",
    positionEn: "",
    positionAr: "",
    bioEn: "",
    bioAr: "",
    email: "",
    phone: "",
    nationality: "",
    country: "QA",
    yearsExperience: "",
    availability: "available",
    domainCodes: [] as string[],
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Heuristic CV prefill: first line = name, look for org/position/email patterns. */
  function prefill() {
    const lines = cv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const first = lines[0];
    if (isArabicText(first)) set("nameAr", first);
    else set("nameEn", first);
    const email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(cv)?.[0];
    if (email) set("email", email);
    const years = /(\d{1,2})\+?\s*(years|سنة|عاماً)/i.exec(cv)?.[1];
    if (years) set("yearsExperience", years);
    const orgLine = lines.find((l) => /(university|institute|ministry|bank|جامعة|وزارة|معهد)/i.test(l));
    if (orgLine) {
      if (isArabicText(orgLine)) set("organisationAr", orgLine.slice(0, 90));
      else set("organisationEn", orgLine.slice(0, 90));
    }
    const bio = lines.slice(1, 5).join(" ").slice(0, 500);
    if (bio) {
      if (isArabicText(bio)) set("bioAr", bio);
      else set("bioEn", bio);
    }
    toast(t("prefilled"), "info");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/v1/experts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          nameAr: form.nameAr || form.nameEn,
          nameEn: form.nameEn || form.nameAr,
          yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(t("expertAdded"), "points");
      router.push(`/experts/${json.data.id}` as never);
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4" data-testid="new-expert-form">
      <div className="card p-4">
        <Label htmlFor="cv">{t("cvPaste")}</Label>
        <Textarea id="cv" value={cv} onChange={(e) => setCv(e.target.value)} rows={4} placeholder={t("cvPlaceholder")} />
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={prefill} disabled={!cv.trim()}>
          <Sparkles className="text-aqua-500" /> {t("prefillCta")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nameEn">{t("nameEn")}</Label>
          <Input id="nameEn" value={form.nameEn} dir="ltr" onChange={(e) => set("nameEn", e.target.value)} required={!form.nameAr} />
        </div>
        <div>
          <Label htmlFor="nameAr">{t("nameAr")}</Label>
          <Input id="nameAr" value={form.nameAr} dir="rtl" onChange={(e) => set("nameAr", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="type">{t("filterType")}</Label>
          <NativeSelect id="type" value={form.type} onChange={(e) => set("type", e.target.value)}>
            {EXTERNAL_TYPES.map((v) => (
              <option key={v} value={v}>
                {t(`types.${v}` as never)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="availability">{t("filterAvailability")}</Label>
          <NativeSelect id="availability" value={form.availability} onChange={(e) => set("availability", e.target.value)}>
            {AVAILABILITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(`availability.${v}` as never)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="organisationEn">{t("organisation")} (EN)</Label>
          <Input id="organisationEn" value={form.organisationEn} dir="ltr" onChange={(e) => set("organisationEn", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="organisationAr">{t("organisation")} (AR)</Label>
          <Input id="organisationAr" value={form.organisationAr} dir="rtl" onChange={(e) => set("organisationAr", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="positionEn">{t("position")} (EN)</Label>
          <Input id="positionEn" value={form.positionEn} dir="ltr" onChange={(e) => set("positionEn", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="positionAr">{t("position")} (AR)</Label>
          <Input id="positionAr" value={form.positionAr} dir="rtl" onChange={(e) => set("positionAr", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="country">{t("countryLabel")}</Label>
          <NativeSelect id="country" value={form.country} onChange={(e) => set("country", e.target.value)} data-testid="new-expert-country">
            {KNOWN_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {t(`countries.${c}` as never)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input id="email" value={form.email} dir="ltr" type="email" onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="years">{t("yearsLabel")}</Label>
          <Input
            id="years"
            value={form.yearsExperience}
            type="number"
            dir="ltr"
            onChange={(e) => set("yearsExperience", e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="bioEn">{t("bio")} (EN)</Label>
        <Textarea id="bioEn" value={form.bioEn} dir="ltr" rows={3} onChange={(e) => set("bioEn", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="bioAr">{t("bio")} (AR)</Label>
        <Textarea id="bioAr" value={form.bioAr} dir="rtl" rows={3} onChange={(e) => set("bioAr", e.target.value)} />
      </div>
      <div>
        {/* a caption over a set of toggle buttons, not a single control */}
        <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("domains")}</span>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label={t("domains")}>
          {topics.map((topic) => {
            const active = form.domainCodes.includes(topic.code);
            return (
              <button
                key={topic.code}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  set(
                    "domainCodes",
                    active
                      ? form.domainCodes.filter((c) => c !== topic.code)
                      : [...form.domainCodes, topic.code]
                  )
                }
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500",
                  active
                    ? "border-navy-700 bg-navy-100 font-medium text-navy-900"
                    : "border-mist-300 bg-white text-ink-600 hover:border-navy-300"
                )}
              >
                {bi(locale, topic.nameEn, topic.nameAr)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={busy} data-testid="new-expert-submit">
          {t("addCta")}
        </Button>
      </div>
    </form>
  );
}
