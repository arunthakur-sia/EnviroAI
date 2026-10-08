"use client";
// CR02 4.6: one episode card in the library grid. Play starts the docked
// mini-player without leaving the page.
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Headphones, Play } from "lucide-react";
import { bi } from "@/lib/utils";
import { Chip } from "@/components/ui/primitives";
import type { EpisodeCard } from "@/server/services/podcast";

export function EpisodeCardClient({ episode }: { episode: EpisodeCard }) {
  const t = useTranslations("podcast");
  const locale = useLocale();
  const minutes = Math.max(1, Math.round(episode.durationSec / 60));

  return (
    <div className="card card-hover flex h-full flex-col gap-2.5 p-4" data-testid="episode-card">
      <div className="flex items-start gap-3">
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("sia:podcast:play", { detail: { id: episode.id } })
            )
          }
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy-700 text-white transition-colors hover:bg-navy-900 cursor-pointer"
          aria-label={t("play")}
        >
          <Play className="size-4 fill-current" />
        </button>
        <Link href={`/podcast/${episode.id}` as never} className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium leading-snug text-ink-900 hover:text-navy-700">
            {bi(locale, episode.titleEn, episode.titleAr)}
          </p>
        </Link>
      </div>
      {(episode.descriptionEn || episode.descriptionAr) ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-ink-600">
          {bi(locale, episode.descriptionEn ?? "", episode.descriptionAr ?? "")}
        </p>
      ) : null}
      {episode.sourceLabelEn ? (
        <p className="line-clamp-1 text-xs text-ink-600">
          {t("from", { source: bi(locale, episode.sourceLabelEn, episode.sourceLabelAr ?? "") })}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <Chip tone="mist">
          <span className="tnum">{t("minutes", { minutes })}</span>
        </Chip>
        <Chip tone="mist">{t(`langNames.${episode.language}` as never)}</Chip>
        <Chip tone={episode.audioProvider === "browser" ? "mist" : "aqua"}>
          {episode.audioProvider === "browser" ? t("browserVoice") : t("studioVoice")}
        </Chip>
        <span className="ms-auto flex items-center gap-1 text-[11px] text-ink-600 tnum">
          <Headphones className="size-3" aria-hidden />
          {t("listens", { count: episode.listens })}
        </span>
      </div>
    </div>
  );
}
