"use client";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Bot, UserRound } from "lucide-react";
import { AnswerMarkdown, ConfidenceMeter, type Citation } from "@/components/nexus/AnswerStream";

export function HistoryViewer({
  conversations,
  selectedId,
  messages,
}: {
  conversations: { id: string; title: string; updatedAt: string }[];
  selectedId: string | null;
  messages: {
    id: string;
    role: string;
    content: string;
    citationsJson: string | null;
    confidence: string | null;
  }[];
}) {
  const t = useTranslations("askPage");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="card max-h-[70vh] divide-y divide-sand-100 overflow-y-auto">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => router.push(`${pathname}?c=${c.id}` as never, { scroll: false })}
            className={cn(
              "block w-full px-4 py-3 text-start hover:bg-maroon-50 cursor-pointer",
              c.id === selectedId && "bg-maroon-100/60"
            )}
          >
            <p className="truncate text-sm font-medium text-ink-900">{c.title}</p>
            <p className="text-xs text-ink-400">{c.updatedAt}</p>
          </button>
        ))}
      </aside>
      <div className="space-y-4">
        {messages.map((m) => {
          let citations: Citation[] = [];
          try {
            citations = JSON.parse(m.citationsJson ?? "[]");
          } catch { /* skip */ }
          return (
            <div key={m.id} className={cn("card p-4", m.role === "user" && "bg-sand-50")}>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                {m.role === "user" ? <UserRound className="size-3.5" /> : <Bot className="size-3.5 text-gold-500" />}
                {m.role === "user" ? t("you") : t("aiAnswer")}
              </p>
              <AnswerMarkdown text={m.content} citations={citations} className="text-sm" />
              {m.confidence ? (
                <div className="mt-2">
                  <ConfidenceMeter level={m.confidence as "high" | "medium" | "low"} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
