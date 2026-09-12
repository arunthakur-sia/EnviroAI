"use client";
// "Brief me" on every detail page: a leadership one-pager in a dialog, exportable to .docx.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileDown, ScrollText } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/overlays";
import { Button, Skeleton } from "@/components/ui/primitives";

type Brief = {
  title_en: string;
  title_ar: string;
  sections: { heading_en: string; heading_ar: string; body_en: string; body_ar: string }[];
  key_numbers: { label_en: string; label_ar: string; value: string }[];
  recommended_actions: { text_en: string; text_ar: string }[];
};

export function BriefDialog({
  resourceType,
  resourceId,
  variant = "secondary",
}: {
  resourceType: string;
  resourceId: string;
  variant?: "secondary" | "ghost";
}) {
  const t = useTranslations("common");
  const tb = useTranslations("brief");
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [brief, setBrief] = React.useState<Brief | null>(null);
  const [loading, setLoading] = React.useState(false);
  const ar = locale === "ar";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, locale }),
      });
      const json = await res.json();
      if (res.ok) setBrief(json.data);
    } finally {
      setLoading(false);
    }
  }

  async function exportDocx() {
    const res = await fetch("/api/v1/ai/brief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceType, resourceId, locale, format: "docx" }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brief.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !brief) load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant}>
          <ScrollText /> {t("briefMe")}
        </Button>
      </DialogTrigger>
      <DialogContent title={tb("title")} className="max-h-[85vh] w-[min(680px,94vw)] overflow-y-auto">
        {loading ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : brief ? (
          <div>
            <h3 className="mb-4 text-xl">{ar ? brief.title_ar : brief.title_en}</h3>
            {brief.key_numbers.length ? (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {brief.key_numbers.map((n, i) => (
                  <div key={i} className="rounded-xl bg-sand-50 px-3 py-2.5">
                    <p className="text-[11px] text-ink-600">{ar ? n.label_ar : n.label_en}</p>
                    <p className="text-sm font-semibold text-maroon-900 tnum">{n.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {brief.sections.map((s, i) => (
              <section key={i} className="mb-4">
                <h4 className="mb-1 font-medium text-maroon-900">
                  {ar ? s.heading_ar : s.heading_en}
                </h4>
                <p className="text-sm leading-relaxed text-ink-900">{ar ? s.body_ar : s.body_en}</p>
              </section>
            ))}
            {brief.recommended_actions.length ? (
              <section className="rounded-xl border border-gold-300 bg-gold-100/50 p-4">
                <h4 className="mb-2 text-sm font-medium text-maroon-900">{tb("actions")}</h4>
                <ul className="space-y-1 text-sm text-ink-900">
                  {brief.recommended_actions.map((a, i) => (
                    <li key={i}>· {ar ? a.text_ar : a.text_en}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={exportDocx}>
                <FileDown /> {tb("export")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-600">{tb("failed")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
