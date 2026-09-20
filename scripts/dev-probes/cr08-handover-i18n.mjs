// CR08 6: every t("...") key the handover UI uses must exist in en.json
// under its namespace. Static keys only; template keys are listed by hand.
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const files = [
  "src/app/[locale]/(app)/handover/_components/bits.tsx",
  "src/app/[locale]/(app)/handover/_components/InterviewPanel.tsx",
  "src/app/[locale]/(app)/handover/_components/Checklist.tsx",
  "src/app/[locale]/(app)/handover/_components/AddToHandoverPanel.tsx",
  "src/app/[locale]/(app)/handover/mine/MyHandoverClient.tsx",
  "src/app/[locale]/(app)/handover/mine/page.tsx",
  "src/app/[locale]/(app)/handover/page.tsx",
  "src/app/[locale]/(app)/handover/[id]/RecipientPathClient.tsx",
  "src/app/[locale]/(app)/handover/HandoverBannerClient.tsx",
  "src/app/[locale]/(app)/hr/handovers/HandoversListClient.tsx",
  "src/app/[locale]/(app)/hr/handovers/StartHandoverDialog.tsx",
  "src/app/[locale]/(app)/hr/handovers/[id]/HandoverAdminClient.tsx",
  "src/app/[locale]/(auth)/handover/access/[token]/page.tsx",
  "src/app/[locale]/(auth)/handover/access/[token]/TokenWorkspaceClient.tsx",
];
const en = JSON.parse((await readFile(path.join(root, "messages", "en.json"), "utf8")).replace(/^﻿/, ""));
const has = (key) => key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), en) !== undefined;

let problems = 0;
for (const file of files) {
  const src = await readFile(path.join(root, file), "utf8");
  // one scope per component function: each declares its own translators
  const chunks = src.split(/(?=^(?:export )?(?:async )?function \w+)/m);
  for (const chunk of chunks) {
    const ns = {};
    for (const m of chunk.matchAll(/const (\w+) = (?:use|get)Translations\("([^"]+)"\)/g)) ns[m[1]] = m[2];
    for (const m of chunk.matchAll(/\b(t|th|tc|tl)\("([^"`$]+)"/g)) {
      const space = ns[m[1]];
      if (!space) continue;
      const key = `${space}.${m[2]}`;
      if (!has(key)) {
        console.log(`${file}: missing ${key}`);
        problems++;
      }
    }
  }
}
console.log(problems ? `${problems} missing keys` : "all static keys present");
process.exitCode = problems ? 1 : 0;
