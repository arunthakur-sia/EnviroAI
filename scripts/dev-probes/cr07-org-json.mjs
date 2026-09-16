import { readFile } from "node:fs/promises";
const j = JSON.parse(await readFile("sources/org/org-structure.json", "utf8"));
console.log("units:", j.units.length, "| authority:", j.authority);
const byLevel = {};
for (const u of j.units) byLevel[u.level] = (byLevel[u.level] || 0) + 1;
console.log("levels:", JSON.stringify(byLevel));
const withHead = j.units.filter((u) => u.head_name_en);
console.log("units with a published head:", withHead.length);
const noMandate = j.units.filter((u) => !u.mandate_en || u.mandate_en.length < 40);
console.log("units without a mandate:", noMandate.map((u) => u.code).join(", ") || "none");
console.log("\n-- sample rows --");
for (const u of j.units.slice(0, 4)) {
  console.log(
    `${u.code} [${u.level}] parent=${u.parent_code}\n  en: ${u.name_en}\n  ar: ${u.name_ar}\n  head: ${u.head_name_en || "-"} / ${u.head_name_ar || "-"} (${u.head_title_en || "-"})\n  mandate_en chars: ${(u.mandate_en || "").length}, mandate_ar chars: ${(u.mandate_ar || "").length}`
  );
}
console.log("\n-- heads --");
for (const u of withHead) console.log(`  ${u.code.padEnd(4)} ${u.head_title_en || "?"} | ${u.head_name_en} | ${u.head_name_ar}`);
console.log("\n-- parents --");
console.log(j.units.map((u) => `${u.code}<-${u.parent_code}`).join("  "));
