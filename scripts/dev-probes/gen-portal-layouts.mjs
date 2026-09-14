import fs from "node:fs";
import path from "node:path";
const base = "src/app/[locale]/(app)";
const portals = {
  home: "home",
  vault: "vault",
  strategy: "strategy",
  statistics: "statistics",
  indices: "indices",
  trends: "trends",
  ask: "ask",
  lessons: "lessons",
  podcast: "podcast",
  experts: "experts",
  settings: "settings",
};
for (const [dir, portal] of Object.entries(portals)) {
  const p = path.join(base, dir, "layout.tsx");
  if (fs.existsSync(p)) {
    console.log("exists, skip", p);
    continue;
  }
  const src =
    "// CR05 6.1: portal gate. A hidden portal's routes 404 for the user.\n" +
    'import { requirePortal } from "@/server/auth/portal";\n\n' +
    "export default async function PortalLayout({ children }: { children: React.ReactNode }) {\n" +
    `  await requirePortal("${portal}");\n` +
    "  return children;\n" +
    "}\n";
  fs.writeFileSync(p, src);
  console.log("wrote", p);
}
