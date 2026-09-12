"use client";
// Lightweight comments on a signal (stored as `reviews` rows with decision "comment").
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Send } from "lucide-react";
import { bi } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { Avatar, Button, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Comment = {
  id: string;
  note: string | null;
  createdAt: string;
  nameEn: string;
  nameAr: string;
  color: string;
};

export function SignalComments({
  signalId,
  comments,
}: {
  signalId: string;
  comments: Comment[];
}) {
  const t = useTranslations("trends");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function post() {
    if (text.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/signals/${signalId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      setText("");
      router.refresh();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
        {t("comments")}
      </p>
      <div className="flex flex-col gap-3">
        {comments.length === 0 ? (
          <p className="text-sm text-ink-400">{t("noComments")}</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.nameEn} color={c.color} size={28} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-ink-900">{bi(locale, c.nameEn, c.nameAr)}</span>
                  <span className="text-ink-400">{relativeTime(c.createdAt, locale)}</span>
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-900">{c.note}</p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-4 flex items-end gap-2">
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("commentPlaceholder")}
          className="min-h-16 flex-1"
          aria-label={t("commentPlaceholder")}
        />
        <Button size="sm" onClick={post} loading={busy} disabled={text.trim().length < 2}>
          <Send /> {t("postComment")}
        </Button>
      </div>
    </div>
  );
}
