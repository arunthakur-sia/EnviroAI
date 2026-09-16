// CR07 analyst tools: the Council Strategy (2.5), the Organisation (3.7), and
// the lesson roll-up (1.3). Council citations carry the Internal chip and, while
// the seeded strategy is illustrative, say so in the source line.
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { ToolContext } from "./tools";
import {
  buildScorecard,
  getCouncilPageData,
  periodFor,
  ragOf,
  type Cadence,
  type CouncilPageData,
} from "@/server/services/council";
import { getLessonsForNode } from "@/server/services/lesson-links";
import { findUnit, getUnitPanel } from "@/server/services/organisation";
import { canSeeDocument } from "@/server/auth/permissions";

/** CR07 2.5: how a council citation names itself. */
function councilSourceLabel(data: CouncilPageData): string {
  return data.strategy.isIllustrative
    ? "SiaNexus Council Strategy, illustrative data"
    : "SiaNexus Council Strategy";
}

const LEVEL_WORDS: Record<string, string> = {
  goal: "strategic goal",
  intermediate_outcome: "intermediate outcome",
  output: "output",
  project: "project",
  activity: "activity",
};

/* ---- query_council_strategy ---- */
export async function toolQueryCouncilStrategy(
  ctx: ToolContext,
  input: {
    level?: string;
    goal?: string;
    text?: string;
    status?: string;
    count_by?: string;
  }
): Promise<string> {
  const data = await getCouncilPageData(ctx.user);
  if (!data) return "No Council Strategy has been recorded yet.";
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const goalOf = (nodeId: string): string | null => {
    let cursor = byId.get(nodeId);
    for (let i = 0; i < 6 && cursor; i++) {
      if (cursor.level === "goal") return cursor.id;
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return null;
  };

  let nodes = data.nodes;
  if (input.level) nodes = nodes.filter((n) => n.level === input.level);
  if (input.status) nodes = nodes.filter((n) => n.status === input.status);
  if (input.goal) {
    const needle = input.goal.trim().toLowerCase();
    const goal =
      data.nodes.find((n) => n.level === "goal" && n.code?.toLowerCase() === needle) ??
      data.nodes.find(
        (n) =>
          n.level === "goal" &&
          (n.titleEn.toLowerCase().includes(needle) || n.titleAr.includes(input.goal!.trim()))
      ) ??
      data.nodes.find((n) => n.level === "goal" && n.id === input.goal);
    if (goal) nodes = nodes.filter((n) => goalOf(n.id) === goal.id || n.id === goal.id);
  }
  if (input.text) {
    const needle = input.text.toLowerCase();
    nodes = nodes.filter(
      (n) =>
        n.titleEn.toLowerCase().includes(needle) ||
        n.titleAr.includes(input.text!) ||
        (n.descriptionEn ?? "").toLowerCase().includes(needle)
    );
  }

  if (input.count_by) {
    const key = input.count_by;
    const counts = new Map<string, number>();
    for (const n of nodes) {
      let bucket = "other";
      if (key === "status") bucket = n.status;
      else if (key === "level") bucket = n.level;
      else if (key === "owner_unit") bucket = n.ownerUnit?.nameEn ?? "unassigned";
      else if (key === "goal") {
        const g = goalOf(n.id);
        bucket = g ? byId.get(g)?.titleEn ?? "unassigned" : "unassigned";
      }
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    const lines = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([bucket, count]) => `${bucket}: ${count}`);
    return [
      `Council Strategy "${data.strategy.nameEn}" counted by ${key} (Internal, ${councilSourceLabel(data)}):`,
      ...lines,
    ].join("\n");
  }

  if (!nodes.length) return "No council nodes matched that scope.";
  const lines = nodes.slice(0, 25).map((n) => {
    const indicators = data.indicators.filter((i) => i.nodeId === n.id);
    const sourceN = ctx.state.addSource({
      resource_type: "council_node",
      resource_id: n.id,
      title: `${n.code ?? ""} ${n.titleEn}`,
      page: null,
      excerpt: (n.descriptionEn ?? "").slice(0, 200),
      verified: false,
    });
    const owner = n.ownerUnit?.nameEn ?? n.ownerUser?.nameEn ?? "unassigned";
    const perf = indicators.length
      ? ` indicators=${indicators.length} onTarget=${indicators.filter((i) => i.rag === "on_target").length}`
      : "";
    return `[${sourceN}] Internal | ${LEVEL_WORDS[n.level] ?? n.level} ${n.code ?? ""} "${n.titleEn}" / "${n.titleAr}" status=${n.status} owner=${owner}${perf}`;
  });
  return [
    `Council Strategy "${data.strategy.nameEn}" (${data.strategy.periodFrom?.slice(0, 4)} to ${data.strategy.periodTo?.slice(0, 4)}), Internal. Source: ${councilSourceLabel(data)}.`,
    ...lines,
    nodes.length > 25 ? `(${nodes.length - 25} more matched)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---- get_council_node ---- */
export async function toolGetCouncilNode(
  ctx: ToolContext,
  input: { id?: string; code?: string }
): Promise<string> {
  const data = await getCouncilPageData(ctx.user);
  if (!data) return "No Council Strategy has been recorded yet.";
  const node =
    data.nodes.find((n) => n.id === input.id) ??
    data.nodes.find((n) => n.code?.toLowerCase() === (input.code ?? "").toLowerCase());
  if (!node) return "Council node not found. Use query_council_strategy to list the codes.";
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const children = node.childIds.map((id) => byId.get(id)).filter(Boolean);
  const indicators = data.indicators.filter((i) => i.nodeId === node.id);
  const alignment = data.alignment.filter((a) => a.councilNodeId === node.id);
  const risks = data.risks.filter((r) => r.nodeId === node.id);
  const lessons = await getLessonsForNode(ctx.user, node.id);

  const n = ctx.state.addSource({
    resource_type: "council_node",
    resource_id: node.id,
    title: `${node.code ?? ""} ${node.titleEn}`,
    page: null,
    excerpt: (node.descriptionEn ?? "").slice(0, 240),
  });
  return [
    `[${n}] Internal | ${LEVEL_WORDS[node.level] ?? node.level} ${node.code ?? ""} "${node.titleEn}" / "${node.titleAr}" status=${node.status}`,
    `Source: ${councilSourceLabel(data)}`,
    node.ownerUnit ? `Owner unit: ${node.ownerUnit.nameEn} / ${node.ownerUnit.nameAr}` : "",
    node.ownerUser ? `Owner: ${node.ownerUser.nameEn}` : "",
    node.startDate ? `Runs ${node.startDate} to ${node.endDate ?? "-"}` : "",
    node.budgetQar != null ? `Budget QAR ${node.budgetQar}` : "",
    node.priorityImpact != null
      ? `Priority: impact ${node.priorityImpact} of 5, feasibility ${node.priorityFeasibility ?? "-"} of 5`
      : "",
    `Description: ${(node.descriptionEn ?? "").slice(0, 500)}`,
    node.onTargetShare != null
      ? `Indicators beneath it on target: ${Math.round(node.onTargetShare * 100)} percent`
      : "",
    ...indicators.map(
      (i) =>
        `Indicator ${i.code} "${i.nameEn}" unit=${i.unit ?? "-"} cadence=${i.frequency} baseline=${i.baselineValue ?? "-"} latest=${i.latest?.actual ?? "-"} target=${i.latest?.target ?? "-"} (${i.rag})`
    ),
    children.length
      ? `Beneath it: ${children.map((c) => `${c!.code ?? ""} ${c!.titleEn} (${c!.status})`).join("; ")}`
      : "",
    alignment.length
      ? `Supports in NDS3: ${alignment.map((a) => `${a.labelEn ?? a.targetId}${a.noteEn ? ` (${a.noteEn})` : ""}`).join("; ")}`
      : "",
    risks.length
      ? `Risks: ${risks.map((r) => `${r.code ?? ""} ${r.titleEn} likelihood ${r.likelihood} impact ${r.impact} (${r.status})`).join("; ")}`
      : "",
    lessons.direct.length || lessons.inherited.length
      ? `Lessons: ${lessons.direct.length} direct, ${lessons.inherited.length} inherited from beneath`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---- get_council_indicator ---- */
export async function toolGetCouncilIndicator(
  ctx: ToolContext,
  input: { id?: string; code?: string; period?: string }
): Promise<string> {
  const data = await getCouncilPageData(ctx.user);
  if (!data) return "No Council Strategy has been recorded yet.";
  const indicator =
    data.indicators.find((i) => i.id === input.id) ??
    data.indicators.find((i) => i.code.toLowerCase() === (input.code ?? "").toLowerCase());
  if (!indicator) return "Council indicator not found.";
  const node = data.nodes.find((n) => n.id === indicator.nodeId);
  const n = ctx.state.addSource({
    resource_type: "council_indicator",
    resource_id: indicator.id,
    title: `${indicator.code} ${indicator.nameEn}`,
    page: null,
    excerpt: (indicator.definitionEn ?? "").slice(0, 200),
  });
  const point = input.period
    ? indicator.series.find((p) => p.period === input.period)
    : indicator.latest;
  const { rag } = ragOf(point?.actual, point?.target, indicator.direction);
  const recent = indicator.series
    .filter((p) => p.actual != null)
    .slice(-8)
    .map((p) => `${p.period}=${p.actual}${p.target != null ? ` of ${p.target}` : ""}`)
    .join(", ");
  return [
    `[${n}] Internal | Council indicator ${indicator.code} "${indicator.nameEn}" / "${indicator.nameAr}"`,
    `Source: ${councilSourceLabel(data)}`,
    node ? `Measures: ${LEVEL_WORDS[node.level] ?? node.level} ${node.code ?? ""} ${node.titleEn}` : "",
    `Definition: ${indicator.definitionEn ?? "-"}`,
    `Formula: ${indicator.formulaEn ?? "-"}`,
    `Unit ${indicator.unit ?? "-"}, direction ${indicator.direction}, reported ${indicator.frequency}`,
    `Baseline ${indicator.baselineValue ?? "-"} (${indicator.baselineYear ?? "-"})`,
    point
      ? `Period ${point.period}: actual ${point.actual ?? "-"} against target ${point.target ?? "-"} (${rag})`
      : "No actual has been reported yet.",
    recent ? `Recent: ${recent}` : "",
    `Data source: ${indicator.dataSourceEn ?? "-"}. Means of verification: ${indicator.meansOfVerificationEn ?? "-"}.`,
    indicator.responsible ? `Responsible: ${indicator.responsible.nameEn}` : "",
    indicator.linkedStatisticsIndicatorId
      ? "Actuals are read from the linked Statistics Hub indicator."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---- get_council_scorecard ---- */
export async function toolGetCouncilScorecard(
  ctx: ToolContext,
  input: { period?: string }
): Promise<string> {
  const data = await getCouncilPageData(ctx.user);
  if (!data) return "No Council Strategy has been recorded yet.";
  const period = input.period ?? periodFor("quarterly");
  const cadence: Cadence = /^\d{4}$/.test(period)
    ? "yearly"
    : /^\d{4}-Q[1-4]$/.test(period)
      ? "quarterly"
      : "monthly";
  const card = buildScorecard(data, period, cadence);
  const lines = card.goals.map((g) => {
    const share = g.share == null ? "no indicator of this cadence reported" : `${Math.round(g.share * 100)} percent on target`;
    const others: string[] = [];
    for (const [freq, count] of Object.entries(g.otherCadence)) {
      if (count > 0 && freq !== cadence) others.push(`${count} reported ${freq}`);
    }
    return `${g.code ?? ""} ${g.titleEn}: ${share} of ${g.reported} reported (${g.onTarget} on target, ${g.atRisk} at risk, ${g.behind} behind)${others.length ? `; ${others.join(", ")}` : ""}`;
  });
  return [
    `Council Strategy scorecard for ${period} (${cadence} indicators), Internal. Source: ${councilSourceLabel(data)}.`,
    ...lines,
  ].join("\n");
}

/* ---- get_council_alignment ---- */
export async function toolGetCouncilAlignment(
  ctx: ToolContext,
  input: { node_id?: string; nds_outcome?: string }
): Promise<string> {
  const data = await getCouncilPageData(ctx.user);
  if (!data) return "No Council Strategy has been recorded yet.";
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  let rows = data.alignment;
  if (input.node_id) {
    const node =
      data.nodes.find((n) => n.id === input.node_id) ??
      data.nodes.find((n) => n.code?.toLowerCase() === input.node_id!.toLowerCase());
    if (node) rows = rows.filter((a) => a.councilNodeId === node.id);
  }
  if (input.nds_outcome) {
    const needle = input.nds_outcome.toLowerCase();
    const [outcome] = await db
      .select({ id: schema.strategyNodes.id, code: schema.strategyNodes.code })
      .from(schema.strategyNodes)
      .where(
        and(
          eq(schema.strategyNodes.nodeType, "outcome"),
          or(
            sql`lower(${schema.strategyNodes.code}) = ${needle}`,
            like(schema.strategyNodes.titleEn, `%${input.nds_outcome}%`)
          )
        )
      )
      .limit(1);
    if (outcome) rows = rows.filter((a) => a.targetId === outcome.id);
  }
  if (!rows.length) return "No alignment has been recorded for that scope.";
  const lines = rows.map((a) => {
    const node = byId.get(a.councilNodeId);
    return `Internal | ${node?.code ?? ""} "${node?.titleEn ?? ""}" supports ${a.labelEn ?? a.targetId} (${a.targetKind}): ${a.noteEn ?? ""}`;
  });
  return [`Council to national alignment. Source: ${councilSourceLabel(data)}.`, ...lines].join("\n");
}

/* ---- get_org_unit ---- */
export async function toolGetOrgUnit(
  ctx: ToolContext,
  input: { name_or_code?: string }
): Promise<string> {
  const needle = (input.name_or_code ?? "").trim();
  if (!needle) return "Give the name or the code of an organisation unit.";
  const unit = await findUnit(needle);
  if (!unit) return "No organisation unit matched that name or code.";
  const panel = await getUnitPanel(ctx.user, unit.code);
  if (!panel) return "No organisation unit matched that name or code.";

  // the unit's own reference document carries the published mandate
  const [doc] = await db
    .select({ id: schema.documents.id, titleEn: schema.documents.titleEn })
    .from(schema.documents)
    .where(eq(schema.documents.sourceRef, `npc.qa organisational structure: ${unit.code}`))
    .limit(1);
  const n = doc
    ? ctx.state.addSource({
        resource_type: "document",
        resource_id: doc.id,
        title: doc.titleEn,
        page: null,
        excerpt: panel.mandateEn[0] ?? "",
        verified: true,
      })
    : null;

  const headLine = panel.head
    ? `Head: ${panel.head.nameEn} / ${panel.head.nameAr}${panel.head.positionEn ? `, ${panel.head.positionEn}` : ""}`
    : panel.unit.headNameEn
      ? `Head: ${panel.unit.headNameEn} / ${panel.unit.headNameAr ?? ""} (${panel.unit.headTitleEn ?? ""})`
      : "No head recorded.";
  return [
    `${n ? `[${n}] ` : ""}${panel.unit.nameEn} / ${panel.unit.nameAr} (${panel.unit.level}, code ${panel.unit.code})`,
    panel.breadcrumb.length ? `Reports through: ${panel.breadcrumb.map((b) => b.nameEn).join(" > ")}` : "",
    headLine,
    `Headcount: ${panel.unit.headcount} in the unit, ${panel.unit.headcountTotal} including sub units.`,
    panel.mandateSourceUrl
      ? `Mandate as published on ${panel.mandateSourceUrl} (fetched ${panel.mandateFetchedAt?.slice(0, 10) ?? "-"}):`
      : "Mandate:",
    ...panel.mandateEn.slice(0, 12).map((line, i) => `${i + 1}. ${line}`),
    panel.subUnits.length
      ? `Sub units: ${panel.subUnits.map((s) => s.nameEn).join("; ")}`
      : "",
    panel.owns.councilNodes.length
      ? `Owns in the Council Strategy: ${panel.owns.councilNodes.length} items`
      : "",
    panel.owns.ndsNodes.length ? `Leads in NDS3: ${panel.owns.ndsNodes.length} items` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---- query_org ---- */
export async function toolQueryOrg(
  ctx: ToolContext,
  input: { level?: string; text?: string }
): Promise<string> {
  const rows = await db.select().from(schema.orgUnits).orderBy(asc(schema.orgUnits.sort));
  let units = rows;
  if (input.level) units = units.filter((u) => u.level === input.level);
  if (input.text) {
    const needle = input.text.toLowerCase();
    units = units.filter(
      (u) =>
        u.nameEn.toLowerCase().includes(needle) ||
        u.nameAr.includes(input.text!) ||
        (u.mandateEn ?? "").toLowerCase().includes(needle)
    );
  }
  if (!units.length) return "No organisation unit matched.";
  const byId = new Map(rows.map((u) => [u.id, u]));
  return [
    `NPC organisation, ${units.length} units of ${rows.length}, as published on npc.qa:`,
    ...units
      .slice(0, 40)
      .map(
        (u) =>
          `${u.code} (${u.level}) ${u.nameEn} / ${u.nameAr}${u.parentId ? ` under ${byId.get(u.parentId)?.nameEn ?? ""}` : ""}${u.headNameEn ? `, head ${u.headNameEn}` : ""}`
      ),
  ].join("\n");
}

/* ---- get_unit_policies ---- */
export async function toolGetUnitPolicies(
  ctx: ToolContext,
  input: { unit?: string; kind?: string }
): Promise<string> {
  const unit = await findUnit(input.unit ?? "");
  if (!unit) return "No organisation unit matched that name or code.";
  const links = await db
    .select()
    .from(schema.documentUnitLinks)
    .where(eq(schema.documentUnitLinks.unitId, unit.id));
  if (!links.length) return `${unit.nameEn} has no policies or procedures published yet.`;
  const docs = await db
    .select()
    .from(schema.documents)
    .where(inArray(schema.documents.id, links.map((l) => l.documentId)))
    .orderBy(desc(schema.documents.updatedAt));
  const [dimension] = await db
    .select()
    .from(schema.taxonomyDimensions)
    .where(eq(schema.taxonomyDimensions.code, "knowledge_type"))
    .limit(1);
  const terms = dimension
    ? await db
        .select()
        .from(schema.taxonomyTerms)
        .where(eq(schema.taxonomyTerms.dimensionId, dimension.id))
    : [];
  const codeOf = new Map(terms.map((t) => [t.id, t.code]));
  const wanted = input.kind ? [input.kind] : ["policy_internal", "procedure", "form_template", "service"];

  const lines: string[] = [];
  let hidden = 0;
  for (const d of docs) {
    if (d.deletedAt || d.status === "archived") continue;
    const code = d.knowledgeTypeTermId ? codeOf.get(d.knowledgeTypeTermId) : null;
    if (!code || !wanted.includes(code)) continue;
    // CR07 3.5: a hidden item must not appear in an answer at all
    if (!canSeeDocument(ctx.user, d)) {
      hidden++;
      continue;
    }
    const n = ctx.state.addSource({
      resource_type: "document",
      resource_id: d.id,
      title: d.titleEn,
      page: null,
      excerpt: (d.summaryEn ?? "").slice(0, 200),
      verified: d.status === "verified",
    });
    lines.push(
      `[${n}] ${code} | ${d.titleEn} / ${d.titleAr}, version ${d.versionLabel ?? "-"}, effective ${d.effectiveFrom ?? "-"}: ${(d.summaryEn ?? "").slice(0, 200)}`
    );
  }
  if (!lines.length) {
    return `${unit.nameEn} has nothing published in that category that you may see.`;
  }
  void hidden; // hidden items are never mentioned, not even as a count
  return [`Policies and procedures of ${unit.nameEn} / ${unit.nameAr}:`, ...lines].join("\n");
}

/* ---- get_lessons_for_node: direct plus inherited (CR07 1.3) ---- */
export async function toolGetLessonsForNode(
  ctx: ToolContext,
  input: { node_id?: string; code?: string }
): Promise<string> {
  let nodeId = input.node_id ?? "";
  if (!nodeId && input.code) {
    const needle = input.code.toLowerCase();
    const [nds] = await db
      .select({ id: schema.strategyNodes.id })
      .from(schema.strategyNodes)
      .where(sql`lower(${schema.strategyNodes.code}) = ${needle}`)
      .limit(1);
    if (nds) nodeId = nds.id;
    else {
      const [council] = await db
        .select({ id: schema.councilNodes.id })
        .from(schema.councilNodes)
        .where(sql`lower(${schema.councilNodes.code}) = ${needle}`)
        .limit(1);
      if (council) nodeId = council.id;
    }
  }
  if (!nodeId) return "Give a node id or code.";
  const { direct, inherited } = await getLessonsForNode(ctx.user, nodeId);
  if (!direct.length && !inherited.length) return "No lessons are linked to that node or anything beneath it.";
  const render = (row: (typeof direct)[number], mark: string) => {
    const n = ctx.state.addSource({
      resource_type: "lesson",
      resource_id: row.lessonId,
      title: row.titleEn,
      page: null,
      excerpt: "",
      verified: row.status === "verified",
    });
    return `[${n}] ${mark} ${row.titleEn} / ${row.titleAr} (${row.category})${mark === "inherited" ? ` from ${row.originCode ?? ""} ${row.originEn}` : ""}`;
  };
  return [
    `${direct.length} direct and ${inherited.length} inherited lessons.`,
    ...direct.map((r) => render(r, "direct")),
    ...inherited.map((r) => render(r, "inherited")),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* the tool definitions the analyst sees                                */
/* ------------------------------------------------------------------ */

export const CR07_TOOLS = [
  {
    name: "query_council_strategy",
    description:
      "Search the Council Strategy, the National Planning Council's own institutional strategy. Results chain levels are goal, intermediate_outcome, output, project and activity. Filter by level, by goal (code such as G2 or a title), by free text, or by status; or pass count_by = status | level | owner_unit | goal for a tally. All council content is Internal.",
    input_schema: {
      type: "object" as const,
      properties: {
        level: {
          type: "string",
          enum: ["goal", "intermediate_outcome", "output", "project", "activity"],
        },
        goal: { type: "string" },
        text: { type: "string" },
        status: { type: "string" },
        count_by: { type: "string", enum: ["status", "level", "owner_unit", "goal"] },
      },
    },
  },
  {
    name: "get_council_node",
    description:
      "One node of the Council Strategy by id or code (for example G2, G1.IO1, G1.IO1.OP1, CP-07) with its indicators, the levels beneath it, its alignment to NDS3, its risks and its lessons.",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string" }, code: { type: "string" } },
    },
  },
  {
    name: "get_council_indicator",
    description:
      "One Council Strategy indicator card by id or code (CI-001 style) with its definition, formula, unit, cadence, baseline, data source, means of verification, and the actual against target for a period.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string" },
        code: { type: "string" },
        period: { type: "string", description: "2026, 2026-Q3 or 2026-07" },
      },
    },
  },
  {
    name: "get_council_scorecard",
    description:
      "The Council Strategy scorecard for a period: how each strategic goal performs against its indicators of the matching cadence, and how many of its indicators report on another cadence.",
    input_schema: {
      type: "object" as const,
      properties: { period: { type: "string", description: "2026, 2026-Q3 or 2026-07" } },
    },
  },
  {
    name: "get_council_alignment",
    description:
      "How the Council Strategy supports the national strategy: the mapping from council goals and outputs to NDS3 outcomes, targets, KPIs and the National Data and Statistics Strategy.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "a council node id or code" },
        nds_outcome: { type: "string", description: "an NDS3 outcome code such as O7, or its title" },
      },
    },
  },
  {
    name: "get_org_unit",
    description:
      "One organisation unit of the National Planning Council by name or code, with its published mandate (verbatim from npc.qa), its head, its headcount, its sub units, and what it owns.",
    input_schema: {
      type: "object" as const,
      properties: { name_or_code: { type: "string" } },
    },
  },
  {
    name: "query_org",
    description:
      "List the National Planning Council's organisation units, optionally filtered by level (secretary_general, sector, office, department, section) or by text in the name or mandate.",
    input_schema: {
      type: "object" as const,
      properties: { level: { type: "string" }, text: { type: "string" } },
    },
  },
  {
    name: "get_unit_policies",
    description:
      "The policies, procedures, forms and services published by one organisation unit. Respects each item's visibility: items the user may not see are never returned.",
    input_schema: {
      type: "object" as const,
      properties: {
        unit: { type: "string" },
        kind: {
          type: "string",
          enum: ["policy_internal", "procedure", "form_template", "service"],
        },
      },
    },
  },
  {
    name: "get_lessons_for_node",
    description:
      "Lessons linked to a strategy node, in either store, split into the lessons linked directly to it and the lessons inherited from everything beneath it, each naming the node it came from.",
    input_schema: {
      type: "object" as const,
      properties: { node_id: { type: "string" }, code: { type: "string" } },
    },
  },
];

/** CR05 6.1: the portal each CR07 tool belongs to. */
export const CR07_TOOL_PORTAL: Record<string, string> = {
  query_council_strategy: "council",
  get_council_node: "council",
  get_council_indicator: "council",
  get_council_scorecard: "council",
  get_council_alignment: "council",
  get_org_unit: "organisation",
  query_org: "organisation",
  get_unit_policies: "organisation",
  get_lessons_for_node: "lessons",
};

export async function runCr07Tool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<string | null> {
  switch (name) {
    case "query_council_strategy":
      return toolQueryCouncilStrategy(ctx, input as never);
    case "get_council_node":
      return toolGetCouncilNode(ctx, input as never);
    case "get_council_indicator":
      return toolGetCouncilIndicator(ctx, input as never);
    case "get_council_scorecard":
      return toolGetCouncilScorecard(ctx, input as never);
    case "get_council_alignment":
      return toolGetCouncilAlignment(ctx, input as never);
    case "get_org_unit":
      return toolGetOrgUnit(ctx, input as never);
    case "query_org":
      return toolQueryOrg(ctx, input as never);
    case "get_unit_policies":
      return toolGetUnitPolicies(ctx, input as never);
    case "get_lessons_for_node":
      return toolGetLessonsForNode(ctx, input as never);
    default:
      return null;
  }
}
