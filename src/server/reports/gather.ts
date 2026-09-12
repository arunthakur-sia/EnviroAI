// CR02 7: collects the selected items for a report, normalised for the
// narrative writer and the docx layout.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { listSignals } from "@/server/services/signals";
import { listDeliverables } from "@/server/services/deliverables";

export type ReportItem = {
  type: "signal" | "lesson" | "document" | "deliverable" | "node" | "answer" | "episode";
  id: string;
  titleEn: string;
  titleAr: string;
  date: string | null;
  metaEn: string;
  metaAr: string;
  textEn: string;
  textAr: string;
  outcomeCodes: string[];
};

export type ReportChart = {
  labelEn: string;
  labelAr: string;
  unit: string | null;
  points: { period: string; value: number }[];
  target?: number | null;
};

export type ReportScopeInput = {
  kind: "signals" | "lessons" | "vault" | "node" | "ask" | "podcast" | "collection";
  ids: string[];
  labelEn: string;
  labelAr: string;
  filters?: Record<string, string>;
};

export type ReportOptionsInput = {
  audience: "leadership" | "working";
  language: "en" | "ar" | "both";
  summaryLength: "short" | "full";
  includeCharts: boolean;
  includeSources: boolean;
  includeLessons: boolean;
  includeSignals: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
};

function inRange(date: string | null, options: ReportOptionsInput): boolean {
  if (!date) return true;
  if (options.dateFrom && date < options.dateFrom) return false;
  if (options.dateTo && date > `${options.dateTo}T23:59:59`) return false;
  return true;
}

function signalItem(s: {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  whyItMattersEn: string | null;
  whyItMattersAr: string | null;
  publisher: string | null;
  publishedAt: string | null;
  signalType: string;
  impact: string;
}): ReportItem {
  return {
    type: "signal",
    id: s.id,
    titleEn: s.titleEn,
    titleAr: s.titleAr || s.titleEn,
    date: s.publishedAt,
    metaEn: [s.publisher, s.signalType, `impact ${s.impact}`].filter(Boolean).join(" · "),
    metaAr: [s.publisher, s.signalType, `الأثر ${s.impact}`].filter(Boolean).join(" · "),
    textEn: [s.descriptionEn, s.whyItMattersEn].filter(Boolean).join(" "),
    textAr: [s.descriptionAr, s.whyItMattersAr].filter(Boolean).join(" "),
    outcomeCodes: [],
  };
}

function lessonItem(l: typeof schema.lessons.$inferSelect): ReportItem {
  return {
    type: "lesson",
    id: l.id,
    titleEn: l.titleEn,
    titleAr: l.titleAr || l.titleEn,
    date: l.createdAt,
    metaEn: `${l.category} · ${l.status}`,
    metaAr: `${l.category} · ${l.status}`,
    textEn: [l.contextEn, l.learningEn, l.recommendationEn].filter(Boolean).join(" "),
    textAr: [l.contextAr, l.learningAr, l.recommendationAr].filter(Boolean).join(" "),
    outcomeCodes: [],
  };
}

function documentItem(
  d: typeof schema.documents.$inferSelect,
  deliverableCode?: string | null,
  nodeCode?: string | null
): ReportItem {
  const keyFacts = (() => {
    try {
      return (JSON.parse(d.keyFactsJson ?? "[]") as { text_en?: string; text_ar?: string }[])
        .slice(0, 3);
    } catch {
      return [];
    }
  })();
  return {
    type: deliverableCode ? "deliverable" : "document",
    id: d.id,
    titleEn: deliverableCode ? `${deliverableCode} ${d.titleEn} (${nodeCode ?? ""})` : d.titleEn,
    titleAr: deliverableCode ? `${deliverableCode} ${d.titleAr || d.titleEn}` : d.titleAr || d.titleEn,
    date: d.createdAt,
    metaEn: [d.status, d.publishYear ? String(d.publishYear) : null].filter(Boolean).join(" · "),
    metaAr: [d.status, d.publishYear ? String(d.publishYear) : null].filter(Boolean).join(" · "),
    textEn: [d.summaryEn, ...keyFacts.map((f) => f.text_en)].filter(Boolean).join(" "),
    textAr: [d.summaryAr, ...keyFacts.map((f) => f.text_ar)].filter(Boolean).join(" "),
    outcomeCodes: [],
  };
}

