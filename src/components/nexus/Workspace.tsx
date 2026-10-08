"use client";
// CR01 4.5: the analyst answer workspace. Stacked sections built from existing
// components; sections render only when they have content. The same component
// serves /ask/c/[id] and the reading panels.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  Sparkles,
  Compass,
  BarChart3,
  FileText,
  Lightbulb,
  Radar as RadarIcon,
  Users,
  Send,
} from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Chip, RagDot, Avatar, Button } from "@/components/ui/primitives";
import {
  AnswerMarkdown,
  ConfidenceMeter,
  SourceList,
  type Citation,
} from "./AnswerStream";
import { IndicatorTile } from "./IndicatorTile";
import { KnowledgeCard } from "./Shelf";
import { LessonCard } from "./LessonCard";
import { SignalCard } from "./SignalCard";

/* ---------------- types mirrored from the server ---------------- */

export type AnalystWorkspaceData = {
  strategy: {
    id: string;
    code: string | null;
    nodeType: string;
    titleEn: string;
    titleAr: string;
    status: string;
    editionCode: string;
    ownerName: string | null;
    kpi: {
      nameEn: string;
      nameAr: string;
      unit: string | null;
      latest: number | null;
      latestPeriod: string | null;
      target: number | null;
      targetYear: number | null;
    } | null;
  }[];
  numbers: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    unit: string | null;
    decimals: number;
    direction: string;
    latest: { period: string; value: number } | null;
    previous: { period: string; value: number } | null;
    target: { value: number; year: number | null } | null;
    gapToTarget: number | null;
    series: { period: string; value: number }[];
  }[];
  documents: {
    id: string;
    titleEn: string;
    titleAr: string;
    summaryEn: string | null;
    summaryAr: string | null;
    page: number | null;
    status: string;
    classification: number;
    deliverable?: { code: string; nodeCode: string | null } | null;
  }[];
  lessons: {
    id: string;
    kind: "lesson" | "decision";
    titleEn: string;
    titleAr: string;
    learningEn: string | null;
    learningAr: string | null;
    recommendationEn: string | null;
    recommendationAr: string | null;
    status: string;
  }[];
  signals: {
    id: string;
    titleEn: string;
    titleAr: string;
    whyItMattersEn: string | null;
    whyItMattersAr: string | null;
    publisher: string | null;
    publishedAt: string | null;
    signalType: string;
    impact: string;
  }[];
  people: {
    id: string;
    nameEn: string;
    nameAr: string;
    positionEn: string | null;
    positionAr: string | null;
    organisationEn: string | null;
    availability: string;
    reasonEn: string;
    reasonAr: string;
  }[];
};

export type AnalystTurnData = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  workspace?: AnalystWorkspaceData | null;
  followUps?: string[];
  confidence?: "high" | "medium" | "low";
  includesSecret?: boolean;
  hiddenSources?: number;
};

export const EMPTY_WORKSPACE: AnalystWorkspaceData = {
  strategy: [],
  numbers: [],
  documents: [],
  lessons: [],
  signals: [],
  people: [],
};

/* ---------------- streaming hook ---------------- */

export type AnalystStreamState = {
  streaming: boolean;
  chips: { labelEn: string; labelAr: string }[];
  text: string;
  citations: Citation[];
  workspace: AnalystWorkspaceData;
  final: AnalystTurnData | null;
  conversationId: string | null;
  error: boolean;
};

