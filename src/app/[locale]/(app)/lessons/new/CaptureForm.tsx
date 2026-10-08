"use client";
// The 60-second capture: rough text in, "Structure with AI", review, publish.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sparkles } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Textarea, Input, Label, NativeSelect } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Structured = {
  title_en: string;
  title_ar: string;
  context_en: string;
  context_ar: string;
  learning_en: string;
  learning_ar: string;
  recommendation_en: string;
  recommendation_ar: string;
  suggested_outcome_codes: string[];
  suggested_topic_codes: string[];
};

export function CaptureForm({
  outcomes,
  topics,
}: {
  outcomes: { code: string; nameEn: string; nameAr: string }[];
  topics: { code: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("lessons");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [rough, setRough] = React.useState("");
  const [structuring, setStructuring] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [form, setForm] = React.useState<Structured | null>(null);
  const [outcomeCode, setOutcomeCode] = React.useState("");
  const [topicCodes, setTopicCodes] = React.useState<string[]>([]);
  const [classification, setClassification] = React.useState(2);

  React.useEffect(() => {
    // reader panel handoff
    try {
      const draft = sessionStorage.getItem("enviroai-lesson-draft");
      if (draft) {
        setRough(draft);
        sessionStorage.removeItem("enviroai-lesson-draft");
      }
    } catch { /* skip */ }
  }, []);

  async function structure() {
    if (rough.trim().length < 10) return;
    setStructuring(true);
    try {
      const res = await fetch("/api/v1/ai/lesson-structure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rough }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setForm(json.data);
      if (json.data.suggested_outcome_codes?.[0]) setOutcomeCode(json.data.suggested_outcome_codes[0]);
      if (json.data.suggested_topic_codes?.length) setTopicCodes(json.data.suggested_topic_codes.slice(0, 3));
    } catch {
      toast(tc("error"), "error");
    } finally {
      setStructuring(false);
    }
  }

  async function publish() {
    if (!form) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/v1/lessons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          outcome_code: outcomeCode || null,
          topic_codes: topicCodes,
          classification_level: classification,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(t("publishedToast", { points: json.data.points ?? 25 }), "points");
      router.push(`/lessons/${json.data.id}` as never);
    } catch {
      toast(tc("error"), "error");
    } finally {
      setPublishing(false);
    }
  }

  const setField = (key: keyof Structured, value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="card p-5">
        <Label htmlFor="capture-rough">{t("roughLabel")}</Label>
        <Textarea
          id="capture-rough"
          value={rough}
          onChange={(e) => setRough(e.target.value)}
          rows={5}
          placeholder={t("roughPlaceholder")}
        />
        <Button className="mt-3" variant="secondary" loading={structuring} onClick={structure} disabled={rough.trim().length < 10}>
          <Sparkles className="text-aqua-500" /> {t("structureCta")}
        </Button>
      </div>

      {form ? (
        <div className="card flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="capture-title-en">{t("titleField")} (EN)</Label>
              <Input id="capture-title-en" value={form.title_en} dir="ltr" onChange={(e) => setField("title_en", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="capture-title-ar">{t("titleField")} (AR)</Label>
              <Input id="capture-title-ar" value={form.title_ar} dir="rtl" onChange={(e) => setField("title_ar", e.target.value)} />
            </div>
          </div>
          {(
            [
              ["context", t("contextField")],
              ["learning", t("learningField")],
              ["recommendation", t("recommendationField")],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`capture-${key}-en`}>{label} (EN)</Label>
                <Textarea
                  id={`capture-${key}-en`}
                  value={form[`${key}_en` as keyof Structured] as string}
                  dir="ltr"
                  rows={3}
                  onChange={(e) => setField(`${key}_en` as keyof Structured, e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`capture-${key}-ar`}>{label} (AR)</Label>
                <Textarea
                  id={`capture-${key}-ar`}
                  value={form[`${key}_ar` as keyof Structured] as string}
                  dir="rtl"
                  rows={3}
                  onChange={(e) => setField(`${key}_ar` as keyof Structured, e.target.value)}
                />
              </div>
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="capture-outcome">{t("filterOutcome")}</Label>
              <NativeSelect id="capture-outcome" value={outcomeCode} onChange={(e) => setOutcomeCode(e.target.value)}>
                <option value="">{tc("none")}</option>
                {outcomes.map((o) => (
                  <option key={o.code} value={o.code}>
                    {bi(locale, o.nameEn, o.nameAr)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="capture-classification">{t("classificationField")}</Label>
              <NativeSelect
                id="capture-classification"
                value={String(classification)}
                onChange={(e) => setClassification(Number(e.target.value))}
              >
                {[1, 2, 3].map((l) => (
                  <option key={l} value={l}>
                    {tc(`classification.${l}` as never)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div>
            {/* a caption over a set of toggle buttons, not one control */}
            <span id="capture-topics-label" className="mb-1.5 block text-xs font-medium text-ink-600">
              {t("topicsField")}
            </span>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-labelledby="capture-topics-label">
              {topics.map((topic) => {
                const active = topicCodes.includes(topic.code);
                return (
                  <button
                    key={topic.code}
                    type="button"
                    onClick={() =>
                      setTopicCodes(
                        active ? topicCodes.filter((c) => c !== topic.code) : [...topicCodes, topic.code]
                      )
                    }
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer",
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
            <Button size="lg" loading={publishing} onClick={publish}>
              {t("publishCta")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
