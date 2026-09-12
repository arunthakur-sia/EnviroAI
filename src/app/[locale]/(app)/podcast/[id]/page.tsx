// CR02 4.6: episode page. Player, the script with the current segment
// highlighted while audio plays, sources with links, Ask about this,
// Extract report.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getEpisode } from "@/server/services/podcast";
import { Reveal } from "@/components/motion";
import { EmptyState } from "@/components/ui/primitives";
import { EpisodeClient } from "./EpisodeClient";

export const dynamic = "force-dynamic";

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("podcast");
  const detail = await getEpisode(user, id);
  if (!detail) return <EmptyState title={t("notFound")} className="mt-12" />;

  return (
    <Reveal>
      <EpisodeClient
        episode={{
          id: detail.episode.id,
          titleEn: detail.episode.titleEn,
          titleAr: detail.episode.titleAr,
          descriptionEn: detail.episode.descriptionEn,
          descriptionAr: detail.episode.descriptionAr,
          language: detail.episode.language,
          focus: detail.episode.focus,
          durationSec: detail.episode.durationSec,
          audioProvider: detail.episode.audioProvider,
          audioPath: detail.episode.audioPath,
          listens: detail.episode.listens,
          createdAt: detail.episode.createdAt,
          createdBy: detail.episode.createdBy,
        }}
        script={detail.script}
        scope={detail.scope}
        isOwner={detail.episode.createdBy === user.id}
      />
    </Reveal>
  );
}
