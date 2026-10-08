/* eslint-disable no-console */
// Opens the Population indicator page in a real browser and inspects the chart DOM.
import { chromium } from "playwright";
import { createClient } from "@libsql/client";

const BASE = "http://localhost:3000";

async function main() {
  const db = createClient({ url: `file:${process.cwd().replace(/\\/g, "/")}/data/nexus.db` });
  const ind = await db.execute("select id from indicators where code = 'pop_total' limit 1");
  const id = String(ind.rows[0].id);
  const vals = await db.execute({
    sql: "select period, value, dimension_key from indicator_values where indicator_id = ? order by period desc limit 5",
    args: [id],
  });
  console.log("DB values sample:", vals.rows);
  db.close();

  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));

  // API login shares the cookie jar with the page context
  const loginRes = await page.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: "admin@enviroai.demo", password: "EnviroAI!2026" },
  });
  console.log("api login:", loginRes.status());

  await page.goto(`${BASE}/en/statistics/${id}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const surface = document.querySelector(".recharts-surface");
    const curve = document.querySelectorAll(".recharts-line-curve");
    const dots = document.querySelectorAll(".recharts-line .recharts-curve");
    const yTicks = document.querySelectorAll(".recharts-yAxis .recharts-cartesian-axis-tick");
    const xTicks = document.querySelectorAll(".recharts-xAxis .recharts-cartesian-axis-tick");
    const paths = [...document.querySelectorAll(".recharts-line path")].map((p) => ({
      cls: p.getAttribute("class"),
      d: (p.getAttribute("d") || "").slice(0, 120),
      stroke: p.getAttribute("stroke"),
      strokeDasharray: p.getAttribute("stroke-dasharray"),
      opacity: p.getAttribute("opacity"),
    }));
    return {
      hasSurface: Boolean(surface),
      surfaceSize: surface ? `${surface.getAttribute("width")}x${surface.getAttribute("height")}` : null,
      curveCount: curve.length,
      dotsCount: dots.length,
      yTickCount: yTicks.length,
      xTickCount: xTicks.length,
      paths,
      lineWrappers: document.querySelectorAll(".recharts-line").length,
    };
  });
  console.log("DOM:", JSON.stringify(info, null, 2));
  console.log("Console errors/warnings:", errors.slice(0, 12));
  await page.screenshot({ path: "data/screenshots/debug-indicator.png" });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
