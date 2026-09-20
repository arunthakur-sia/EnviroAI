/* eslint-disable no-console */
// CR08 10.1 dev probe: the free text fields the panel prints as they are, to
// see whether the Arabic page ever shows an English token (KPI units, the
// systems, the interface cadences).
//   npx tsx scripts/dev-probes/cr08-processes-data.ts
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { rawClient } = await import("../../src/server/db/client");
  const kpis = await rawClient.execute("select code, kpis_json from processes where kpis_json is not null and kpis_json != '[]'");
  const units = new Map<string, number>();
  for (const row of kpis.rows) {
    try {
      for (const k of JSON.parse(String(row.kpis_json)) as { unit?: string | null }[]) {
        const u = (k.unit ?? "").trim();
        if (u) units.set(u, (units.get(u) ?? 0) + 1);
      }
    } catch {
      console.log(`  unparsable kpis_json on ${row.code}`);
    }
  }
  console.log("kpi units:", [...units.entries()].map(([u, n]) => `${u} x${n}`).join(", ") || "none");

  const sys = await rawClient.execute("select systems_json from processes where systems_json is not null and systems_json != '[]'");
  const names = new Set<string>();
  for (const row of sys.rows) {
    try {
      for (const s of JSON.parse(String(row.systems_json)) as { nameEn?: string; nameAr?: string }[]) {
        names.add(`${s.nameEn ?? "-"} | ${s.nameAr ?? "-"}`);
      }
    } catch {
      /* ignore */
    }
  }
  console.log("systems:", [...names].slice(0, 12).join("  //  "));

  const cad = await rawClient.execute("select cadence, count(*) n from unit_interfaces group by cadence");
  console.log("interface cadences:", cad.rows.map((r) => `${r.cadence} x${r.n}`).join(", "));

  const ext = await rawClient.execute("select cadence, count(*) n from entity_interfaces group by cadence");
  console.log("entity cadences:", ext.rows.map((r) => `${r.cadence} x${r.n}`).join(", "));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
