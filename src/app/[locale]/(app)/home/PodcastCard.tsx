"use client";
// CR03 4.4.5: the NPC Nexus Podcast card. Soft maroon corner wash, the
// waveform glyph (dancing while an episode plays), the latest episode, the
// hosts line, a large circular play button with a slow breathing halo while
// an unplayed episode exists, and Make an episode as the quiet second action.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Play } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { WaveformMark } from "./HomeToday";

export type HomeEpisode = {
  id: string;
  titleEn: string;
  titleAr: string;
  durationSec: number;
  language: string;
  audioProvider: string;
  source: { en: string; ar: string } | null;
  listened: boolean;
} | null;

export function PodcastCard({ episode }: { episode: HomeEpisode }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    function onState(e: Event) {
      const detail = (e as CustomEvent).detail as { playing?: boolean; id?: string };
      setPlaying(Boolean(detail?.playing));
    }
    window.addEventListener("sia:podcast:state", onState);
    return () => window.removeEventListener("sia:podcast:state", onState);
  }, []);

  const minutes = episode ? Math.max(1, Math.round(episode.durationSec / 60)) : 0;

  return (
    <div className="bento-card relative flex h-full flex-col overflow-hidden p-5" data-testid="podcast-card">
      {/* the corner wash */}
      <span
        aria-hidden
        className="pointer-events-none absolute -end-10 -top-10 size-40 rounded-full"
        style={{ background: "radial-gradient(circle, var(--color-maroon-100), transparent 70%)" }}
      />
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600" style={{ fontFamily: "inherit" }}>
        {t("podcastEyebrow")}
      </p>
      <WaveformMark className={cn("h-6 w-12", playing && "wave-playing")} />
      {episode ? (
        <>
          <p className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug text-ink-900">
            {bi(locale, episode.titleEn, episode.titleAr)}
          </p>
          <p className="mt-1 text-xs text-ink-600">
            {t("podcastHosts")}
            <span className="ms-2 tnum">· {t("podcastMinutes", { minutes })}</span>
          </p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("sia:podcast:play", { detail: { id: episode.id } })
                )
              }
              aria-label={t("podcastPlay")}
              className={cn(
                "card-action flex size-12 items-center justify-center rounded-full bg-maroon-700 text-white transition-colors hover:bg-maroon-900 cursor-pointer",
                !episode.listened && !playing && "podcast-halo"
              )}
              data-testid="podcast-play"
            >
              <Play className="size-5 fill-current ps-0.5" />
            </button>
            <Link
              href={"/podcast/new" as never}
              className="link-draw text-sm font-medium text-maroon-700"
            >
              {t("podcastMake")}
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-600">{t("podcastEmpty")}</p>
          <div className="mt-auto pt-4">
            <Link
              href={"/podcast/new" as never}
              className="inline-flex items-center gap-1.5 rounded-lg bg-maroon-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-maroon-900"
            >
              {t("podcastMake")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
