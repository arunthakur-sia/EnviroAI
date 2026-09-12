// Loads Next's config exactly the way `next build` does, to expose the real error.
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const mod = req("next/dist/server/config.js");
const constants = req("next/dist/shared/lib/constants.js");
const loadConfig = mod.default?.default ?? mod.default ?? mod;
try {
  const cfg = await loadConfig(constants.PHASE_PRODUCTION_BUILD, process.cwd());
  console.log("config OK, keys:", Object.keys(cfg).length);
} catch (e) {
  console.error("CONFIG FAIL:", e?.message);
  console.error(e?.stack?.split("\n").slice(0, 12).join("\n"));
  let c = e?.cause;
  let d = 0;
  const list = Array.isArray(c) ? c : c ? [c] : [];
  for (const item of list) {
    console.error("cause[]:", (item?.message || String(item)).slice(0, 200));
  }
  c = list[0]?.cause;
  while (c && d < 6) {
    console.error("deep cause:", (c?.message || String(c)).slice(0, 200));
    c = c.cause;
    d++;
  }
}
