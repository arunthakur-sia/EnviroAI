/* eslint-disable no-console */
// CR08 6: inspects the seeded data the handover seed builds on (statistics
// department members, external experts on projects, the CR05 handovers, the
// game rules, the knowledge type terms). Read-only.
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { eq, isNull, ne, inArray } = await import("drizzle-orm");
  const units = await db.select().from(schema.orgUnits);
  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));
  const roles = await db.select().from(schema.roles);
  const roleName = new Map(roles.map((r) => [r.id, r.nameEn]));
  const unitCode = new Map(units.map((u) => [u.id, u.code]));
  console.log("units:", units.length);
  for (const u of users) {
    console.log(`user ${u.email} | ${u.nameEn} | ${roleName.get(u.roleId)} | ${unitCode.get(u.departmentId ?? "") ?? "-"}`);
  }
  const heads = units.filter((u) => u.headUserId).map((u) => `${u.code}:${users.find((x) => x.id === u.headUserId)?.email}`);
  console.log("heads:", heads.join(", "));

  const externals = await db.select().from(schema.experts).where(ne(schema.experts.type, "npc_employee"));
  console.log("external experts:", externals.length);
  const stake = await db.select().from(schema.nodeStakeholders);
  const nodes = await db.select().from(schema.strategyNodes);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const e of externals.slice(0, 40)) {
    const rows = stake.filter((s) => s.expertId === e.id);
    console.log(`  ${e.id} ${e.nameEn} | ${e.type} | ${e.organisationEn ?? ""} | ${e.email ?? ""} | nodes=${rows.map((r) => `${nodeById.get(r.nodeId)?.code ?? r.nodeId}(${r.role},${r.nodeKind})`).join(",")}`);
  }
  const projects = nodes.filter((n) => n.nodeType === "project");
  console.log("projects:", projects.length, "with owner:", projects.filter((p) => p.ownerUserId).length);
  const ownerRoles = stake.filter((s) => s.role === "owner" && s.userId);
  console.log("owner stakeholders:", ownerRoles.length);

  const handovers = await db.select().from(schema.handovers);
  for (const h of handovers) {
    const items = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, h.id));
    console.log(`handover ${h.id} user=${users.find((u) => u.id === h.userId)?.email} kind=${h.kind} status=${h.status} pct=${h.completionPct} due=${h.dueDate} succ=${users.find((u) => u.id === h.successorDefaultUserId)?.email} items=${items.length} personKind=${h.personKind} lwd=${h.lastWorkingDay}`);
  }
  const interviews = await db.select().from(schema.handoverInterviews);
  const paths = await db.select().from(schema.handoverLearningPaths);
  console.log("interviews:", interviews.length, "paths:", paths.length);

  // CR08 6: nothing the successor reads may carry a raw enum or a summary that
  // quotes the interview twice
  const roleItems = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.category, "stakeholder_role"));
  const rawTitles = roleItems.filter((i) => /^(sponsor|owner|manager|team|expert|external_partner): /.test(i.title));
  console.log("stakeholder_role items:", roleItems.length, "with a raw role token:", rawTitles.length);
  console.log("  sample titles:", roleItems.slice(0, 3).map((i) => i.title).join(" | "));
  for (const p of paths) {
    const mods = JSON.parse(p.modulesJson) as { topic: string; summaryEn: string; summaryAr: string }[];
    const bad = mods.filter((m) => /\bInterview \(\d{4}-/.test(m.summaryEn) || /^(sponsor|owner|manager|team|expert|external_partner): /m.test(m.summaryEn));
    console.log(`  path ${p.id}: ${mods.length} modules, ${bad.length} with a stale summary`);
    if (mods[0]) console.log("    module 1 EN:", mods[0].summaryEn.slice(0, 260));
    if (mods[0]) console.log("    module 1 AR:", mods[0].summaryAr.slice(0, 260));
  }

  const rules = await db.select().from(schema.gameRules);
  console.log("rules:", rules.map((r) => `${r.eventType}=${r.points}`).join(", "));

  const dims = await db.select().from(schema.taxonomyDimensions);
  const terms = await db.select().from(schema.taxonomyTerms);
  const kt = dims.find((d) => d.code === "knowledge_type");
  console.log("knowledge types:", terms.filter((t) => t.dimensionId === kt?.id).map((t) => t.code).join(", "));

  const statsUnit = units.find((u) => u.code === "SOA" || u.code === "NDA" || u.code === "SSD");
  console.log("stats-ish units:", units.filter((u) => /stat|إحصاء/i.test(u.nameEn + u.nameAr)).map((u) => `${u.code} ${u.nameEn} head=${users.find((x) => x.id === u.headUserId)?.email ?? "-"}`).join(" | "));
  void statsUnit;
  const statuses = await db.select().from(schema.employeeStatus);
  console.log("employee statuses:", statuses.map((s) => `${users.find((u) => u.id === s.userId)?.email}=${s.status}`).join(", "));
  const docs = await db.select({ id: schema.documents.id, owner: schema.documents.ownerUserId, dept: schema.documents.departmentId, status: schema.documents.status }).from(schema.documents).where(isNull(schema.documents.deletedAt));
  const byOwner = new Map<string, number>();
  for (const d of docs) if (d.owner) byOwner.set(d.owner, (byOwner.get(d.owner) ?? 0) + 1);
  console.log("docs by owner:", [...byOwner.entries()].map(([k, v]) => `${users.find((u) => u.id === k)?.email}=${v}`).join(", "));
  const lessons = await db.select({ id: schema.lessons.id, author: schema.lessons.authorId, category: schema.lessons.category }).from(schema.lessons);
  const byAuthor = new Map<string, number>();
  for (const l of lessons) byAuthor.set(l.author, (byAuthor.get(l.author) ?? 0) + 1);
  console.log("lessons by author:", [...byAuthor.entries()].map(([k, v]) => `${users.find((u) => u.id === k)?.email}=${v}`).join(", "));
  const communities = await db.select().from(schema.communities);
  console.log("communities:", communities.map((c) => `${c.nameEn} lead=${users.find((u) => u.id === c.leadUserId)?.email}`).join(", "));
  const reqs = await db.select().from(schema.expertRequests);
  console.log("expert requests:", reqs.length, "open:", reqs.filter((r) => r.status === "open").length);
  const kpis = await db.select({ owner: schema.kpis.ownerUserId }).from(schema.kpis);
  console.log("kpis with owner:", kpis.filter((k) => k.owner).length);
  const ci = await db.select({ r: schema.councilIndicators.responsibleUserId }).from(schema.councilIndicators);
  console.log("council indicators with responsible:", ci.filter((c) => c.r).length);
  const members = await db.select().from(schema.orgUnitMembers);
  console.log("org unit members:", members.length, "roles:", [...new Set(members.map((m) => m.roleInUnit))].join(","));
  const links = await db.select().from(schema.documentUnitLinks);
  console.log("document unit links (policies):", links.length);
  const councilNodes = await db.select().from(schema.councilNodes);
  console.log("council nodes with owner user:", councilNodes.filter((c) => c.ownerUserId).length);
  const eps = await db.select({ id: schema.podcastEpisodes.id, scope: schema.podcastEpisodes.sourceScopeJson }).from(schema.podcastEpisodes);
  console.log("episodes:", eps.length);
  const settingsRows = await db.select().from(schema.settings).where(inArray(schema.settings.key, ["ai_settings", "feature_flags"]));
  console.log("settings:", settingsRows.map((s) => `${s.key}=${s.valueJson.slice(0, 120)}`).join(" | "));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
