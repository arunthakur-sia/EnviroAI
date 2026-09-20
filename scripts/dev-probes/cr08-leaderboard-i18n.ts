/* eslint-disable no-console */
// CR08 7: parity check for the leaderboard's own namespaces after the merge
// (the shared merge script reports every fragment; this one answers only for
// leaderboard, settings.gamificationTab, profile.level* and home.levelTip).
import fs from "node:fs";
import path from "node:path";

const read = (f: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", f), "utf8").replace(/^﻿/, ""));

function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keyPaths(v as Record<string, unknown>, p));
    else out.push(p);
  }
  return out;
}

const en = read("en.json");
const ar = read("ar.json");
const mine = (k: string) =>
  k.startsWith("leaderboard.") ||
  k.startsWith("settings.gamificationTab.") ||
  k.startsWith("profile.level") ||
  k === "profile.nextLevel" ||
  k === "profile.topLevel" ||
  k === "home.levelTip";
const enKeys = keyPaths(en).filter(mine);
const arKeys = new Set(keyPaths(ar).filter(mine));
const missing = enKeys.filter((k) => !arKeys.has(k));
const extra = [...arKeys].filter((k) => !enKeys.includes(k));
console.log(`leaderboard namespaces: ${enKeys.length} en keys, ${arKeys.size} ar keys`);
if (missing.length) console.log("missing in ar:", missing.join(", "));
if (extra.length) console.log("missing in en:", extra.join(", "));
const dash = [...enKeys, ...arKeys].filter((k) => {
  const get = (o: Record<string, unknown>) => k.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], o);
  const text = `${String(get(en))}\n${String(get(ar))}`;
  return text.includes(String.fromCharCode(0x2014)) || text.includes(String.fromCharCode(0x2013));
});
if (dash.length) console.log("dashes in:", dash.join(", "));
console.log(missing.length || extra.length || dash.length ? "PARITY PROBLEM" : "parity clean for the leaderboard keys");
