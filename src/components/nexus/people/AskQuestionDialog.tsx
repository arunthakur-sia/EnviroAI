"use client";
// CR08 9.1 "Ask a question": the existing route-question flow (POST
// /api/v1/routes creates the Ask NPC question and routes it to the person's
// expert profile with a notification). People without an expert profile fall
// back to /ask/c/new?q= from the card itself.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Button, Label, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { bi } from "@/lib/utils";
import type { ItemRef } from "./types";

export function AskQuestionDialog({
  open,
  onOpenChange,
  person,
  expertId,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: { nameEn: string; nameAr: string };
  expertId: string;
  item?: ItemRef | null;
}) {
  const t = useTranslations("people.ask");
  const tc = useTranslations("people.compose");
  const locale = useLocale();
  const { toast } = useToast();
  const name = bi(locale, person.nameEn, person.nameAr);
  const prefill = item
    ? t("prefill", { title: bi(locale, item.titleEn, item.titleAr) })
    : t("prefillPlain", { name });
  const [text, setText] = React.useState(prefill);
  const [busy, setBusy] = React.useState(false);
  const [questionId, setQuestionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setText(prefill);
      setQuestionId(null);
    }
    // the prefill is derived from props; reset only on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function send() {
    if (text.trim().length < 4) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expertId,
          queryText: text.trim(),
          reason: item ? `About ${item.titleEn}` : "Asked from the person card",
        }),
      });
      const json = await res.json().catch(() => ({ data: null }));
      if (res.ok && json.data?.questionId) {
        setQuestionId(json.data.questionId);
        toast(t("sent"), "success");
      } else toast(t("failed"), "error");
    } catch {
      toast(t("failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("title", { name })} className="w-[min(520px,92vw)]" data-testid="ask-dialog">
        <p className="mb-4 text-sm text-ink-600">{t("hint", { name })}</p>
        {questionId ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink-900">{t("sent")}</p>
            <Link
              href={`/ask/${questionId}` as never}
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9.5 items-center rounded-lg border border-sand-300 bg-white px-4 text-sm font-medium text-ink-900 transition-colors hover:border-maroon-300 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500"
              data-testid="ask-open"
            >
              {t("open")}
            </Link>
          </div>
        ) : (
          <>
            <Label htmlFor="ask-question-text">{t("placeholder")}</Label>
            <Textarea
              id="ask-question-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              dir="auto"
              autoFocus
              data-testid="ask-text"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={send} loading={busy} disabled={text.trim().length < 4} data-testid="ask-send">
                {t("send")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
