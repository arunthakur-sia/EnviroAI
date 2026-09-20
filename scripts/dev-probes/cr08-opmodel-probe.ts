/* eslint-disable no-console */
// CR08 10 dev probe: prints a summary of every operating model read model for
// the Super Admin and for the Reader (so visibility differences show), then
// calls the API on the shared dev server with a logged-in admin session.
//   npx tsx scripts/dev-probes/cr08-opmodel-probe.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { eq } = await import("drizzle-orm");
  const { getUserById } = await import("../../src/server/auth/session");
  const svc = await import("../../src/server/services/operating-model");

  for (const email of ["admin@npc.qa", "reader@npc.qa"]) {
    const [row] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const user = row ? await getUserById(row.id) : null;
    if (!user) {
      console.log(`${email}: no such user`);
      continue;
    }
    console.log(`\n==== ${email} (${user.role.nameEn}, unit ${user.department?.code ?? "-"}, clearance ${user.clearanceLevel})`);

    const map = await svc.getProcessMap(user);
    console.log(`process map: totals ${JSON.stringify(map.totals)}, canEdit=${map.canEdit}`);
    for (const l0 of map.chain) {
      console.log(`  ${l0.code} ${l0.nameEn} [${l0.ownerUnit?.code ?? "-"}] children=${l0.children.length} procedures=${l0.counts.procedures} interfaces=${l0.counts.interfaces}`);
      for (const l1 of l0.children) {
        console.log(`     ${l1.code} ${l1.nameEn} [${l1.ownerUnit?.code ?? "-"}] raci=${l1.counts.raci} policies=${l1.counts.policies} sops=${l1.counts.sops} L2=${l1.children.map((c) => c.code).join(",") || "-"}`);
      }
    }
    console.log(`by unit: ${map.byUnit.map((u) => `${u.unit.code}(${u.processes.length}p/${Object.values(u.policies).flat().length}d)`).join(" ")}`);
    console.log(`by policy type: ${map.byPolicyType.map((t) => `${t.tab}=${t.documents.length}`).join(" ")}`);

    const p = await svc.getProcess(user, "P4.1");
    if (p) {
      console.log(`process P4.1: owner ${p.ownerUnit?.code}, ${p.steps.length} steps, ${p.inputs.length} inputs, ${p.outputs.length} outputs, ${p.systems.length} systems, ${p.kpis.length} kpis, ${p.policies.length} policies, ${p.sops.length} sops, raci ${p.raci.map((r) => `${r.role}=${r.unit.code}`).join(",")}, interfaces ${p.interfaces.internal.length}+${p.interfaces.external.length}, canEdit=${p.canEdit}`);
      console.log(`  step 1: ${p.steps[0]?.textEn} [${p.steps[0]?.roleUnit?.code}] via ${p.steps[0]?.system}`);
    }
    const p831 = await svc.getProcess(user, "P8.3.1");
    console.log(`process P8.3.1: sops visible=${p831?.sops.length ?? "-"} (unit-only IFS procedure)`);

    const model = await svc.getOperatingModel(user);
    console.log(`operating model: illustrative=${model.isIllustrative} canEdit=${model.canEdit}`);
    console.log(`  principles: ${model.principles.map((x) => x.titleEn).join(" | ")}`);
    const byId = new Map(model.governance.bodies.map((b) => [b.id, b]));
    console.log(`  governance: ${model.governance.bodies.map((b) => `${b.nameEn} (${b.source}, ${b.cadence ?? "-"}, ${b.decisionsEn.length} decisions, escalates to ${b.escalatesToId ? byId.get(b.escalatesToId)?.nameEn : "none"})`).join(" | ")}`);
    console.log(`  connectors: ${model.governance.connectors.map((c) => `${byId.get(c.fromId)?.nameEn} ${c.kind} ${byId.get(c.toId)?.nameEn}`).join(" | ")}`);
    console.log(`  raci: ${model.raci.processes.length} processes x ${model.raci.units.length} units, ${model.raci.cells.length} cells`);
    const kinds = new Map<string, number>();
    for (const e of model.calendar.events) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
    console.log(`  calendar ${model.calendar.year}: ${model.calendar.events.length} occurrences: ${[...kinds.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);
    console.log(`    first: ${model.calendar.events.slice(0, 4).map((e) => `${e.dateFrom} ${e.titleEn}${e.linked ? ` -> ${e.linked.type}:${e.linked.code ?? e.linked.titleEn}` : ""}`).join(" | ")}`);
    console.log(`  interfaces: ${model.interfaces.internal.length} internal across ${model.interfaces.units.length} units (${model.interfaces.matrix.length} matrix cells), ${model.interfaces.external.length} external, ${model.interfaces.changeRequests.length} change requests visible`);
    console.log(`    internal focal coverage: ${model.interfaces.internal.filter((i) => i.focalFrom && i.focalTo).length} with both focals, canPropose on ${model.interfaces.internal.filter((i) => i.canPropose).length}`);
    console.log(`    external: ${model.interfaces.external.map((e) => `${e.entity.shortNameEn}(${e.processes.map((x) => x.code).join("/")}, focal ${e.focalNpc?.nameEn ?? "-"})`).join(" ")}`);
    console.log(`  kpis: ${model.kpis.map((k) => `${k.code}=${k.latest?.value ?? "-"}${k.unit === "percent" ? "%" : ""} (target ${k.target}, ${k.rag}, trend ${k.trend}, ${k.sourceKind}, ${k.series.length} points)`).join(" | ")}`);

    const ifaces = await svc.getUnitInterfaces(user, model.interfaces.units.find((u) => u.code === "SOA")?.id ?? "");
    console.log(`  unit interfaces SOA: gives ${ifaces?.gives.length ?? "-"}, receives ${ifaces?.receives.length ?? "-"}, external ${ifaces?.external.length ?? "-"}`);
  }

  /* the API on the shared dev server */
  const login = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  console.log(`\n==== API as admin (login ${login.status})`);
  for (const path of ["/api/v1/processes?view=process", "/api/v1/processes/P4.1", "/api/v1/operating-model?section=kpis", "/api/v1/operating-model/interfaces?unit=SOA", "/api/v1/operating-model/calendar?year=2026"]) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
    const text = await res.text();
    console.log(`${res.status} ${path} ${text.length} bytes: ${text.slice(0, 140).replace(/\s+/g, " ")}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
