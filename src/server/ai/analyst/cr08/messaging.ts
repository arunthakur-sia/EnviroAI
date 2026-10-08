// CR08 9: owner lookup tools (who owns X, with the person card facts).
// Messages themselves are NEVER exposed to Ask EnviroAI (CR08 9.2): this module
// reads owners, units, documents, indicators and lessons, then the person
// card service; it never touches message_threads, thread_participants or
// messages.
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { canSeeDocument } from "@/server/auth/permissions";
import { findUnit } from "@/server/services/organisation";
import { getPersonCard, type PersonCard } from "@/server/services/people";
import type { ToolContext } from "../tools";
import type { ToolModule } from "./types";

const ITEM_TYPES = [
  "project",
  "initiative",
  "outcome",
  "target",
  "council_node",
  "document",
  "study",
  "policy",
  "indicator",
  "unit",
  "lesson",
] as const;

type Resolved = {
  /** what the person is to the item */
  role: string;
  userId: string | null;
  /** a unit-level owner when no person is named */
  unitFallback?: { nameEn: string; nameAr: string; headNameEn: string | null; headTitleEn: string | null } | null;
  source: { resource_type: string; resource_id: string; title: string; excerpt: string };
  item: { type: string; id: string };
};

async function unitHead(unitId: string | null) {
  if (!unitId) return null;
  const [u] = await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.id, unitId)).limit(1);
  return u ?? null;
}

