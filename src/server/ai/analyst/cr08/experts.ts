// CR08 3 and 2.2: expert tools answer in two labelled groups, internal
// first, never blended; the studies tool reads the Studies listing. Owned by
// the Experts and Studies agent.
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { ToolContext } from "../tools";
import type { ToolModule } from "./types";
import { suggestExpertsGrouped, type SuggestedExpert } from "@/server/ai/ask";
import { listStudies } from "@/server/services/studies";

const FIND_EXPERTS_GROUPED = "find_experts_grouped";
const GET_STUDIES = "get_studies";

/** Expert ids that match a domain (term code or name) and, for internal
    experts, a unit (code or name); null means "no restriction". */
async function scopeExpertIds(input: { domain?: string; unit?: string }): Promise<Set<string> | null> {
  let scoped: Set<string> | null = null;
  const intersect = (ids: string[]) => {
    const next = new Set(ids);
    scoped = scoped ? new Set([...scoped].filter((id) => next.has(id))) : next;
  };
  if (input.domain) {
    const needle = `%${input.domain.trim()}%`;
    const rows = await db
      .select({ expertId: schema.expertDomains.expertId })
      .from(schema.expertDomains)
      .innerJoin(schema.taxonomyTerms, eq(schema.taxonomyTerms.id, schema.expertDomains.termId))
      .where(
        and(
          eq(schema.expertDomains.accepted, 1),
          or(
            eq(schema.taxonomyTerms.code, input.domain.trim()),
            sql`${schema.taxonomyTerms.nameEn} like ${needle}`,
            sql`${schema.taxonomyTerms.nameAr} like ${needle}`
          )
        )
      );
    intersect(rows.map((r) => r.expertId));
  }
  if (input.unit) {
    const needle = `%${input.unit.trim()}%`;
    const units = await db
      .select({ id: schema.orgUnits.id, parentId: schema.orgUnits.parentId })
      .from(schema.orgUnits)
      .where(
        or(
          eq(schema.orgUnits.code, input.unit.trim().toUpperCase()),
          sql`${schema.orgUnits.nameEn} like ${needle}`,
          sql`${schema.orgUnits.nameAr} like ${needle}`
        )
      );
    // a sector matches everyone in the units beneath it
    const all = await db
      .select({ id: schema.orgUnits.id, parentId: schema.orgUnits.parentId })
      .from(schema.orgUnits);
    const wanted = new Set(units.map((u) => u.id));
    let grew = true;
    while (grew) {
      grew = false;
      for (const u of all) {
        if (u.parentId && wanted.has(u.parentId) && !wanted.has(u.id)) {
          wanted.add(u.id);
          grew = true;
        }
      }
    }
    const people = wanted.size
      ? await db
          .select({ id: schema.experts.id })
          .from(schema.experts)
          .innerJoin(schema.users, eq(schema.users.id, schema.experts.userId))
          .where(inArray(schema.users.departmentId, [...wanted]))
      : [];
    intersect(people.map((p) => p.id));
  }
  return scoped;
}

function describe(e: SuggestedExpert): string {
  const where = [e.positionEn, e.organisationEn].filter(Boolean).join(", ");
  return `${e.nameEn} / ${e.nameAr}${where ? ` (${where})` : ""}, ${e.availability}: ${e.reasonEn}`;
}

async function toolFindExpertsGrouped(
  ctx: ToolContext,
  input: { query: string; domain?: string; unit?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 6);
  const scoped = await scopeExpertIds(input);
  // ask for more when a scope will thin the list
  const groups = await suggestExpertsGrouped(input.query, ctx.user, scoped ? limit * 3 : limit);
  const keep = (list: SuggestedExpert[]) =>
    (scoped ? list.filter((e) => scoped.has(e.id)) : list).slice(0, limit);
  const internal = keep(groups.internal);
  const external = keep(groups.external);
  if (!internal.length && !external.length) {
    return "No matching experts in either group (internal NPC staff or external experts).";
  }

  for (const e of [...internal, ...external]) {
    if (ctx.state.workspace.people.some((p) => p.id === e.id) || ctx.state.workspace.people.length >= 8) continue;
    ctx.state.workspace.people.push({
      id: e.id,
      nameEn: e.nameEn,
      nameAr: e.nameAr,
      positionEn: e.positionEn,
      positionAr: e.positionAr,
      organisationEn: e.organisationEn,
      availability: e.availability,
      reasonEn: e.reasonEn,
      reasonAr: e.reasonAr,
    });
  }
  const line = (e: SuggestedExpert) => {
    const n = ctx.state.addSource({
      resource_type: "expert",
      resource_id: e.id,
      title: e.nameEn,
      page: null,
      excerpt: e.reasonEn,
    });
    return `[${n}] ${describe(e)}`;
  };
  const scopeNote = [input.domain ? `domain "${input.domain}"` : "", input.unit ? `unit "${input.unit}"` : ""]
    .filter(Boolean)
    .join(", ");
  return [
    `Experts for "${input.query}"${scopeNote ? ` (${scopeNote})` : ""}, in two groups. Present them under separate headings, internal first; never merge the groups.`,
    `INTERNAL EXPERTS (NPC staff): ${internal.length}`,
    ...(internal.length ? internal.map(line) : ["(none)"]),
    `EXTERNAL EXPERTS (other entities, academia, consultants, international advisors): ${external.length}`,
    ...(external.length ? external.map(line) : ["(none)"]),
  ].join("\n");
}

