/* eslint-disable no-console */
// CR07 0.1: writes sources/org/org-structure.json from the illustrative
// Programme Office structure in scripts/data/org-structure-ksa.ts. No network
// access and no scraping: the structure is part of the demo tenant content.
// Skippable with SKIP_CR07_FETCH=1.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ORG_STRUCTURE_KSA } from "./data/org-structure-ksa";

async function main() {
  if (process.env.SKIP_CR07_FETCH === "1") {
    console.log("SKIP_CR07_FETCH=1: reusing whatever is already under sources/");
    return;
  }
  const dir = path.join(process.cwd(), "sources", "org");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "org-structure.json"),
    JSON.stringify(ORG_STRUCTURE_KSA, null, 2),
    "utf8"
  );
  console.log(`org: org-structure.json written with ${ORG_STRUCTURE_KSA.units.length} units`);
}

main().catch((e) => {
  console.error("fetch-cr07-sources crashed:", e);
  process.exit(0); // never block the run
});