export function useAnalyst() {
  const [state, setState] = React.useState<AnalystStreamState>({
    streaming: false,
    chips: [],
    text: "",
    citations: [],
    workspace: EMPTY_WORKSPACE,
    final: null,
    conversationId: null,
    error: false,
  });

  const send = React.useCallback(
    async (params: {
      message: string;
      locale: string;
      conversationId?: string | null;
      context?: { type: string; id: string } | null;
      /* CR08 2.3: the item the reader is looking at, from the Ask EnviroAI panel */
      contextItem?: { kind: string; id: string; code?: string | null; title: string } | null;
      onFinal?: (turn: AnalystTurnData, conversationId: string) => void;
      onConversation?: (id: string) => void;
    }) => {
      setState((s) => ({
        ...s,
        streaming: true,
        chips: [],
        text: "",
        citations: [],
        workspace: EMPTY_WORKSPACE,
        final: null,
        error: false,
      }));
      let convId = params.conversationId ?? null;
      try {
        const res = await fetch("/api/v1/ai/analyst", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: params.message,
            locale: params.locale,
            conversationId: params.conversationId ?? undefined,
            context: params.context ?? undefined,
            contextItem: params.contextItem ?? undefined,
          }),
        });
        if (!res.ok || !res.body) throw new Error("analyst_failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const raw of events) {
            const eventMatch = /^event: (\w+)$/m.exec(raw);
            const dataMatch = /^data: (.*)$/m.exec(raw);
            if (!eventMatch || !dataMatch) continue;
            const kind = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);
            if (kind === "meta" && data.conversationId) {
              convId = data.conversationId;
              setState((s) => ({ ...s, conversationId: data.conversationId }));
              params.onConversation?.(data.conversationId);
            }
            if (kind === "chip") {
              setState((s) => ({ ...s, chips: [...s.chips, data] }));
            }
            if (kind === "workspace") {
              setState((s) => ({ ...s, workspace: data.workspace ?? EMPTY_WORKSPACE }));
            }
            if (kind === "sources") {
              setState((s) => ({ ...s, citations: data.citations ?? [] }));
            }
            if (kind === "delta") {
              setState((s) => ({ ...s, text: s.text + data.text }));
            }
            if (kind === "final") {
              const turn: AnalystTurnData = {
                role: "assistant",
                content: data.markdown,
                citations: data.citations,
                workspace: data.workspace,
                followUps: data.followUps,
                confidence: data.confidence,
                includesSecret: data.includesSecret,
              };
              setState((s) => ({
                ...s,
                final: turn,
                text: data.markdown,
                citations: data.citations ?? [],
                workspace: data.workspace ?? EMPTY_WORKSPACE,
              }));
              if (convId) params.onFinal?.(turn, convId);
            }
            if (kind === "error") {
              setState((s) => ({ ...s, error: true }));
            }
          }
        }
      } catch {
        setState((s) => ({ ...s, error: true }));
      } finally {
        setState((s) => ({ ...s, streaming: false }));
      }
    },
    []
  );

  return { ...state, send };
}

/* ---------------- section renderers ---------------- */

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
      <Icon className="size-3.5" /> {children}
    </p>
  );
}

