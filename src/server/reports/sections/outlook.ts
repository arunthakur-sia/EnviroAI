// CR08 5.3: the Outlook. Forward-looking, built only from what the system
// already knows about the future: the statistical releases scheduled ahead,
// the current forecast directions, the initiatives and projects whose end
// dates fall in the next period, and the next steps their latest status
// updates recorded. Assessments are labelled as such.
import { and, desc, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { releaseCalendar } from "@/server/services/statistics";
import { getIndicesBoard } from "@/server/services/indices";
import { bi, type Block, type SectionDefinition } from "../spec";
import {
  fmt,
  internationalCards,
  memo,
  periodBounds,
  periodLabel,
  proseBlocks,
  section,
  SRC,
  makeSources,
  statusText,
  writeProse,
  type Prose,
} from "./_shared";
import { navigator, resolveScope } from "./_scope";

type OutlookData = {
  releases: { titleEn: string; titleAr: string; date: string }[];
  forecastDirections: { up: number; down: number; stable: number } | null;
  endingSoon: { code: string | null; titleEn: string; titleAr: string; status: string; endDate: string }[];
  nextSteps: { nodeEn: string; nodeAr: string; en: string; ar: string }[];
  horizonEnd: string;
  editionCode: string | null;
};

function parseSteps(raw: string | null): { en: string; ar: string }[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => {
        if (typeof s === "string") return { en: s, ar: s };
        if (s && typeof s === "object") {
          const o = s as { en?: string; ar?: string; text_en?: string; text_ar?: string; text?: string };
          const en = o.en ?? o.text_en ?? o.text ?? "";
          const ar = o.ar ?? o.text_ar ?? en;
          return en ? { en, ar } : null;
        }
        return null;
      })
      .filter((s): s is { en: string; ar: string } => Boolean(s));
  } catch {
    return [];
  }
}

