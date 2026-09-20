/* eslint-disable no-console */
// CR08 5 (Reports UI agent): reads the error the dev server's 500 page
// carries (the __NEXT_DATA__ "err" field and any stack text), so a global
// compile failure caused elsewhere can be named.
//   npx tsx scripts/dev-probes/cr08-reports-ui-err.ts
const BASE = process.env.PROBE_BASE ?? "http://localhost:3000";

async function main() {
  const res = await fetch(`${BASE}/en/login`);
  const html = await res.text();
  console.log("status", res.status, "bytes", html.length);
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      console.log("page:", data.page);
      console.log("err:", JSON.stringify(data.err ?? data.props?.pageProps?.err ?? null, null, 2)?.slice(0, 3000));
    } catch (e) {
      console.log("could not parse __NEXT_DATA__", String(e));
    }
  } else {
    console.log("no __NEXT_DATA__");
  }
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const idx = text.search(/Error|error|Module not found|Cannot find/);
  console.log("text around the first error mention:", idx >= 0 ? text.slice(Math.max(0, idx - 200), idx + 800) : text.slice(0, 600));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

// a module, so BASE stays local to this probe
export {};
