/* eslint-disable no-console */
// CR02 4.6: seed 6 podcast episodes across outcomes with scripts built by
// the deterministic mock writer over real gathered content (DECISIONS 5).
// audio_provider starts as browser; when an ElevenLabs key exists at seed
// time the first two episodes are rendered with studio voices, per the CR.
// Idempotent via the cr02_podcast_seeded setting.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { eq, like, and } from "drizzle-orm";
import { ulid } from "ulid";

export async function seedPodcastCr02(): Promise<number> {
  const { db, schema } = await import("../src/server/db/client");
  const { getUserById } = await import("../src/server/auth/session");
  const { gatherScopeContent, estimateSeconds } = await import("../src/server/ai/podcast/script");
  const { mockPodcastScript } = await import("../src/server/ai/mock");
  const { renderEpisodeAudio, studioAvailable } = await import("../src/server/ai/podcast/audio");

  const [marker] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "cr02_podcast_seeded"))
    .limit(1);
  if (marker) {
    console.log("cr02 podcast episodes already seeded, skipping");
    return 0;
  }

  const [adminRow] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, "admin@npc.qa"))
    .limit(1);
  const admin = adminRow ? await getUserById(adminRow.id) : null;
  if (!admin) {
    console.log("no admin user; skipping podcast seed");
    return 0;
  }

  const nodeByPrefix = async (prefix: string, type: string) => {
    const [n] = await db
      .select()
      .from(schema.strategyNodes)
      .where(
        and(like(schema.strategyNodes.code, `${prefix}%`), eq(schema.strategyNodes.nodeType, type))
      )
      .limit(1);
    return n ?? null;
  };

  const prj1 = await nodeByPrefix("PRJ-01", "project");
  const prj8 = await nodeByPrefix("PRJ-08", "project");
  const ini = await nodeByPrefix("INI-1", "initiative");

  type Plan = {
    scope: {
      kind: "node" | "topic" | "lessons";
      ids: string[];
      labelEn: string;
      labelAr: string;
      query?: string;
      outcomeCode?: string;
    };
    language: "en" | "ar";
    focus: "overview" | "lessons" | "numbers" | "risks";
  };
  const plans: Plan[] = [];
  if (prj1) {
    plans.push({
      scope: {
        kind: "node",
        ids: [prj1.id],
        labelEn: `${prj1.code} ${prj1.titleEn}`,
        labelAr: `${prj1.code} ${prj1.titleAr}`,
        outcomeCode: "eco_growth",
      },
      language: "en",
      focus: "overview",
    });
  }
  if (prj8) {
    plans.push({
      scope: {
        kind: "node",
        ids: [prj8.id],
        labelEn: `${prj8.code} ${prj8.titleEn}`,
        labelAr: `${prj8.code} ${prj8.titleAr}`,
        outcomeCode: "workforce",
      },
      language: "ar",
      focus: "lessons",
    });
  }
  plans.push({
    scope: {
      kind: "topic",
      ids: [],
      labelEn: "Fiscal sustainability",
      labelAr: "الاستدامة المالية",
      query: "fiscal sustainability non-hydrocarbon revenue",
      outcomeCode: "fiscal_sust",
    },
    language: "en",
    focus: "numbers",
  });
  plans.push({
    scope: {
      kind: "topic",
      ids: [],
      labelEn: "Quality of life",
      labelAr: "جودة الحياة",
      query: "quality of life health services",
      outcomeCode: "quality_life",
    },
    language: "ar",
    focus: "overview",
  });
  plans.push({
    scope: {
      kind: "lessons",
      ids: [],
      labelEn: "Data quality lessons",
      labelAr: "دروس جودة البيانات",
      query: "data quality",
      outcomeCode: "gov_excellence",
    },
    language: "en",
    focus: "lessons",
  });
  if (ini) {
    plans.push({
      scope: {
        kind: "node",
        ids: [ini.id],
        labelEn: `${ini.code} ${ini.titleEn}`,
        labelAr: `${ini.code} ${ini.titleAr}`,
        outcomeCode: "env_sust",
      },
      language: "en",
      focus: "risks",
    });
  }

  const now = new Date().toISOString();
  const ids: string[] = [];
  for (const plan of plans.slice(0, 6)) {
    const { material, state } = await gatherScopeContent(admin, plan.scope as never, plan.focus);
    const base = mockPodcastScript({
      labelEn: plan.scope.labelEn,
      labelAr: plan.scope.labelAr,
      material,
      language: plan.language,
      minutes: 5,
      focus: plan.focus,
    });
    const script = {
      ...base,
      estimated_seconds: estimateSeconds(base.segments, plan.language),
      sources: state.sources,
    };
    const classification = Math.max(2, ...state.sources.map((s) => s.classification ?? 2));
    const id = ulid();
    await db.insert(schema.podcastEpisodes).values({
      id,
      titleEn: script.title_en,
      titleAr: script.title_ar,
      descriptionEn: script.description_en,
      descriptionAr: script.description_ar,
      language: plan.language,
      focus: plan.focus,
      sourceScopeJson: JSON.stringify(plan.scope),
      scriptJson: JSON.stringify(script),
      audioPath: null,
      audioProvider: "browser",
      durationSec: script.estimated_seconds,
      status: "published",
      createdBy: admin.id,
      classificationLevel: classification,
      listens: 3 + (ids.length * 5) % 14,
      createdAt: now,
      updatedAt: now,
    });
    ids.push(id);
    console.log(`  episode: ${script.title_en} (${plan.language}, ${plan.focus}, ${script.segments.length} segments)`);
  }

  // index the episodes as a source type
  const { embedStructuredRecords } = await import("../src/server/search/records");
  for (const id of ids) await embedStructuredRecords("podcast_episode", id);

  // render the first two with studio voices when a key exists
  if (studioAvailable()) {
    for (const id of ids.slice(0, 2)) {
      console.log(`  rendering studio audio for ${id}...`);
      const res = await renderEpisodeAudio(id);
      console.log(`    -> ${res.provider}${res.error ? ` (${res.error})` : ""}, ${res.durationSec}s`);
    }
  } else {
    console.log("  no ElevenLabs key; all episodes stay browser voice");
  }

  await db.insert(schema.settings).values({
    key: "cr02_podcast_seeded",
    valueJson: JSON.stringify({ at: now, count: ids.length }),
  });
  console.log(`cr02 podcast episodes seeded: ${ids.length}`);
  return ids.length;
}

const isMain = process.argv[1] && /cr02-seed-podcast\.(ts|js|mjs)$/.test(process.argv[1]);
if (isMain) {
  seedPodcastCr02()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
