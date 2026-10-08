// CR02 7: collects the selected items for a report, normalised for the
// narrative writer and the docx layout.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { listSignals } from "@/server/services/signals";
import { listDeliverables } from "@/server/services/deliverables";
import { loadLeadsFor } from "@/server/services/strategy";

export type ReportItem = {
  type: "signal" | "lesson" | "document" | "deliverable" | "node" | "answer" | "episode" | "index";
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
  kind:
    | "signals"
    | "lessons"
    | "vault"
    | "node"
    | "ask"
    | "podcast"
    | "collection"
    | "indices"
    | "hr"
    /* CR07 2.5: any level of the Programme Strategy */
    | "council_node";
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
      // CR05 2: the report names leads from node_leads, not the old free text
      const sliceNodes = subtree.slice(0, 25);
      const leadsByNode = await loadLeadsFor(sliceNodes.map((n) => n.id));
      for (const n of sliceNodes) {
        const leadRows = (leadsByNode.get(n.id) ?? []).filter((l) => l.role === "lead");
        const leadEn = leadRows.map((l) => l.nameEn).join(" + ");
        const leadAr = leadRows.map((l) => l.nameAr).join(" + ");
        items.push({
          type: "node",
          id: n.id,
          titleEn: `${n.code ? n.code + " " : ""}${n.titleEn}`,
          titleAr: `${n.code ? n.code + " " : ""}${n.titleAr}`,
          date: n.updatedAt,
          metaEn: `${n.nodeType} · ${n.status}${leadEn ? ` · ${leadEn}` : ""}`,
          metaAr: `${n.nodeType} · ${n.status}${leadAr ? ` · ${leadAr}` : ""}`,
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
  } else if (scope.kind === "council_node") {
    /* CR07 2.5: Extract report on any council level. The whole module is
       Internal, so the report carries classification 2 and the footer says so
       through the normal classification line. */
    const [root] = scope.ids.length
      ? await db
          .select()
          .from(schema.councilNodes)
          .where(eq(schema.councilNodes.id, scope.ids[0]))
          .limit(1)
      : [];
    if (root) {
      const all = await db
        .select()
        .from(schema.councilNodes)
        .where(eq(schema.councilNodes.strategyId, root.strategyId));
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
      const units = await db.select().from(schema.orgUnits);
      const unitById = new Map(units.map((u) => [u.id, u]));
      for (const n of subtree.slice(0, 30)) {
        const unit = n.ownerUnitId ? unitById.get(n.ownerUnitId) : null;
        items.push({
          type: "node",
          id: n.id,
          titleEn: `${n.code ? n.code + " " : ""}${n.titleEn}`,
          titleAr: `${n.code ? n.code + " " : ""}${n.titleAr}`,
          date: n.updatedAt,
          metaEn: `Internal · ${n.level} · ${n.status}${unit ? ` · ${unit.nameEn}` : ""}`,
          metaAr: `داخلي · ${n.level} · ${n.status}${unit ? ` · ${unit.nameAr}` : ""}`,
          textEn: n.descriptionEn ?? "",
          textAr: n.descriptionAr ?? "",
          outcomeCodes: [],
        });
      }
      // the indicator charts of the subtree
      const indicators = await db
        .select()
        .from(schema.councilIndicators)
        .where(inArray(schema.councilIndicators.nodeId, subtree.map((n) => n.id)))
        .limit(6);
      for (const indicator of indicators) {
        const values = await db
          .select()
          .from(schema.councilIndicatorValues)
          .where(eq(schema.councilIndicatorValues.indicatorId, indicator.id))
          .orderBy(schema.councilIndicatorValues.period);
        if (values.length >= 2) {
          charts.push({
            labelEn: indicator.nameEn,
            labelAr: indicator.nameAr,
            unit: indicator.unit,
            points: values
              .filter((v) => v.actualValue != null)
              .map((v) => ({ period: v.period, value: v.actualValue! })),
            target: null,
          });
        }
      }
      if (options.includeLessons) {
        const links = await db
          .select()
          .from(schema.lessonNodeLinks)
          .where(inArray(schema.lessonNodeLinks.nodeId, subtree.map((n) => n.id)));
        if (links.length) {
          const lessonsRows = await db
            .select()
            .from(schema.lessons)
            .where(
              and(
                inArray(schema.lessons.id, links.map((l) => l.lessonId)),
                sql`${schema.lessons.classificationLevel} <= ${user.clearanceLevel}`
              )
            )
            .limit(15);
          for (const l of lessonsRows) items.push(lessonItem(l));
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
          titleEn: `${conv.title ?? "Ask EnviroAI"} (answer ${i + 1})`,
          titleAr: `${conv.title ?? "اسأل EnviroAI"} (إجابة ${i + 1})`,
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
  } else if (scope.kind === "indices") {
    // CR05 4.4/4.7: the benchmark and board export. One item per index with
    // Saudi Arabia's standing and the current forecast (cited as a EnviroAI
    // forecast, never as a fact), plus rank-history charts.
    const rows = scope.ids.length
      ? await db.select().from(schema.indices).where(inArray(schema.indices.id, scope.ids))
      : await db.select().from(schema.indices).where(eq(schema.indices.isActive, 1));
    const obs = rows.length
      ? await db
          .select()
          .from(schema.indexObservations)
          .where(
            and(
              inArray(schema.indexObservations.indexId, rows.map((r) => r.id)),
              eq(schema.indexObservations.countryCode, "SAU")
            )
          )
      : [];
    const forecasts = rows.length
      ? await db
          .select()
          .from(schema.indexForecasts)
          .where(
            and(
              inArray(schema.indexForecasts.indexId, rows.map((r) => r.id)),
              eq(schema.indexForecasts.status, "current"),
              eq(schema.indexForecasts.horizonYears, 3)
            )
          )
      : [];
    for (const idx of rows) {
      const series = obs
        .filter((o) => o.indexId === idx.id)
        .sort((a, b) => a.year - b.year);
      const latest = series[series.length - 1];
      const f3 = forecasts.find((f) => f.indexId === idx.id);
      const forecastEn = f3
        ? ` EnviroAI forecast (method ${f3.methodVersion}, generated ${f3.generatedAt.slice(0, 10)}): three-year central ${
            f3.centralRank != null ? `rank ${Math.round(f3.centralRank)}` : f3.centralScore?.toFixed(2) ?? "-"
          }, direction ${f3.direction}.`
        : "";
      const forecastAr = f3
        ? ` تنبؤ EnviroAI (المنهجية ${f3.methodVersion}، بتاريخ ${f3.generatedAt.slice(0, 10)}): القيمة المركزية بعد ثلاث سنوات ${
            f3.centralRank != null ? `المرتبة ${Math.round(f3.centralRank)}` : f3.centralScore?.toFixed(2) ?? "-"
          }، والاتجاه ${f3.direction === "up" ? "صاعد" : f3.direction === "down" ? "هابط" : "مستقر"}.`
        : "";
      items.push({
        type: "index",
        id: idx.id,
        titleEn: idx.nameEn,
        titleAr: idx.nameAr,
        date: latest ? `${latest.year}-01-01` : null,
        metaEn: [idx.publisher, idx.category, idx.latestYear ? String(idx.latestYear) : null]
          .filter(Boolean)
          .join(" · "),
        metaAr: [idx.publisher, idx.category, idx.latestYear ? String(idx.latestYear) : null]
          .filter(Boolean)
          .join(" · "),
        textEn: `${
          latest
            ? `Saudi Arabia ${latest.rank != null ? `ranks ${latest.rank}${latest.totalCountries ? ` of ${latest.totalCountries}` : ""}` : `scores ${latest.score}`} in ${latest.year}.`
            : "No published Saudi Arabia value."
        }${forecastEn}`,
        textAr: `${
          latest
            ? `السعودية ${latest.rank != null ? `في المرتبة ${latest.rank}${latest.totalCountries ? ` من ${latest.totalCountries}` : ""}` : `بدرجة ${latest.score}`} عام ${latest.year}.`
            : "لا توجد قيمة منشورة للسعودية."
        }${forecastAr}`,
        outcomeCodes: [],
      });
      const rankPoints = series
        .filter((o) => o.rank != null)
        .slice(-10)
        .map((o) => ({ period: String(o.year), value: o.rank as number }));
      if (rankPoints.length >= 3) {
        charts.push({
          labelEn: `${idx.nameEn}: Saudi Arabia's rank`,
          labelAr: `${idx.nameAr}: مرتبة السعودية`,
          unit: "rank",
          points: rankPoints,
          target: null,
        });
      }
    }
  } else if (scope.kind === "hr") {
    // CR05 5.6.6: the department or organisation continuity report. Knowledge
    // ownership and risks only; never points, badges, streaks, or notes (5.1).
    const { getHrOverview, getHrDepartments } = await import("@/server/services/hr");
    const overview = await getHrOverview(user);
    const depts = await getHrDepartments(user);
    if (overview && depts) {
      const wanted = scope.ids.length
        ? depts.departments.filter((d) => scope.ids.includes(d.id))
        : depts.departments;
      items.push({
        type: "node",
        id: "hr-overview",
        titleEn: "Knowledge continuity overview",
        titleAr: "نظرة عامة على استمرارية المعرفة",
        date: null,
        metaEn: `readiness ${overview.rings.readiness} · continuity ${overview.rings.continuity} · handovers ${overview.rings.handoversComplete}%`,
        metaAr: `الجاهزية ${overview.rings.readiness} · الاستمرارية ${overview.rings.continuity} · التسليمات ${overview.rings.handoversComplete}%`,
        textEn: `Open risks: ${overview.riskCounts.critical} critical, ${overview.riskCounts.high} high, ${overview.riskCounts.medium} medium, ${overview.riskCounts.low} low. Top risks: ${overview.topRisks
          .slice(0, 5)
          .map((r) => `${r.severity}: ${r.title}`)
          .join("; ")}`,
        textAr: `المخاطر المفتوحة: ${overview.riskCounts.critical} حرجة، ${overview.riskCounts.high} عالية، ${overview.riskCounts.medium} متوسطة، ${overview.riskCounts.low} منخفضة.`,
        outcomeCodes: [],
      });
      for (const d of wanted) {
        items.push({
          type: "node",
          id: `hr-${d.id}`,
          titleEn: d.nameEn,
          titleAr: d.nameAr,
          date: null,
          metaEn: `headcount ${d.headcount} · readiness ${d.readiness} · continuity ${d.continuity} · open handovers ${d.openHandovers}`,
          metaAr: `العدد ${d.headcount} · الجاهزية ${d.readiness} · الاستمرارية ${d.continuity} · تسليمات مفتوحة ${d.openHandovers}`,
          textEn: `${d.responsibilitiesEn ?? ""} Repository: ${d.repository.documents} documents (${Math.round(d.repository.verifiedShare * 100)}% verified, ${Math.round(d.repository.staleShare * 100)}% stale), ${d.repository.lessons} lessons, ${d.repository.deliverables} deliverables. Risks: ${d.risks
            .map((r) => `${r.severity}: ${r.title}`)
            .join("; ")}`,
          textAr: `${d.responsibilitiesAr ?? ""} المستودع: ${d.repository.documents} وثيقة، ${d.repository.lessons} درسًا، ${d.repository.deliverables} مخرجًا.`,
          outcomeCodes: [],
        });
      }
      charts.push({
        labelEn: "Continuity score by department",
        labelAr: "درجة الاستمرارية حسب الإدارة",
        unit: null,
        points: overview.heat.map((h) => ({ period: h.code, value: h.continuity })),
        target: null,
      });
    }
  }

  const filtered = items.filter((i) => inRange(i.date, options)).slice(0, 40);
  return { items: filtered, charts: options.includeCharts ? charts.slice(0, 4) : [] };
}