const def: SectionDefinition<OutlookData> = {
  code: "outlook",
  name: bi("Outlook", "الآفاق المقبلة"),
  description: bi(
    "What the next period holds: scheduled releases, forecast directions, initiatives closing soon and their recorded next steps.",
    "ما تحمله الفترة المقبلة: الإصدارات المجدولة، واتجاهات التنبؤ، والمبادرات المقبلة على الإقفال، وخطواتها التالية المسجلة."
  ),
  layout: "body",
  estimatedPages: 1,
  appliesTo: "all",
  async load(ctx) {
    const [scope, nav] = await Promise.all([resolveScope(ctx), navigator(ctx)]);
    const { to } = periodBounds(ctx.request.period);
    const horizonEnd = new Date(new Date(`${to}T00:00:00Z`).getTime() + 120 * 86400000)
      .toISOString()
      .slice(0, 10);
    const releases = (await releaseCalendar(120).catch(() => [])).slice(0, 6);
    const isOrg = scope.kind === "org" || scope.kind === "period";
    const board = isOrg
      ? await memo(ctx, "indices-board", () => getIndicesBoard(ctx.user).catch(() => null))
      : null;
    const tracked = board ? internationalCards(board.cards) : [];
    const forecastDirections = board
      ? {
          up: tracked.filter((c) => c.forecastDirection === "up").length,
          down: tracked.filter((c) => c.forecastDirection === "down").length,
          stable: tracked.filter((c) => c.forecastDirection === "stable").length,
        }
      : null;
    const items = (nav?.items ?? []).filter(
      (i) =>
        scope.scopeNodeIds.has(i.id) &&
        i.endDate &&
        i.endDate > to &&
        i.endDate <= horizonEnd &&
        i.status !== "completed"
    );
    const endingSoon = items
      .sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""))
      .slice(0, 8)
      .map((i) => ({ code: i.code, titleEn: i.titleEn, titleAr: i.titleAr, status: i.status, endDate: i.endDate! }));
    // the newest status update per in-scope node that carries next steps
    const nodeIds = [...scope.scopeNodeIds].filter((id) => scope.byId.get(id)?.nodeType !== "outcome");
    const updates = nodeIds.length
      ? await db
          .select()
          .from(schema.statusUpdates)
          .where(and(inArray(schema.statusUpdates.nodeId, nodeIds.slice(0, 400))))
          .orderBy(desc(schema.statusUpdates.createdAt))
          .limit(60)
      : [];
    const seen = new Set<string>();
    const nextSteps: OutlookData["nextSteps"] = [];
    for (const u of updates) {
      if (seen.has(u.nodeId)) continue;
      seen.add(u.nodeId);
      const node = scope.byId.get(u.nodeId);
      for (const s of parseSteps(u.nextStepsJson).slice(0, 2)) {
        nextSteps.push({
          nodeEn: `${node?.code ?? ""} ${node?.titleEn ?? ""}`.trim(),
          nodeAr: `${node?.code ?? ""} ${node?.titleAr ?? ""}`.trim(),
          en: s.en,
          ar: s.ar,
        });
      }
      if (nextSteps.length >= 8) break;
    }
    return {
      releases: releases.map((r) => ({ titleEn: r.titleEn, titleAr: r.titleAr, date: r.releaseDate })),
      forecastDirections,
      endingSoon,
      nextSteps,
      horizonEnd,
      editionCode: scope.edition?.code ?? null,
    };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const mock = (): Prose => {
      const paragraphs = [];
      if (data.endingSoon.length) {
        paragraphs.push(
          bi(
            `${fmt(data.endingSoon.length)} initiatives and projects in scope are due to close within 120 days of ${period.en}; the nearest is ${data.endingSoon[0].code ?? data.endingSoon[0].titleEn} on ${data.endingSoon[0].endDate}, currently ${statusText(data.endingSoon[0].status).en}.`,
            `من المقرر إقفال ${fmt(data.endingSoon.length)} مبادرة ومشروعاً ضمن النطاق خلال 120 يوماً من ${period.ar}؛ وأقربها ${data.endingSoon[0].code ?? data.endingSoon[0].titleAr} في ${data.endingSoon[0].endDate}، وحالته اليوم ${statusText(data.endingSoon[0].status).ar}.`
          )
        );
      } else {
        paragraphs.push(
          bi(
            `No initiative or project in scope reaches its end date within 120 days of ${period.en}, so the next period is one of continued delivery rather than closure.`,
            `لا تصل أي مبادرة أو مشروع ضمن النطاق إلى تاريخ انتهائها خلال 120 يوماً من ${period.ar}، ولذلك تكون الفترة المقبلة فترة تنفيذ متواصل لا إقفال.`
          )
        );
      }
      if (data.forecastDirections) {
        const d = data.forecastDirections;
        paragraphs.push(
          bi(
            `Assessment: the current EnviroAI forecasts point upward for ${fmt(d.up)} tracked indices, downward for ${fmt(d.down)} and sideways for ${fmt(d.stable)}; these are model estimates, not published values.`,
            `تقدير: تشير تنبؤات EnviroAI الحالية إلى الصعود في ${fmt(d.up)} مؤشراً متابعاً، والهبوط في ${fmt(d.down)}، والاستقرار في ${fmt(d.stable)}؛ وهذه تقديرات نموذجية لا قيماً منشورة.`
          )
        );
      }
      if (data.releases.length) {
        paragraphs.push(
          bi(
            `${fmt(data.releases.length)} official statistical releases are scheduled in the coming weeks, beginning with ${data.releases[0].titleEn} on ${data.releases[0].date}.`,
            `من المجدول صدور ${fmt(data.releases.length)} إصدارات إحصائية رسمية في الأسابيع المقبلة، تبدأ بـ${data.releases[0].titleAr} في ${data.releases[0].date}.`
          )
        );
      }
      return {
        paragraphs,
        bullets: data.nextSteps.slice(0, 6).map((s) => bi(`${s.nodeEn}: ${s.en}`, `${s.nodeAr}: ${s.ar}`)),
      };
    };
    const { prose, live } = await writeProse(
      ctx,
      "outlook",
      {
        purpose: "The forward look that closes the narrative: what is scheduled, what closes soon, where the forecasts point, and the next steps the teams themselves recorded.",
        structure: "Two or three paragraphs, then bullets of next steps each prefixed by the initiative or project it belongs to. Label any judgement with 'Assessment:'.",
        paragraphs: 3,
        bullets: Math.min(6, data.nextSteps.length),
      },
      data,
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (data.endingSoon.length) {
      blocks.push({
        kind: "table",
        caption: bi("Initiatives and projects closing within 120 days", "المبادرات والمشاريع المقبلة على الإقفال خلال 120 يوماً"),
        columns: [bi("Code", "الرمز"), bi("Title", "العنوان"), bi("Status", "الحالة"), bi("End date", "تاريخ الانتهاء")],
        rows: data.endingSoon.map((i) => [
          bi(i.code ?? "", i.code ?? ""),
          bi(i.titleEn, i.titleAr),
          statusText(i.status),
          bi(i.endDate, i.endDate),
        ]),
        align: ["start", "start", "start", "end"],
      });
    }
    if (data.releases.length) {
      blocks.push({
        kind: "table",
        caption: bi("Scheduled statistical releases", "الإصدارات الإحصائية المجدولة"),
        columns: [bi("Release", "الإصدار"), bi("Date", "التاريخ")],
        rows: data.releases.map((r) => [bi(r.titleEn, r.titleAr), bi(r.date, r.date)]),
        align: ["start", "end"],
      });
    }
    return section("outlook", bi("Outlook", "الآفاق المقبلة"), "body", {
      lead: bi(
        `What the period after ${period.en} already holds.`,
        `ما تحمله الفترة التي تلي ${period.ar} منذ الآن.`
      ),
      blocks,
      sources: makeSources([
        ...(data.editionCode ? [SRC.strategy(data.editionCode)] : []),
        ...(data.forecastDirections ? [SRC.forecasts()] : []),
        ...(data.releases.length ? [{ title: "General Authority for Statistics (GASTAT) release calendar", detail: "as held in EnviroAI" }] : []),
      ]),
      meta: { live, horizonEnd: data.horizonEnd, endingSoon: data.endingSoon.length, releases: data.releases.length },
    });
  },
};

export default def;
