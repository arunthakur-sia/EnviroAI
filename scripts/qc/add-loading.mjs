/* eslint-disable no-console */
// CR08 Phase B: give every app route a loading.tsx so the first paint is the
// page's shape, never a blank column. Existing files are never overwritten.
//   node scripts/qc/add-loading.mjs [--dry]
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const dry = process.argv.includes("--dry");
const BASE = path.join(process.cwd(), "src", "app", "[locale]", "(app)");

/** route -> the shape its page actually has */
const SHAPES = {
  add: ["panel", 5],
  ask: ["list", 6],
  "council-strategy": ["canvas", 3],
  foresight: ["cards", 6],
  hr: ["cards", 6],
  inbox: ["list", 7],
  indices: ["cards", 8],
  leaderboard: ["list", 8],
  lessons: ["cards", 8],
  organisation: ["canvas", 3],
  podcast: ["cards", 6],
  processes: ["canvas", 3],
  profile: ["panel", 5],
  search: ["list", 8],
  settings: ["panel", 6],
  statistics: ["cards", 8],
  strategy: ["canvas", 3],
  trends: ["canvas", 3],
  vault: ["canvas", 3],
};

let made = 0;
for (const [route, [shape, rows]] of Object.entries(SHAPES)) {
  const dir = path.join(BASE, route);
  if (!existsSync(path.join(dir, "page.tsx"))) {
    console.log(`skip ${route} (no page.tsx)`);
    continue;
  }
  const file = path.join(dir, "loading.tsx");
  if (existsSync(file)) {
    console.log(`keep ${route} (has its own)`);
    continue;
  }
  const body = `// CR08 Phase B: the shape of this page while its data loads.
import { PageSkeleton } from "@/components/nexus/PageSkeleton";

export default function Loading() {
  return <PageSkeleton shape="${shape}" rows={${rows}} />;
}
`;
  if (!dry) writeFileSync(file, body, "utf8");
  made++;
  console.log(`${dry ? "would add" : "added"} ${route}/loading.tsx (${shape})`);
}
console.log(`${made} files`);
