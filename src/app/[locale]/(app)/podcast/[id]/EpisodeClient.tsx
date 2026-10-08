"use client";
// CR02 4.6: episode view. The mini-player drives playback; this page listens
// for its segment events and highlights the line being spoken.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FileOutput, Headphones, MessageCircleQuestion, Play, RefreshCw } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Avatar, Button, Chip } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { WaveformMark } from "../../home/HomeToday";
import { ReportButton } from "@/components/nexus/ReportButton";

type Segment = { speaker: "mariam" | "hamad"; text: string; source_mention?: string | null };
type Source = {
  n: number;
  resource_type: string;
  resource_id: string;
  title: string;
  page: number | null;
};

export function EpisodeClient({
  episode,
  script,
  scope,
  isOwner,
}: {
  episode: {
    id: string;
    titleEn: string;
    titleAr: string;
    descriptionEn: string | null;
    descriptionAr: string | null;
    language: string;
    focus: string;
    durationSec: number;
    audioProvider: string;
    audioPath: string | null;
    listens: number;
    createdAt: string;
    createdBy: string | null;
  };
  script: {
    segments: Segment[];
    sources?: Source[];
  } | null;
  scope: { labelEn?: string; labelAr?: string };
  isOwner: boolean;
}) {
  const t = useTranslations("podcast");
  const locale = useLocale();
  const { toast } = useToast();
  const [currentSegment, setCurrentSegment] = React.useState(-1);
  const [rendering, setRendering] = React.useState<{ done: number; total: number } | null>(null);

  React.useEffect(() => {
    function onSegment(e: Event) {
      setCurrentSegment((e as CustomEvent<{ index: number }>).detail?.index ?? -1);
    }
    window.addEventListener("sia:podcast:segment", onSegment);
    return () => window.removeEventListener("sia:podcast:segment", onSegment);
  }, []);

  /* poll render progress while a studio render runs */
  React.useEffect(() => {
    if (!rendering) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/podcast/${episode.id}`);
        const json = await res.json();
        if (json.data?.renderProgress) {
          setRendering(json.data.renderProgress);
        } else {
          setRendering(null);
          window.location.reload();
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [rendering, episode.id]);

  async function regenerate() {
    const res = await fetch(`/api/v1/podcast/${episode.id}/render`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      setRendering({ done: 0, total: script?.segments.length ?? 0 });
    } else if (json.error === "daily_cap_reached") {
      toast(t("capReached"), "error");
    }
  }

  const minutes = Math.max(1, Math.round(episode.durationSec / 60));
  const segments = script?.segments ?? [];
  const sources = script?.sources ?? [];

  const sourceHref = (s: Source) =>
    s.resource_type === "document"
      ? `/vault/${s.resource_id}`
      : s.resource_type === "node"
        ? `/strategy/${s.resource_id}`
        : s.resource_type === "lesson"
          ? `/lessons/${s.resource_id}`
          : s.resource_type === "indicator"
            ? `/statistics/${s.resource_id}`
            : s.resource_type === "signal"
              ? `/trends/${s.resource_id}`
              : "/vault";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-6">
        <WaveformMark className="h-6 w-12" />
        <h1 className="mt-3 text-2xl">{bi(locale, episode.titleEn, episode.titleAr)}</h1>
        {(episode.descriptionEn || episode.descriptionAr) ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            {bi(locale, episode.descriptionEn ?? "", episode.descriptionAr ?? "")}
          </p>
        ) : null}
        {scope.labelEn ? (
          <p className="mt-1.5 text-xs text-ink-600">
            {t("from", { source: bi(locale, scope.labelEn, scope.labelAr ?? "") })}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip tone="mist">
            <span className="tnum">{t("minutes", { minutes })}</span>
          </Chip>
          <Chip tone="mist">{t(`langNames.${episode.language}` as never)}</Chip>
          <Chip tone="mist">{t(`focus.${episode.focus}` as never)}</Chip>
          <Chip tone={episode.audioProvider === "browser" ? "mist" : "aqua"}>
            {episode.audioProvider === "browser" ? t("browserVoice") : t("studioVoice")}
          </Chip>
          <span className="ms-auto flex items-center gap-1 text-[11px] text-ink-600 tnum">
            <Headphones className="size-3" aria-hidden />
            {t("listens", { count: episode.listens })}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("sia:podcast:play", { detail: { id: episode.id } })
              )
            }
          >
            <Play /> {t("play")}
          </Button>
          <Link
            href={
              `/ask/c/new?q=${encodeURIComponent(
                locale === "ar"
                  ? `عن حلقة البودكاست: ${episode.titleAr || episode.titleEn}`
                  : `About the podcast episode: ${episode.titleEn}`
              )}` as never
            }
          >
            <Button variant="secondary">
              <MessageCircleQuestion /> {t("askAboutThis")}
            </Button>
          </Link>
          <ReportButton
            scope={{
              kind: "podcast",
              ids: [episode.id],
              labelEn: episode.titleEn,
              labelAr: episode.titleAr,
            }}
            trigger={
              <Button variant="secondary">
                <FileOutput /> {t("extractReport")}
              </Button>
            }
          />
          {isOwner && episode.audioProvider === "browser" ? (
            <Button variant="ghost" onClick={regenerate} disabled={Boolean(rendering)}>
              <RefreshCw className={cn(rendering && "animate-spin")} /> {t("regenerateStudio")}
            </Button>
          ) : null}
        </div>
        {episode.audioProvider === "browser" && !rendering ? (
          <p className="mt-2 text-xs text-ink-600">{t("noAudio")}</p>
        ) : null}
        {rendering ? (
          <p className="mt-2 text-xs font-medium text-navy-700 tnum" aria-live="polite">
            {t("rendering", { done: rendering.done, total: rendering.total })}
          </p>
        ) : null}
      </div>

      {/* Script with the current line highlighted */}
      {segments.length ? (
        <div className="mt-6">
          <h2 className="mb-3 text-lg">{t("script")}</h2>
          <div className="flex flex-col gap-2.5" data-testid="episode-script">
            {segments.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 rounded-xl px-4 py-3 transition-colors",
                  i === currentSegment
                    ? "bg-navy-100/70 ring-1 ring-navy-300"
                    : "bg-white"
                )}
                data-current={i === currentSegment || undefined}
              >
                <Avatar
                  name={s.speaker === "mariam" ? "Mariam Doctor" : "Hamad Host"}
                  color={s.speaker === "mariam" ? "navy" : "teal"}
                  size={30}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-ink-600">
                    {s.speaker === "mariam" ? t("mariam") : t("hamad")}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-900">{s.text}</p>
                  {s.source_mention ? (
                    <p className="mt-1 text-[11px] text-teal-600">{s.source_mention}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Sources */}
      {sources.length ? (
        <div className="mt-6">
          <h2 className="mb-3 text-lg">{t("sources")}</h2>
          <div className="card divide-y divide-mist-100">
            {sources.map((s) => (
              <Link
                key={`${s.resource_type}-${s.resource_id}-${s.n}`}
                href={sourceHref(s) as never}
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-navy-50"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-mist-100 text-[10px] font-semibold text-ink-600 tnum">
                  {s.n}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-900">{s.title}</span>
                {s.page ? <span className="text-[11px] text-ink-600 tnum">p. {s.page}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
