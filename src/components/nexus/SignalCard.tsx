"use client";
// A scanned signal in the stream: publisher, bilingual card, NES links,
// impact/horizon marks, confidence, and the triage strip. Styled like
// KnowledgeCard/LessonCard so it is indistinguishable from the existing system.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  Radar,
  Check,
  X,
  ArrowUpRight,
  Compass,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip, Button } from "@/components/ui/primitives";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  Tip,
} from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

import type { SignalCardData } from "./signal-card-data";

/** CR08 Phase A: the only place an unknown error is narrowed. */
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}


export type { SignalCardData, SignalLinkChip } from "./signal-card-data";

const IMPACT_TONE: Record<string, "danger" | "warn" | "mist"> = {
  high: "danger",
  medium: "warn",
  low: "mist",
};

const TYPE_TONE: Record<string, "navy" | "teal" | "info" | "aqua" | "ok" | "mist" | "warn" | "danger"> = {
  policy: "navy",
  market: "teal",
  technology: "info",
  social: "aqua",
  environment: "ok",
  geopolitical: "danger",
  index: "warn",
  research: "mist",
};

export function SignalCard({
  signal,
  canTriage,
  compact = false,
}: {
  signal: SignalCardData;
  canTriage: boolean;
  compact?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("trends");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [localStatus, setLocalStatus] = React.useState(signal.triageStatus);

  async function triage(action: "accept" | "dismiss" | "convert", target?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/signals/${signal.id}/triage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (action === "accept") {
        setLocalStatus("accepted");
        toast(
          json.data.points ? t("acceptedPoints", { points: json.data.points }) : t("accepted"),
          "points"
        );
      } else if (action === "dismiss") {
        setLocalStatus("dismissed");
        toast(t("dismissed"), "info");
      } else {
        setLocalStatus("converted");
        toast(t("converted"), "success");
        const rid = json.data.resourceId;
        if (target === "lesson") router.push(`/lessons/${rid}` as never);
        if (target === "document") router.push(`/vault/${rid}` as never);
      }
      router.refresh();
    } catch (e: unknown) {
      toast(errMessage(e) === "no_url" ? t("noUrlToConvert") : tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  const title = bi(locale, signal.titleEn, signal.titleAr);
  const summary = bi(locale, signal.descriptionEn ?? "", signal.descriptionAr ?? "");
  const why = bi(locale, signal.whyItMattersEn ?? "", signal.whyItMattersAr ?? "");

  return (
    <div className="card card-hover flex h-full flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-[11px] text-ink-400">
        <Radar className="size-3.5 shrink-0 text-teal-600" aria-hidden />
        <span className="truncate font-medium text-ink-600">
          {signal.publisher ?? t(`sourceKinds.${signal.sourceKind}` as never)}
        </span>
        {signal.publishedAt ? (
          <span className="tnum shrink-0">{formatDate(signal.publishedAt, locale)}</span>
        ) : null}
        <span className="ms-auto flex shrink-0 items-center gap-1.5">
          <Chip tone={TYPE_TONE[signal.signalType] ?? "mist"}>
            {t(`types.${signal.signalType}` as never)}
          </Chip>
          {localStatus !== "new" ? (
            <Chip tone={localStatus === "accepted" ? "ok" : localStatus === "converted" ? "teal" : "ghost"}>
              {t(`triage.${localStatus}` as never)}
            </Chip>
          ) : null}
        </span>
      </div>

      {signal.url ? (
        <Tip content={<span className="block max-w-72 break-all text-xs">{signal.url}</span>}>
          <Link
            href={`/trends/${signal.id}` as never}
            className="line-clamp-2 font-medium leading-snug text-ink-900 hover:text-navy-900"
          >
            {title}
          </Link>
        </Tip>
      ) : (
        <Link
          href={`/trends/${signal.id}` as never}
          className="line-clamp-2 font-medium leading-snug text-ink-900 hover:text-navy-900"
        >
          {title}
        </Link>
      )}

      {summary && !compact ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-ink-600">{summary}</p>
      ) : null}
      {why ? (
        <p className="line-clamp-2 rounded-lg bg-aqua-100/60 px-2.5 py-1.5 text-xs leading-relaxed text-navy-900">
          {why}
        </p>
      ) : null}

      {signal.links.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {signal.links
            .filter((l) => l.resourceType === "node" || l.resourceType === "indicator")
            .slice(0, 4)
            .map((l) => (
              <Link
                key={`${l.resourceType}:${l.resourceId}`}
                href={
                  (l.resourceType === "node"
                    ? `/strategy/${l.resourceId}`
                    : `/statistics/${l.resourceId}`) as never
                }
                className="inline-flex items-center gap-1 rounded-md bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-900 hover:bg-navy-700 hover:text-white"
              >
                {l.resourceType === "node" ? (
                  <Compass className="size-3" />
                ) : (
                  <BarChart3 className="size-3" />
                )}
                {l.code || bi(locale, l.titleEn, l.titleAr).slice(0, 24)}
              </Link>
            ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-ink-400">
        <Chip tone={IMPACT_TONE[signal.impact] ?? "mist"}>{t(`impact.${signal.impact}` as never)}</Chip>
        <Chip tone="mist">{t(`horizon.${signal.horizon}` as never)}</Chip>
        {signal.confidence !== null ? (
          <span className="tnum">
            {t("confidence")} {Math.round((signal.confidence ?? 0) * 100)}%
          </span>
        ) : null}
        {signal.url ? (
          <a
            href={signal.url}
            target="_blank"
            rel="noreferrer"
            className="ms-auto inline-flex items-center gap-1 text-teal-600 hover:underline"
          >
            <ExternalLink className="size-3" /> {t("source")}
          </a>
        ) : null}
      </div>

      {canTriage && localStatus === "new" ? (
        <div className="flex items-center gap-1.5 border-t border-mist-100 pt-2.5">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => triage("accept")}>
            <Check className="text-ok" /> {t("accept")}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => triage("dismiss")}>
            <X /> {t("dismiss")}
          </Button>
          <Dropdown>
            <DropdownTrigger asChild>
              <Button size="sm" variant="ghost" disabled={busy}>
                <ArrowUpRight /> {t("convert")}
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onSelect={() => triage("convert", "lesson")}>
                {t("convertLesson")}
              </DropdownItem>
              <DropdownItem onSelect={() => triage("convert", "risk")}>
                {t("convertRisk")}
              </DropdownItem>
              <DropdownItem onSelect={() => triage("convert", "document")}>
                {t("convertDocument")}
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      ) : null}
    </div>
  );
}
