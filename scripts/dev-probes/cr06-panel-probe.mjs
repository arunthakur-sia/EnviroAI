const base = "http://localhost:3000";
async function main() {
  const login = await fetch(base + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@npc.qa", password: "Nexus!2026" }) });
  const cookies = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  const res = await fetch(base + "/en/strategy?o=o1", { headers: { cookie: cookies } });
  const html = await res.text();
  for (const id of ["outcome-stakeholders", "outcome-dept-owner", "outcome-lead-entities", "outcome-experts", "outcome-leaders", "direct-chip", "panel-signals-link", "outcome-lead-chip", "set-owner-toggle", "outcome-add-stakeholder"]) {
    console.log(id, html.includes('data-testid="' + id + '"') ? "OK" : "MISSING");
  }
  console.log("old expert chip pattern gone:", !html.includes("extras.experts"));
  const ar = await fetch(base + "/ar/strategy?o=o1", { headers: { cookie: cookies } });
  const arHtml = await ar.text();
  console.log("AR title:", arHtml.includes("أصحاب المصلحة") ? "OK" : "MISSING");
}
main().catch(e => { console.error(e); process.exit(1); });
