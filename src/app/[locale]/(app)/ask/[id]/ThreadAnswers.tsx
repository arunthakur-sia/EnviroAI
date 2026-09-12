"use client";
// Thread answers: verified pinned, AI answer collapsed when a human answered,
// answer composer, verify and helpful actions.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BadgeCheck, Bot, ThumbsUp, ChevronDown } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { Avatar, Button, Chip, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { AnswerMarkdown, type Citation } from "@/components/nexus/AnswerStream";

type AnswerData = {
  id: string;
  isAi: boolean;
  bodyEn: string | null;
  bodyAr: string | null;
  citationsJson: string | null;
  confidence: string | null;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string;
  authorNameEn: string | null;
  authorNameAr: string | null;
  authorColor: string;
};

export function ThreadAnswers({
  questionId,
  verifiedAnswerId,
  canVerify,
  canAnswer,
  answers,
}: {
  questionId: string;
  verifiedAnswerId: string | null;
  canVerify: boolean;
  canAnswer: boolean;
  answers: AnswerData[];
}) {
  const t = useTranslations("askPage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const humanAnswers = answers.filter((a) => !a.isAi);
  const sorted = [...answers].sort((a, b) => {
    if (a.id === verifiedAnswerId) return -1;
    if (b.id === verifiedAnswerId) return 1;
    if (a.isAi !== b.isAi) return a.isAi ? 1 : -1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  async function post() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        toast(t("answerPosted"), "points");
        setBody("");
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function verify(answerId: string) {
    const res = await fetch(`/api/v1/answers/${answerId}/verify`, { method: "POST" });
    if (res.ok) {
      toast(t("answerVerified"), "success");
      router.refresh();
    } else toast(tc("error"), "error");
  }

  async function helpful(answerId: string) {
    await fetch(`/api/v1/answers/${answerId}/helpful`, { method: "POST" });
    toast(t("thanksFeedback"), "info");
  }

  return (
    <div className="space-y-4">
      {sorted.map((a) => (
        <AnswerCard
          key={a.id}
          answer={a}
          pinned={a.id === verifiedAnswerId}
          collapsedByDefault={a.isAi && humanAnswers.length > 0}
          canVerify={canVerify && !a.isVerified}
          onVerify={() => verify(a.id)}
          onHelpful={() => helpful(a.id)}
        />
      ))}

      {canAnswer ? (
        <div className="card p-4">
          <p className="mb-2 text-sm font-medium text-ink-900">{t("yourAnswer")}</p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={t("answerPlaceholder")}
          />
          <div className="mt-3 flex justify-end">
            <Button loading={busy} onClick={post} disabled={!body.trim()}>
              {t("postAnswer")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AnswerCard({
  answer,
  pinned,
  collapsedByDefault,
  canVerify,
  onVerify,
  onHelpful,
}: {
  answer: AnswerData;
  pinned: boolean;
  collapsedByDefault: boolean;
  canVerify: boolean;
  onVerify: () => void;
  onHelpful: () => void;
}) {
  const t = useTranslations("askPage");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [collapsed, setCollapsed] = React.useState(collapsedByDefault);
  const body = bi(locale, answer.bodyEn ?? "", answer.bodyAr ?? "");
  let citations: Citation[] = [];
  try {
    citations = JSON.parse(answer.citationsJson ?? "[]");
  } catch { /* skip */ }

  return (
    <div
      className={cn(
        "card p-5",
        pinned && "border-ok/40 shadow-[0_0_0_1px_var(--color-ok-light)]"
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {answer.isAi ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink-600">
            <Bot className="size-4 text-gold-500" /> {t("aiAnswer")}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-sm font-medium text-ink-900">
            <Avatar name={answer.authorNameEn ?? "?"} color={answer.authorColor} size={24} />
            {bi(locale, answer.authorNameEn ?? "", answer.authorNameAr ?? "")}
          </span>
        )}
        {answer.isVerified ? (
          <Chip tone="ok">
            <BadgeCheck className="size-3" /> {tc("verified")}
          </Chip>
        ) : null}
        <span className="ms-auto text-xs text-ink-400">{relativeTime(answer.createdAt, locale)}</span>
        {collapsedByDefault ? (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 text-ink-400 hover:bg-sand-100 cursor-pointer"
            aria-label={collapsed ? tc("showMore") : tc("showLess")}
          >
            <ChevronDown className={cn("size-4 transition-transform", !collapsed && "rotate-180")} />
          </button>
        ) : null}
      </div>
      {!collapsed ? (
        <>
          <AnswerMarkdown text={body} citations={citations} className="text-sm" />
          <div className="mt-3 flex items-center gap-2 border-t border-sand-100 pt-2.5">
            <button
              onClick={onHelpful}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-600 hover:bg-ok-light hover:text-ok cursor-pointer"
            >
              <ThumbsUp className="size-3.5" /> {t("helpfulCount", { count: answer.helpfulCount })}
            </button>
            {canVerify ? (
              <Button variant="secondary" size="sm" className="ms-auto" onClick={onVerify}>
                <BadgeCheck /> {tc("verify")}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-xs text-ink-400">{t("aiCollapsed")}</p>
      )}
    </div>
  );
}
