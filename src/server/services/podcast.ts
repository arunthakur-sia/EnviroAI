// CR02 4.6: podcast episodes and listens.
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso, todayIso } from "@/lib/ids";
import { record } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { getSetting } from "@/server/settings";
import type { PodcastScript, PodcastScope, PodcastOptions } from "@/server/ai/podcast/script";

export type EpisodeCard = {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  language: string;
  focus: string;
  durationSec: number;
  audioProvider: string;
  listens: number;
  status: string;
  classificationLevel: number;
  createdAt: string;
  createdByNameEn: string | null;
  createdByNameAr: string | null;
  sourceLabelEn: string | null;
  sourceLabelAr: string | null;
  outcomeCode: string | null;
};

function scopeOf(episode: { sourceScopeJson: string | null }): {
  labelEn?: string;
  labelAr?: string;
  outcomeCode?: string | null;
} {
  try {
    return JSON.parse(episode.sourceScopeJson ?? "{}");
  } catch {
    return {};
  }
}

export async function listEpisodes(
  user: CurrentUser,
  filters: { language?: string; focus?: string; outcome?: string } = {}
): Promise<EpisodeCard[]> {
  const conds = [
    eq(schema.podcastEpisodes.status, "published"),
    sql`${schema.podcastEpisodes.classificationLevel} <= ${user.clearanceLevel}`,
  ];
  if (filters.language) conds.push(eq(schema.podcastEpisodes.language, filters.language));
  if (filters.focus) conds.push(eq(schema.podcastEpisodes.focus, filters.focus));
  const rows = await db
    .select({
      episode: schema.podcastEpisodes,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
    })
    .from(schema.podcastEpisodes)
    .leftJoin(schema.users, eq(schema.users.id, schema.podcastEpisodes.createdBy))
    .where(and(...conds))
    .orderBy(desc(schema.podcastEpisodes.createdAt))
    .limit(60);
  let cards = rows.map(({ episode, nameEn, nameAr }) => {
    const scope = scopeOf(episode);
    return {
      id: episode.id,
      titleEn: episode.titleEn,
      titleAr: episode.titleAr,
      descriptionEn: episode.descriptionEn,
      descriptionAr: episode.descriptionAr,
      language: episode.language,
      focus: episode.focus,
      durationSec: episode.durationSec,
      audioProvider: episode.audioProvider,
      listens: episode.listens,
      status: episode.status,
      classificationLevel: episode.classificationLevel,
      createdAt: episode.createdAt,
      createdByNameEn: nameEn,
      createdByNameAr: nameAr,
      sourceLabelEn: scope.labelEn ?? null,
      sourceLabelAr: scope.labelAr ?? null,
      outcomeCode: scope.outcomeCode ?? null,
    };
  });
  if (filters.outcome) cards = cards.filter((c) => c.outcomeCode === filters.outcome);
  return cards;
}

export async function getEpisode(user: CurrentUser, id: string) {
  const [episode] = await db
    .select()
    .from(schema.podcastEpisodes)
    .where(eq(schema.podcastEpisodes.id, id))
    .limit(1);
  if (!episode) return null;
  if (episode.classificationLevel > user.clearanceLevel) return null;
  let script: PodcastScript | null = null;
  try {
    script = episode.scriptJson ? (JSON.parse(episode.scriptJson) as PodcastScript) : null;
  } catch {
    script = null;
  }
  const [listen] = await db
    .select()
    .from(schema.podcastListens)
    .where(
      and(eq(schema.podcastListens.episodeId, id), eq(schema.podcastListens.userId, user.id))
    )
    .limit(1);
  return { episode, script, scope: scopeOf(episode), listen: listen ?? null };
}

/** CR02 4.5 cost guard: at most N studio renders per user per day. */
export async function studioRendersLeft(user: CurrentUser): Promise<number> {
  const cap = await getSetting<number>("podcast_daily_studio_cap", 3);
  const start = todayIso() + "T00:00:00.000Z";
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.userId, user.id),
        eq(schema.auditLog.action, "render_podcast"),
        sql`${schema.auditLog.createdAt} >= ${start}`
      )
    );
  return Math.max(0, cap - (rows[0]?.c ?? 0));
}

export async function createEpisode(
  user: CurrentUser,
  input: {
    scope: PodcastScope & { outcomeCode?: string | null };
    options: PodcastOptions;
    script: PodcastScript;
  }
): Promise<{ ok: boolean; id?: string; error?: string; points?: number }> {
  if (!can(user, "create", "lessons") && !can(user, "create", "vault")) {
    return { ok: false, error: "forbidden" };
  }
  const id = newId();
  // classification = the maximum classification of the source content
  const classification = Math.max(
    2,
    ...input.script.sources.map((s) => s.classification ?? 2)
  );
  await db.insert(schema.podcastEpisodes).values({
    id,
    titleEn: input.script.title_en,
    titleAr: input.script.title_ar,
    descriptionEn: input.script.description_en || null,
    descriptionAr: input.script.description_ar || null,
    language: input.options.language,
    focus: input.options.focus,
    sourceScopeJson: JSON.stringify(input.scope),
    scriptJson: JSON.stringify(input.script),
    audioPath: null,
    audioProvider: "browser",
    durationSec: input.script.estimated_seconds,
    status: "published",
    createdBy: user.id,
    classificationLevel: classification,
    listens: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const game = await record({
    userId: user.id,
    type: "podcast_created",
    resourceType: "podcast_episode",
    resourceId: id,
    meta: { departmentId: user.departmentId },
  });
  // CR02 8: episodes are indexed as a source type (script text)
  const { enqueue } = await import("@/server/jobs/queue");
  await enqueue("embed_records", { resourceType: "podcast_episode", resourceId: id });
  await audit(user.id, "create", "podcast_episode", id, {
    scope: input.scope.kind,
    language: input.options.language,
  });
  return { ok: true, id, points: game.points };
}

export async function recordListen(
  user: CurrentUser,
  episodeId: string,
  secondsListened: number,
  completed: boolean
): Promise<{ points: number }> {
  const [existing] = await db
    .select()
    .from(schema.podcastListens)
    .where(
      and(
        eq(schema.podcastListens.episodeId, episodeId),
        eq(schema.podcastListens.userId, user.id)
      )
    )
    .limit(1);
  const wasCompleted = existing?.completed === 1;
  if (existing) {
    await db
      .update(schema.podcastListens)
      .set({
        secondsListened: Math.max(existing.secondsListened, Math.round(secondsListened)),
        completed: wasCompleted || completed ? 1 : 0,
        updatedAt: nowIso(),
      })
      .where(eq(schema.podcastListens.id, existing.id));
  } else {
    await db.insert(schema.podcastListens).values({
      id: newId(),
      episodeId,
      userId: user.id,
      secondsListened: Math.round(secondsListened),
      completed: completed ? 1 : 0,
      updatedAt: nowIso(),
    });
  }
  let points = 0;
  if (completed && !wasCompleted) {
    await db
      .update(schema.podcastEpisodes)
      .set({ listens: sql`${schema.podcastEpisodes.listens} + 1` })
      .where(eq(schema.podcastEpisodes.id, episodeId));
    const game = await record({
      userId: user.id,
      type: "podcast_listened_full",
      resourceType: "podcast_episode",
      resourceId: episodeId,
      meta: { departmentId: user.departmentId },
    });
    points = game.points;
  }
  return { points };
}