export function AnalystAnswer({
  turn,
  streaming,
  chips,
  onFollowUp,
  showFollowUps = true,
  compact = false,
}: {
  turn: AnalystTurnData;
  streaming?: boolean;
  chips?: { labelEn: string; labelAr: string }[];
  onFollowUp?: (text: string) => void;
  showFollowUps?: boolean;
  /* CR08 2.3: one column everywhere, for the 480px Ask EnviroAI panel */
  compact?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("analyst");
  const router = useRouter();
  const workspace = turn.workspace ?? EMPTY_WORKSPACE;
  const citations = turn.citations ?? [];
  const twoCols = compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";
  const threeCols = compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex flex-col gap-5">
      {/* thinking chips while gathering */}
      {streaming && chips?.length && !turn.content ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c, i) => (
            <span
              key={i}
              className={cn(
                "flex items-center gap-1.5 rounded-lg bg-mist-100 px-2.5 py-1 text-xs text-ink-600",
                i === chips.length - 1 && "animate-pulse text-navy-900"
              )}
            >
              <Sparkles className="size-3 text-aqua-500" />
              {locale === "ar" ? c.labelAr : c.labelEn}
            </span>
          ))}
        </div>
      ) : null}

      {/* 1. Answer */}
      {(turn.content || streaming) ? (
        <div>
          <AnswerMarkdown text={turn.content} citations={citations} streaming={streaming && !turn.followUps} />
          {turn.confidence ? (
            <div className="mt-3">
              <ConfidenceMeter level={turn.confidence} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 2. Strategy */}
      {workspace.strategy.length ? (
        <div>
          <SectionLabel icon={Compass}>{t("sectionStrategy")}</SectionLabel>
          <div className={cn("grid gap-3", twoCols)}>
            {workspace.strategy.map((s) => (
              <Link key={s.id} href={`/strategy/${s.id}` as never} className="card card-hover flex flex-col gap-1.5 p-3.5">
                <div className="flex items-center gap-2 text-[11px] text-ink-400">
                  <RagDot status={s.status} />
                  <span className="font-medium uppercase">{s.code ?? s.nodeType}</span>
                  {s.editionCode !== "nes3" ? (
                    <Chip tone="mist">{s.editionCode.toUpperCase()}</Chip>
                  ) : null}
                  {s.ownerName ? <span className="ms-auto truncate">{s.ownerName}</span> : null}
                </div>
                <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-900">
                  {bi(locale, s.titleEn, s.titleAr)}
                </p>
                {s.kpi ? (
                  <p className="mt-auto text-xs text-ink-600 tnum">
                    {bi(locale, s.kpi.nameEn, s.kpi.nameAr)}:{" "}
                    <span className="font-semibold text-ink-900">
                      {s.kpi.latest ?? "-"}
                      {s.kpi.unit ? ` ${s.kpi.unit}` : ""}
                    </span>
                    {s.kpi.target !== null ? (
                      <span className="text-aqua-500">
                        {" "}
                        / {s.kpi.target} ({s.kpi.targetYear ?? 2030})
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* 3. Numbers */}
      {workspace.numbers.length ? (
        <div>
          <SectionLabel icon={BarChart3}>{t("sectionNumbers")}</SectionLabel>
          <div className={cn("grid gap-3", threeCols)}>
            {workspace.numbers.map((n) => (
              <div key={n.id} className="flex flex-col gap-1">
                <IndicatorTile
                  tile={{
                    id: n.id,
                    nameEn: n.nameEn,
                    nameAr: n.nameAr,
                    unit: n.unit,
                    decimals: n.decimals,
                    direction: n.direction,
                    latestValue: n.latest?.value ?? null,
                    latestPeriod: n.latest?.period ?? null,
                    previousValue: n.previous?.value ?? null,
                    spark: n.series.map((s) => s.value),
                  }}
                />
                {n.target ? (
                  <p className="px-1 text-[11px] text-ink-400 tnum">
                    {t("gapToTarget", {
                      target: formatNumber(n.target.value, locale, { decimals: n.decimals }),
                      gap:
                        n.gapToTarget !== null
                          ? formatNumber(Math.abs(n.gapToTarget), locale, { decimals: n.decimals })
                          : "-",
                    })}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 4. Documents */}
      {workspace.documents.length ? (
        <div>
          <SectionLabel icon={FileText}>{t("sectionDocuments")}</SectionLabel>
          <div className={cn("grid gap-3", threeCols)}>
            {workspace.documents.slice(0, 6).map((d) => (
              <div key={d.id} className="relative">
                <KnowledgeCard
                  doc={{
                    id: d.id,
                    titleEn: d.titleEn,
                    titleAr: d.titleAr,
                    summaryEn: d.summaryEn,
                    summaryAr: d.summaryAr,
                    classification: d.classification,
                    status: d.status,
                  }}
                />
                {/* CR02 2.3: deliverables carry their chip and node code */}
                {d.deliverable ? (
                  <span className="absolute start-3 top-3 flex items-center gap-1">
                    <Chip tone="navy">{t("chipDeliverable")}</Chip>
                    {d.deliverable.nodeCode ? (
                      <Chip tone="mist">
                        <span className="tnum">
                          {d.deliverable.code} · {d.deliverable.nodeCode}
                        </span>
                      </Chip>
                    ) : null}
                  </span>
                ) : null}
                {d.page ? (
                  <span className="absolute bottom-3 end-3 text-[11px] text-ink-400 tnum">
                    p. {d.page}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 5. Lessons and decisions */}
      {workspace.lessons.length ? (
        <div>
          <SectionLabel icon={Lightbulb}>{t("sectionLessons")}</SectionLabel>
          <div className={cn("grid gap-3", threeCols)}>
            {workspace.lessons.slice(0, 6).map((l) => (
              <LessonCard
                key={l.id}
                lesson={{
                  id: l.id,
                  titleEn: l.titleEn,
                  titleAr: l.titleAr,
                  learningEn: l.learningEn,
                  learningAr: l.learningAr,
                  recommendationEn: l.recommendationEn,
                  recommendationAr: l.recommendationAr,
                  status: l.status,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* 6. Signals */}
      {workspace.signals.length ? (
        <div>
          <SectionLabel icon={RadarIcon}>{t("sectionSignals")}</SectionLabel>
          <div className={cn("grid gap-3", twoCols)}>
            {workspace.signals.slice(0, 4).map((s) => (
              <SignalCard
                key={s.id}
                compact
                canTriage={false}
                signal={{
                  id: s.id,
                  titleEn: s.titleEn,
                  titleAr: s.titleAr,
                  descriptionEn: null,
                  descriptionAr: null,
                  whyItMattersEn: s.whyItMattersEn,
                  whyItMattersAr: s.whyItMattersAr,
                  publisher: s.publisher,
                  url: null,
                  publishedAt: s.publishedAt,
                  signalType: s.signalType,
                  sentiment: "neutral",
                  impact: s.impact,
                  horizon: "mid",
                  confidence: null,
                  triageStatus: "accepted",
                  sourceKind: "web_search",
                  convertedResourceType: null,
                  convertedResourceId: null,
                  links: [],
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* 7. People */}
      {workspace.people.length ? (
        <div>
          <SectionLabel icon={Users}>{t("sectionPeople")}</SectionLabel>
          <div className="card divide-y divide-mist-100">
            {workspace.people.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={p.nameEn} color="teal" size={34} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/experts/${p.id}` as never}
                    className="block truncate text-sm font-medium text-ink-900 hover:text-navy-900"
                  >
                    {bi(locale, p.nameEn, p.nameAr)}
                  </Link>
                  <p className="truncate text-xs text-ink-600">
                    {bi(locale, p.reasonEn, p.reasonAr)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const res = await fetch("/api/v1/routes", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ expertId: p.id, queryText: turnQuestion(turn) }),
                    });
                    const json = await res.json();
                    if (res.ok) router.push(`/ask/${json.data.questionId}` as never);
                  }}
                >
                  <Send /> {t("askThem")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 8. Follow-ups */}
      {showFollowUps && turn.followUps?.length ? (
        <div className="flex flex-wrap gap-1.5" data-testid="followups">
          {turn.followUps.map((f, i) => (
            <button
              key={i}
              onClick={() => onFollowUp?.(f)}
              className="rounded-lg border border-navy-100 bg-navy-50 px-3 py-1.5 text-sm text-navy-900 transition-colors hover:bg-navy-700 hover:text-white cursor-pointer"
            >
              {f}
            </button>
          ))}
        </div>
      ) : null}

      {/* 9. Sources footer */}
      {citations.length ? (
        <div className="border-t border-mist-100 pt-1">
          {turn.hiddenSources ? (
            <p className="mt-2 text-xs text-ink-400">
              {t("hiddenSources", { count: turn.hiddenSources })}
            </p>
          ) : null}
          <SourceList citations={citations} />
        </div>
      ) : null}
    </div>
  );
}

function turnQuestion(turn: AnalystTurnData): string {
  return turn.content.slice(0, 300);
}
