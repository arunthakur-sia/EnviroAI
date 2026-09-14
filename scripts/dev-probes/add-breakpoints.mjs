// One-shot: insert drizzle statement-breakpoint markers into 0005_cr05.sql.
import fs from "node:fs";
const p = "src/server/db/migrations/0005_cr05.sql";
let t = fs.readFileSync(p, "utf8");
if (!t.includes("statement-breakpoint")) {
  t = t.replace(/;\r?\n/g, ";\n--> statement-breakpoint\n");
  t = t.replace(/\n--> statement-breakpoint\n$/, "\n");
  fs.writeFileSync(p, t);
}
console.log((t.match(/statement-breakpoint/g) || []).length, "breakpoints");