async function resolveItem(ctx: ToolContext, itemType: string, needleRaw: string): Promise<Resolved | null> {
  const needle = needleRaw.trim().toLowerCase();
  if (!needle) return null;

  if (itemType === "unit") {
    const unit = await findUnit(needleRaw);
    if (!unit) return null;
    return {
      role: "unit_head",
      userId: unit.headUserId,
      unitFallback: { nameEn: unit.nameEn, nameAr: unit.nameAr, headNameEn: unit.headNameEn, headTitleEn: unit.headTitleEn },
      source: { resource_type: "org_unit", resource_id: unit.id, title: `${unit.code} ${unit.nameEn}`, excerpt: (unit.mandateEn ?? "").slice(0, 200) },
      item: { type: "unit", id: unit.id },
    };
  }

  if (["project", "initiative", "outcome", "target"].includes(itemType)) {
    const [node] = await db
      .select()
      .from(schema.strategyNodes)
      .where(sql`lower(${schema.strategyNodes.code}) = ${needle} or ${schema.strategyNodes.id} = ${needleRaw} or lower(${schema.strategyNodes.titleEn}) like ${"%" + needle + "%"}`)
      .limit(1);
    if (!node) return null;
    let userId = node.ownerUserId;
    let role = itemType === "project" || itemType === "initiative" ? "project_owner" : "owner";
    let unitFallback: Resolved["unitFallback"] = null;
    if (!userId) {
      // CR06: the department owner is the lead department on the node
      const [lead] = await db
        .select()
        .from(schema.nodeLeads)
        .where(and(eq(schema.nodeLeads.nodeId, node.id), eq(schema.nodeLeads.leadKind, "department"), eq(schema.nodeLeads.role, "lead")))
        .limit(1);
      const unit = lead ? await unitHead(lead.departmentId) : null;
      if (unit) {
        userId = unit.headUserId;
        role = "department_owner";
        unitFallback = { nameEn: unit.nameEn, nameAr: unit.nameAr, headNameEn: unit.headNameEn, headTitleEn: unit.headTitleEn };
      }
    }
    return {
      role,
      userId,
      unitFallback,
      source: { resource_type: "node", resource_id: node.id, title: `${node.code ?? ""} ${node.titleEn}`.trim(), excerpt: (node.descriptionEn ?? "").slice(0, 200) },
      item: { type: itemType, id: node.id },
    };
  }

  if (itemType === "council_node") {
    const [node] = await db
      .select()
      .from(schema.councilNodes)
      .where(sql`lower(${schema.councilNodes.code}) = ${needle} or ${schema.councilNodes.id} = ${needleRaw} or lower(${schema.councilNodes.titleEn}) like ${"%" + needle + "%"}`)
      .limit(1);
    if (!node) return null;
    let userId = node.ownerUserId;
    let role = "project_owner";
    let unitFallback: Resolved["unitFallback"] = null;
    if (!userId) {
      const unit = await unitHead(node.ownerUnitId);
      if (unit) {
        userId = unit.headUserId;
        role = "department_owner";
        unitFallback = { nameEn: unit.nameEn, nameAr: unit.nameAr, headNameEn: unit.headNameEn, headTitleEn: unit.headTitleEn };
      }
    }
    return {
      role,
      userId,
      unitFallback,
      source: { resource_type: "council_node", resource_id: node.id, title: `${node.code ?? ""} ${node.titleEn}`.trim(), excerpt: (node.descriptionEn ?? "").slice(0, 200) },
      item: { type: "council_node", id: node.id },
    };
  }

  if (["document", "study", "policy"].includes(itemType)) {
    const [doc] = await db
      .select()
      .from(schema.documents)
      .where(sql`${schema.documents.deletedAt} is null and (${schema.documents.id} = ${needleRaw} or lower(${schema.documents.titleEn}) like ${"%" + needle + "%"})`)
      .limit(1);
    if (!doc || !canSeeDocument(ctx.user, doc)) return null;
    return {
      role: "custodian",
      userId: doc.ownerUserId,
      source: { resource_type: "document", resource_id: doc.id, title: doc.titleEn, excerpt: (doc.summaryEn ?? "").slice(0, 200) },
      item: { type: "document", id: doc.id },
    };
  }

  if (itemType === "indicator") {
    const [kpi] = await db
      .select()
      .from(schema.kpis)
      .where(sql`${schema.kpis.id} = ${needleRaw} or lower(${schema.kpis.nameEn}) like ${"%" + needle + "%"}`)
      .limit(1);
    if (kpi?.ownerUserId) {
      return {
        role: "owner",
        userId: kpi.ownerUserId,
        source: { resource_type: "kpi", resource_id: kpi.id, title: kpi.nameEn, excerpt: (kpi.methodologyEn ?? "").slice(0, 200) },
        item: { type: "indicator", id: kpi.id },
      };
    }
    const [ci] = await db
      .select()
      .from(schema.councilIndicators)
      .where(sql`lower(${schema.councilIndicators.code}) = ${needle} or ${schema.councilIndicators.id} = ${needleRaw} or lower(${schema.councilIndicators.nameEn}) like ${"%" + needle + "%"}`)
      .limit(1);
    if (ci) {
      return {
        role: "owner",
        userId: ci.responsibleUserId,
        source: { resource_type: "council_indicator", resource_id: ci.id, title: `${ci.code ?? ""} ${ci.nameEn}`.trim(), excerpt: (ci.definitionEn ?? "").slice(0, 200) },
        item: { type: "indicator", id: ci.id },
      };
    }
    const [ind] = await db
      .select()
      .from(schema.indicators)
      .where(sql`lower(${schema.indicators.code}) = ${needle} or ${schema.indicators.id} = ${needleRaw} or lower(${schema.indicators.nameEn}) like ${"%" + needle + "%"}`)
      .limit(1);
    if (!ind || ind.classificationLevel > ctx.user.clearanceLevel) return null;
    const unit = await unitHead(ind.departmentId);
    return {
      role: "department_owner",
      userId: unit?.headUserId ?? null,
      unitFallback: unit ? { nameEn: unit.nameEn, nameAr: unit.nameAr, headNameEn: unit.headNameEn, headTitleEn: unit.headTitleEn } : null,
      source: { resource_type: "indicator", resource_id: ind.id, title: ind.nameEn, excerpt: (ind.definitionEn ?? "").slice(0, 200) },
      item: { type: "indicator", id: ind.id },
    };
  }

  if (itemType === "lesson") {
    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(sql`${schema.lessons.id} = ${needleRaw} or lower(${schema.lessons.titleEn}) like ${"%" + needle + "%"}`)
      .limit(1);
    if (!lesson || lesson.classificationLevel > ctx.user.clearanceLevel) return null;
    return {
      role: "author",
      userId: lesson.authorId,
      source: { resource_type: "lesson", resource_id: lesson.id, title: lesson.titleEn, excerpt: (lesson.learningEn ?? "").slice(0, 200) },
      item: { type: "lesson", id: lesson.id },
    };
  }
  return null;
}