export async function gatherReportItems(
  user: CurrentUser,
  scope: ReportScopeInput,
  options: ReportOptionsInput
): Promise<{ items: ReportItem[]; charts: ReportChart[] }> {
  const items: ReportItem[] = [];
  const charts: ReportChart[] = [];
  const clearance = (level: number) => level <= user.clearanceLevel;

  if (scope.kind === "signals") {
    if (scope.ids.length) {
      const rows = await db
        .select()
        .from(schema.signals)
        .where(inArray(schema.signals.id, scope.ids));
      for (const s of rows) items.push(signalItem(s));
    } else {
      const rows = await listSignals(user, {
        outcome: scope.filters?.outcome,
        triage: (scope.filters?.triage as never) ?? "accepted",
        days: 365,
        limit: 40,
      });
      for (const s of rows) items.push(signalItem(s as never));
    }
  } else if (scope.kind === "lessons") {
    const conds = [sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`];
    if (scope.ids.length) conds.push(inArray(schema.lessons.id, scope.ids));
    if (scope.filters?.category) conds.push(eq(schema.lessons.category, scope.filters.category));
    const rows = await db
      .select()
      .from(schema.lessons)
      .where(and(...conds))
      .orderBy(desc(schema.lessons.createdAt))
      .limit(40);
    for (const l of rows) items.push(lessonItem(l));
  } else if (scope.kind === "vault" || scope.kind === "collection") {
    let docIds = scope.ids;
    if (scope.kind === "collection" && scope.ids.length) {
      const members = await db
        .select()
        .from(schema.collectionItems)
        .where(
          and(
            inArray(schema.collectionItems.collectionId, scope.ids),
            eq(schema.collectionItems.resourceType, "document")
          )
        );
      docIds = members.map((m) => m.resourceId);
    }
    if (docIds.length) {
      const rows = await db
        .select()
        .from(schema.documents)
        .where(inArray(schema.documents.id, docIds));
      for (const d of rows) {
        if (!d.deletedAt && clearance(d.classificationLevel)) items.push(documentItem(d));
      }
    }
  } else if (scope.kind === "node") {
    // the node and its children: header item, deliverables, lessons, signals
    const [root] = scope.ids.length
      ? await db
          .select()
          .from(schema.strategyNodes)
          .where(eq(schema.strategyNodes.id, scope.ids[0]))
          .limit(1)
      : [];
    if (root) {
      const all = await db
        .select()
        .from(schema.strategyNodes)
        .where(eq(schema.strategyNodes.editionId, root.editionId));
      const childrenOf = new Map<string | null, typeof all>();
      for (const n of all) {
        (childrenOf.get(n.parentId) ?? childrenOf.set(n.parentId, []).get(n.parentId)!).push(n);
      }
      const subtree: typeof all = [root];
      const stack = [root.id];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const c of childrenOf.get(cur) ?? []) {
          subtree.push(c);
          stack.push(c.id);
        }
      }
      for (const n of subtree.slice(0, 25)) {
        items.push({
          type: "node",
          id: n.id,
          titleEn: `${n.code ? n.code + " " : ""}${n.titleEn}`,
          titleAr: `${n.code ? n.code + " " : ""}${n.titleAr}`,
          date: n.updatedAt,
          metaEn: `${n.nodeType} · ${n.status}${n.ownerEntityName ? ` · ${n.ownerEntityName}` : ""}`,
          metaAr: `${n.nodeType} · ${n.status}${n.ownerEntityName ? ` · ${n.ownerEntityName}` : ""}`,
          textEn: n.descriptionEn ?? "",
          textAr: n.descriptionAr ?? "",
          outcomeCodes: [],
        });
      }
      // deliverables of delivery nodes in the subtree
      for (const n of subtree.filter((x) => x.nodeType === "project" || x.nodeType === "initiative").slice(0, 12)) {
        const dels = await listDeliverables(user, n.id);
        if (!dels.length) continue;
        const docs = await db
          .select()
          .from(schema.documents)
          .where(inArray(schema.documents.id, dels.map((x) => x.documentId)));
        for (const del of dels) {
          const doc = docs.find((d) => d.id === del.documentId);
          if (doc) items.push(documentItem(doc, del.deliverableCode, n.code));
        }
      }
      if (options.includeLessons) {
        const subtreeIds = subtree.map((n) => n.id);
        const lessonsRows = await db
          .select()
          .from(schema.lessons)
          .where(
            and(
              inArray(schema.lessons.nodeId, subtreeIds),
              sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`
            )
          )
          .limit(15);
        for (const l of lessonsRows) items.push(lessonItem(l));
      }
      if (options.includeSignals) {
        const signalsRows = await listSignals(user, {
          nodeId: root.id,
          triage: "accepted",
          days: 365,
          limit: 10,
        });
        for (const s of signalsRows) items.push(signalItem(s as never));
      }
      // KPI series for charts
      const kpis = await db
        .select()
        .from(schema.kpis)
        .where(inArray(schema.kpis.nodeId, subtree.map((n) => n.id)))
        .limit(4);
      for (const k of kpis) {
        const values = await db
          .select()
          .from(schema.kpiValues)
          .where(eq(schema.kpiValues.kpiId, k.id))
          .orderBy(schema.kpiValues.period);
        if (values.length >= 2) {
          charts.push({
            labelEn: k.nameEn,
            labelAr: k.nameAr,
            unit: k.unit,
            points: values
              .filter((v) => v.actualValue != null)
              .map((v) => ({ period: v.period, value: v.actualValue! })),
            target: k.targetValue,
          });
        }
      }
    }
  } else if (scope.kind === "ask") {
    const [conv] = scope.ids.length
      ? await db
          .select()
          .from(schema.aiConversations)
          .where(eq(schema.aiConversations.id, scope.ids[0]))
          .limit(1)
      : [];
    if (conv && (conv.userId === user.id || conv.isShared === 1)) {
      const messages = await db
        .select()
        .from(schema.aiMessages)
        .where(eq(schema.aiMessages.conversationId, conv.id));
      const answers = messages.filter((m) => m.role === "assistant");
      for (const [i, a] of answers.entries()) {
        items.push({
          type: "answer",
          id: a.id,
          titleEn: `${conv.title ?? "Ask NPC"} (answer ${i + 1})`,
          titleAr: `${conv.title ?? "اسأل المجلس"} (إجابة ${i + 1})`,
          date: a.createdAt,
          metaEn: `confidence ${a.confidence ?? "medium"}`,
          metaAr: `الثقة ${a.confidence ?? "متوسطة"}`,
          textEn: a.content.slice(0, 5000),
          textAr: a.content.slice(0, 5000),
          outcomeCodes: [],
        });
      }
    }
  } else if (scope.kind === "podcast") {
    const [episode] = scope.ids.length
      ? await db
          .select()
          .from(schema.podcastEpisodes)
          .where(eq(schema.podcastEpisodes.id, scope.ids[0]))
          .limit(1)
      : [];
    if (episode && clearance(episode.classificationLevel)) {
      const script = (() => {
        try {
          return JSON.parse(episode.scriptJson ?? "{}") as {
            segments?: { speaker: string; text: string }[];
          };
        } catch {
          return {};
        }
      })();
      const text = (script.segments ?? []).map((s) => `${s.speaker}: ${s.text}`).join("\n");
      items.push({
        type: "episode",
        id: episode.id,
        titleEn: episode.titleEn,
        titleAr: episode.titleAr,
        date: episode.createdAt,
        metaEn: `${episode.language} · ${episode.focus} · ${Math.round(episode.durationSec / 60)} min`,
        metaAr: `${episode.language} · ${episode.focus} · ${Math.round(episode.durationSec / 60)} د`,
        textEn: text.slice(0, 6000),
        textAr: text.slice(0, 6000),
        outcomeCodes: [],
      });
    }
  }

  const filtered = items.filter((i) => inRange(i.date, options)).slice(0, 40);
  return { items: filtered, charts: options.includeCharts ? charts.slice(0, 4) : [] };
}
