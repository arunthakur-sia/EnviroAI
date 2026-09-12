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
      const draft = sessionStorage.getItem("nexus-lesson-draft");
      if (draft) {
        setRough(draft);
        sessionStorage.removeItem("nexus-lesson-draft");
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
        <Label>{t("roughLabel")}</Label>
        <Textarea
          value={rough}
          onChange={(e) => setRough(e.target.value)}
          rows={5}
          placeholder={t("roughPlaceholder")}
        />
        <Button className="mt-3" variant="secondary" loading={structuring} onClick={structure} disabled={rough.trim().length < 10}>
          <Sparkles className="text-gold-500" /> {t("structureCta")}
        </Button>
      </div>

      {form ? (
        <div className="card flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("titleField")} (EN)</Label>
              <Input value={form.title_en} dir="ltr" onChange={(e) => setField("title_en", e.target.value)} />
            </div>
            <div>
              <Label>{t("titleField")} (AR)</Label>
              <Input value={form.title_ar} dir="rtl" onChange={(e) => setField("title_ar", e.target.value)} />
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
                <Label>{label} (EN)</Label>
                <Textarea
                  value={form[`${key}_en` as keyof Structured] as string}
                  dir="ltr"
                  rows={3}
                  onChange={(e) => setField(`${key}_en` as keyof Structured, e.target.value)}
                />
              </div>
              <div>
                <Label>{label} (AR)</Label>
                <Textarea
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
              <Label>{t("filterOutcome")}</Label>
              <NativeSelect value={outcomeCode} onChange={(e) => setOutcomeCode(e.target.value)}>
                <option value="">{tc("none")}</option>
                {outcomes.map((o) => (
                  <option key={o.code} value={o.code}>
                    {bi(locale, o.nameEn, o.nameAr)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>{t("classificationField")}</Label>
              <NativeSelect
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
            <Label>{t("topicsField")}</Label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
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
                        ? "border-maroon-700 bg-maroon-100 font-medium text-maroon-900"
                        : "border-sand-300 bg-white text-ink-600 hover:border-maroon-300"
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