function describeCard(card: PersonCard, role: string): string {
  const lines: string[] = [];
  lines.push(`${role.replace(/_/g, " ").toUpperCase()}: ${card.nameEn} (${card.nameAr})`);
  if (card.positionEn) lines.push(`Position: ${card.positionEn}`);
  if (card.breadcrumb.length) lines.push(`Unit: ${card.breadcrumb.map((c) => c.nameEn).join(" > ")}`);
  if (card.expertise.length) lines.push(`Expertise: ${card.expertise.map((e) => e.nameEn).join(", ")}`);
  if (card.availability) lines.push(`Availability: ${card.availability}`);
  lines.push(`Email: ${card.email}`);
  if (card.backupOwner) {
    lines.push(`Backup owner (HR${card.backupOwner.forItem ? ", for this item" : ""}): ${card.backupOwner.nameEn}`);
  }
  if (card.delegate) {
    const range = [card.delegate.from ? `from ${card.delegate.from}` : null, card.delegate.to ? `to ${card.delegate.to}` : null].filter(Boolean).join(" ");
    lines.push(`Delegate for messages: ${card.delegate.nameEn}${range ? ` (${range})` : ""}`);
  }
  if (card.links.profile) lines.push(`Profile: ${card.links.profile}`);
  return lines.join("\n");
}

export async function toolGetOwner(ctx: ToolContext, input: { item_type?: string; item?: string }): Promise<string> {
  const itemType = (input.item_type ?? "").trim().toLowerCase();
  if (!(ITEM_TYPES as readonly string[]).includes(itemType)) {
    return `Unknown item_type. Use one of: ${ITEM_TYPES.join(", ")}.`;
  }
  const resolved = await resolveItem(ctx, itemType, input.item ?? "");
  if (!resolved) return "Item not found (or not visible to you). Try its code, id or part of its title.";
  const n = ctx.state.addSource({
    resource_type: resolved.source.resource_type,
    resource_id: resolved.source.resource_id,
    title: resolved.source.title,
    page: null,
    excerpt: resolved.source.excerpt,
  });
  const head = `[${n}] ${resolved.source.title}`;
  if (resolved.userId) {
    const card = await getPersonCard(ctx.user, resolved.userId, resolved.item);
    if (card) return `${head}\n${describeCard(card, resolved.role)}`;
  }
  if (resolved.unitFallback) {
    const u = resolved.unitFallback;
    return `${head}\n${resolved.role.replace(/_/g, " ").toUpperCase()}: the ${u.nameEn} (${u.nameAr})${u.headNameEn ? `, headed by ${u.headNameEn}${u.headTitleEn ? `, ${u.headTitleEn}` : ""}` : ""}. No EnviroAI account is linked to the head yet.`;
  }
  return `${head}\nNo owner is recorded for this item yet.`;
}

const mod: ToolModule = {
  definitions: [
    {
      name: "get_owner",
      description:
        "Who owns an item (a project, initiative, outcome or target of the strategy, a Programme Strategy node, a document, study or policy, an indicator, an organisation unit, or a lesson) with the person-card facts: role, position, unit, expertise, availability, email, the HR backup owner and the messaging delegate. Never returns messages.",
      input_schema: {
        type: "object",
        properties: {
          item_type: { type: "string", enum: [...ITEM_TYPES], description: "the kind of item" },
          item: { type: "string", description: "the item's code, id, or part of its English title" },
        },
        required: ["item_type", "item"],
      },
    },
  ],
  portal: { get_owner: "home" },
  run: async (ctx, name, input) => {
    if (name !== "get_owner") return null;
    return toolGetOwner(ctx, input as { item_type?: string; item?: string });
  },
};

export default mod;