async function toolGetStudies(
  ctx: ToolContext,
  input: { topic?: string; outcome?: string; year?: number; type?: string; text?: string; limit?: number }
): Promise<string> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
  // topic and outcome accept a code or a name fragment
  const all = await listStudies(ctx.user, { q: input.text, type: input.type, year: input.year });
  const matchTerm = (list: { code: string; nameEn: string; nameAr: string }[], needle?: string) => {
    if (!needle) return true;
    const n = needle.trim().toLowerCase();
    return list.some(
      (t) => t.code === needle.trim() || t.nameEn.toLowerCase().includes(n) || t.nameAr.includes(needle.trim())
    );
  };
  const docs = all
    .filter((d) => matchTerm(d.topics, input.topic) && matchTerm(d.outcomes, input.outcome))
    .slice(0, limit);
  if (!docs.length) return "No studies, research papers or evaluations matched that scope.";

  const lines = docs.map((d) => {
    const n = ctx.state.addSource({
      resource_type: "document",
      resource_id: d.id,
      title: d.titleEn,
      page: null,
      excerpt: (d.summaryEn ?? "").slice(0, 200),
      verified: d.status === "verified",
    });
    if (!ctx.state.workspace.documents.some((x) => x.id === d.id) && ctx.state.workspace.documents.length < 8) {
      ctx.state.workspace.documents.push({
        id: d.id,
        titleEn: d.titleEn,
        titleAr: d.titleAr,
        summaryEn: d.summaryEn ?? null,
        summaryAr: d.summaryAr ?? null,
        page: null,
        status: d.status,
        classification: d.classification,
      });
    }
    const tags = [
      ...d.outcomes.map((o) => o.nameEn),
      ...d.topics.map((t) => t.nameEn),
    ].join(", ");
    return `[${n}] ${d.typeCode ?? "study"} ${d.publishYear ?? "undated"} "${d.titleEn}" / "${d.titleAr}"${d.departmentNameEn ? `, ${d.departmentNameEn}` : ""}${d.status === "verified" ? ", verified" : ""}${d.illustrative ? ", ILLUSTRATIVE seeded content" : ""}${tags ? ` | ${tags}` : ""} | ${(d.summaryEn ?? "").slice(0, 160)}`;
  });
  return [
    `Studies from Institutional Memory (${docs.length} of ${all.length} shown). Illustrative items are prototype content and must be named as such.`,
    ...lines,
  ].join("\n");
}

const mod: ToolModule = {
  definitions: [
    {
      name: FIND_EXPERTS_GROUPED,
      description:
        "Find experts for a question, returned in two labelled groups: internal (NPC staff) first, then external (other government entities, academia, consultants, international advisors). Optional domain (taxonomy code or name) and unit (organisation unit code or name, internal only). Never blend the groups in the answer.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "the question or topic to match experts to" },
          domain: { type: "string", description: "optional domain code or name" },
          unit: { type: "string", description: "optional organisation unit code or name (internal experts)" },
          limit: { type: "number", description: "experts per group, 1 to 6, default 3" },
        },
        required: ["query"],
      },
    },
    {
      name: GET_STUDIES,
      description:
        "Studies, research papers and evaluations from Institutional Memory, filtered by topic, outcome, year, type (study | research | evaluation) or text. Cites each document.",
      input_schema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "topic or sector code or name" },
          outcome: { type: "string", description: "NDS3 outcome code or name" },
          year: { type: "number", description: "publication year" },
          type: { type: "string", description: "study | research | evaluation" },
          text: { type: "string", description: "words to match in the title or summary" },
          limit: { type: "number", description: "1 to 25, default 10" },
        },
      },
    },
  ],
  portal: { [FIND_EXPERTS_GROUPED]: "experts", [GET_STUDIES]: "studies" },
  run: async (ctx, name, input) => {
    if (name === FIND_EXPERTS_GROUPED) return toolFindExpertsGrouped(ctx, input as never);
    if (name === GET_STUDIES) return toolGetStudies(ctx, input as never);
    return null;
  },
};

export default mod;
