/* eslint-disable no-console */
// CR05 4.3: fetch international index data (direct publisher files plus the
// research-pass extractions), store observations with sources, write the raw
// manifest and data/indices-report.md. Skippable with SKIP_INDICES_FETCH=1
// (cached raw files and research extractions are still loaded).
// Usage: npx tsx scripts/fetch-indices.ts [--offline] [--only=code,code]
// (CR08 4.1: --only restricts the run to the listed index codes)
import { loadEnv } from "../src/lib/load-env";
loadEnv();

async function main() {
  const { runIndicesFetch } = await import("../src/server/indices/fetcher");
  const offline = process.argv.includes("--offline");
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const report = await runIndicesFetch({
    download: !offline,
    codes: only ? only.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
  });
  for (const r of report.perIndex) {
    console.log(
      `${r.code.padEnd(18)} obs=${String(r.observations).padStart(5)} (+${r.inserted}) countries=${r.countries} pillars=${r.pillarValues} qatar=${
        r.qatarYears.length
          ? `${r.qatarYears.length}y ${r.qatarYears[0]}-${r.qatarYears[r.qatarYears.length - 1]}`
          : "none"
      }`
    );
  }
  console.log(
    only
      ? "wrote data/indices-report.md (partial run: manifest and refresh stamp untouched)"
      : "wrote sources/indices/manifest.json and data/indices-report.md"
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
