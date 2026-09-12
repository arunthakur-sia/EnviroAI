// CR02 7.4: look for NPC's official secondary colours on npc.qa.
// Public read-only fetch through the corporate proxy (TLS relaxed, DECISIONS 8).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const colors = new Map();
function collect(css) {
  for (const m of css.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    const c = m[0].toLowerCase();
    colors.set(c, (colors.get(c) ?? 0) + 1);
  }
}
try {
  const res = await fetch("https://www.npc.qa", { redirect: "follow" });
  const html = await res.text();
  collect(html);
  const sheets = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map(
    (m) => m[1]
  );
  for (const href of sheets.slice(0, 4)) {
    const url = href.startsWith("http") ? href : new URL(href, "https://www.npc.qa").href;
    try {
      const cssRes = await fetch(url);
      collect(await cssRes.text());
    } catch (e) {
      console.log("stylesheet failed:", url, e.message);
    }
  }
  const sorted = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log("top colours:", sorted.map(([c, n]) => `${c}(${n})`).join(" "));
} catch (e) {
  console.log("npc.qa fetch failed:", e.message);
}
