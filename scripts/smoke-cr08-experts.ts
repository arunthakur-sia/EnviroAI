/* eslint-disable no-console */
// CR08 3 and 2.2: smoke checks for the Expert Network split (internal by
// unit, external with engagement facts, two labelled groups everywhere) and
// the Studies page. Wired into scripts/smoke.ts by the coordinator.
//   ctx.cookie is a Contributor session (analyst@npc.qa), ctx.adminCookie the
//   Super Admin, ctx.db a raw libsql client.
import type { Client } from "@libsql/client";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: Client };

type Card = {
  id: string;
  nameEn: string;
  kind: "internal" | "external";
  type: string;
  country: string | null;
  unitId: string | null;
  unitPath: { id: string }[];
  projectCount: number;
  engagementCount: number;
  lastEngagementYear: number | null;
  workedWithNpc: boolean;
  availability: string;
};
type Grouped = { internal: Card[]; external: Card[]; all: Card[] };
type StudyDoc = { id: string; typeCode: string | null; publishYear: number | null; illustrative: boolean; status: string };
type StudiesPage = {
  featured: StudyDoc | null;
  shelves: { year: number | null; docs: StudyDoc[] }[];
  facets: { types: { code: string }[]; topics: unknown[]; outcomes: unknown[]; years: { year: number | null }[] };
  total: number;
  totalAll: number;
};

async function getJson<T>(ctx: Ctx, cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetch(ctx.base + path, {
    ...init,
    headers: { ...((init.headers as Record<string, string>) ?? {}), cookie },
  });
  const json = (await res.json().catch(() => ({ data: null }))) as { data: T | null; error?: string | null };
  return { status: res.status, data: json.data, error: json.error };
}

async function getHtml(ctx: Ctx, cookie: string, path: string) {
  const res = await fetch(ctx.base + path, { headers: { cookie } });
  return { status: res.status, html: await res.text() };
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  /* ---- 3: the two registers ---- */
  const internal = await getJson<Card[]>(ctx, ctx.cookie, "/api/v1/experts?view=internal");
  const internalRows = internal.data ?? [];
  check(
    "internal experts list answers with NPC staff only",
    internal.status === 200 && internalRows.length >= 40 && internalRows.every((e) => e.kind === "internal"),
    `${internal.status}, ${internalRows.length}`
  );
  check(
    "every internal expert reaches its unit through the person's department",
    internalRows.length > 0 && internalRows.every((e) => e.unitId && e.unitPath.length >= 1)
  );
  check(
    "internal cards count project involvement from stakeholder and owner rows",
    internalRows.some((e) => e.projectCount > 0)
  );

  const external = await getJson<Card[]>(ctx, ctx.cookie, "/api/v1/experts?view=external");
  const externalRows = external.data ?? [];
  check(
    "external experts list answers with externals only",
    external.status === 200 && externalRows.length >= 45 && externalRows.every((e) => e.kind === "external"),
    `${external.status}, ${externalRows.length}`
  );
  check(
    "external experts carry a country and engagement facts",
    externalRows.filter((e) => e.country).length >= 40 && externalRows.some((e) => e.lastEngagementYear && e.engagementCount > 0)
  );
  const seededNames = ["Dr. Noora Al-Kuwari", "Eng. Fahad Al-Naimi", "Omar Nasser", "Dr. Pieter van der Berg"];
  check(
    "the CR08 seeded externals are present across the four types",
    seededNames.every((n) => externalRows.some((e) => e.nameEn === n)) &&
      ["government", "academic", "consultant", "international"].every((t) => externalRows.some((e) => e.type === t))
  );

  /* ---- 3: filters ---- */
  const academic = await getJson<Card[]>(ctx, ctx.cookie, "/api/v1/experts?view=external&type=academic");
  check(
    "external type filter narrows to academia",
    (academic.data?.length ?? 0) >= 4 &&
      (academic.data?.length ?? 0) < externalRows.length &&
      (academic.data ?? []).every((e) => e.type === "academic"),
    `${academic.data?.length}`
  );
  const worked = await getJson<Card[]>(ctx, ctx.cookie, "/api/v1/experts?view=external&workedWith=1");
  check(
    "worked-with-NPC filter keeps only experts with engagements or project roles",
    (worked.data?.length ?? 0) > 0 && (worked.data ?? []).every((e) => e.workedWithNpc) && (worked.data?.length ?? 0) < externalRows.length,
    `${worked.data?.length} of ${externalRows.length}`
  );
  const qa = await getJson<Card[]>(ctx, ctx.cookie, "/api/v1/experts?view=external&country=QA&availability=available");
  check(
    "country and availability filters combine",
    (qa.data?.length ?? 0) > 0 && (qa.data ?? []).every((e) => e.country === "QA" && e.availability === "available"),
    `${qa.data?.length}`
  );
  const unitId = internalRows[0]?.unitId;
  const byUnit = await getJson<Card[]>(ctx, ctx.cookie, `/api/v1/experts?view=internal&unit=${unitId}`);
  check(
    "unit filter keeps one unit's people",
    Boolean(unitId) && (byUnit.data?.length ?? 0) > 0 && (byUnit.data ?? []).every((e) => e.unitId === unitId || e.unitPath.some((p) => p.id === unitId)),
    `${byUnit.data?.length}`
  );

  /* ---- 3: two labelled groups, never blended ---- */
  const grouped = await getJson<Grouped>(ctx, ctx.cookie, "/api/v1/experts?grouped=1&q=Al");
  const g = grouped.data;
  const ids = (list: Card[]) => new Set(list.map((e) => e.id));
  const disjoint = g ? [...ids(g.internal)].every((id) => !ids(g.external).has(id)) : false;
  check(
    "a search for an expert name returns internal and external groups separately",
    Boolean(g && g.internal.length > 0 && g.external.length > 0 && disjoint),
    `${g?.internal.length} internal, ${g?.external.length} external`
  );
  check(
    "the flat list is the internal group followed by the external group",
    Boolean(
      g &&
        g.all.length === g.internal.length + g.external.length &&
        g.all.slice(0, g.internal.length).every((e) => e.kind === "internal") &&
        g.all.slice(g.internal.length).every((e) => e.kind === "external")
    )
  );
  const named = await getJson<Grouped>(ctx, ctx.cookie, `/api/v1/experts?grouped=1&q=${encodeURIComponent("Noora Al-Kuwari")}`);
  check(
    "a seeded external found by semantic search lands in the external group only",
    Boolean(
      named.data &&
        named.data.external.some((e) => e.nameEn === "Dr. Noora Al-Kuwari") &&
        !named.data.internal.some((e) => e.nameEn === "Dr. Noora Al-Kuwari")
    ),
    `${named.data?.internal.length} internal, ${named.data?.external.length} external`
  );

  /* ---- 3: pages ---- */
  const extPage = await getHtml(ctx, ctx.adminCookie, "/en/experts?view=external");
  check(
    "external view offers Add external expert and the request action",
    extPage.status === 200 && extPage.html.includes('data-testid="add-external"') && extPage.html.includes('data-testid="request-expert"')
  );
  const intPage = await getHtml(ctx, ctx.adminCookie, "/en/experts?view=internal");
  check(
    "internal view groups by unit and never offers Add external expert",
    intPage.status === 200 && intPage.html.includes('data-testid="internal-groups"') && !intPage.html.includes('data-testid="add-external"')
  );
  const arPage = await getHtml(ctx, ctx.cookie, "/ar/experts?view=external");
  check("Arabic external view renders its title", arPage.status === 200 && arPage.html.includes("الخبراء الخارجيون"));
  const searchPage = await getHtml(ctx, ctx.cookie, `/en/search?q=${encodeURIComponent("Noora Al-Kuwari")}`);
  check(
    "search results render the labelled expert groups",
    searchPage.status === 200 && searchPage.html.includes('data-testid="expert-groups"') && searchPage.html.includes('data-testid="expert-group-external"')
  );

  /* ---- 2.2: studies ---- */
  const kt = await ctx.db.execute(
    "select t.code from taxonomy_terms t join taxonomy_dimensions d on d.id = t.dimension_id where d.code = 'knowledge_type' and t.code in ('study','research','evaluation')"
  );
  check("knowledge types study, research and evaluation exist", kt.rows.length === 3, kt.rows.map((r) => r.code).join(","));
  const seededStudies = await ctx.db.execute(
    "select d.id, (select count(*) from document_chunks c where c.document_id = d.id) as chunks from documents d where d.source_ref = 'cr08-illustrative' and d.deleted_at is null and d.status = 'verified'"
  );
  check(
    "eight illustrative studies seeded, verified, each with three or more chunks",
    seededStudies.rows.length >= 8 && seededStudies.rows.every((r) => Number(r.chunks) >= 3),
    `${seededStudies.rows.length} docs`
  );
  const studies = await getJson<StudiesPage>(ctx, ctx.cookie, "/api/v1/studies");
  const s = studies.data;
  check(
    "studies page data: featured study, year shelves and facets",
    Boolean(s && s.featured && s.featured.status === "verified" && s.shelves.length >= 3 && s.facets.types.length === 3 && s.facets.years.length >= 3 && s.totalAll >= 8),
    `${studies.status}, shelves ${s?.shelves.length}, types ${s?.facets.types.length}`
  );
  const research = await getJson<StudiesPage>(ctx, ctx.cookie, "/api/v1/studies?type=research");
  check(
    "studies type filter keeps research only",
    Boolean(research.data && research.data.total > 0 && research.data.shelves.every((sh) => sh.docs.every((d) => d.typeCode === "research")))
  );
  const y2026 = await getJson<StudiesPage>(ctx, ctx.cookie, "/api/v1/studies?year=2026&outcome=gov_excellence");
  check(
    "studies year and outcome filters combine into one shelf",
    Boolean(y2026.data && y2026.data.total > 0 && y2026.data.shelves.length === 1 && y2026.data.shelves[0].year === 2026)
  );
  const studiesPage = await getHtml(ctx, ctx.cookie, "/en/studies");
  check(
    "studies page renders the featured hero and a year shelf",
    studiesPage.status === 200 && studiesPage.html.includes('data-testid="featured-study"') && studiesPage.html.includes('data-testid="year-shelf"')
  );
  const uploadPage = await getHtml(ctx, ctx.adminCookie, "/en/vault/upload?type=study");
  check("upload flow opens with the study type requested", uploadPage.status === 200);

  /* ---- permissions ---- */
  const anon = await fetch(ctx.base + "/api/v1/experts");
  const anonStudies = await fetch(ctx.base + "/api/v1/studies");
  check("experts and studies APIs refuse an anonymous caller", anon.status === 401 && anonStudies.status === 401);
  const bad = await getJson(ctx, ctx.adminCookie, "/api/v1/experts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nameEn: "x" }),
  });
  check("creating an external expert validates its body", bad.status === 400);

  /* ---- Ask NPC tools ---- */
  try {
    const { runTool, AnalystState } = await import("../src/server/ai/analyst/tools");
    const { getUserById } = await import("../src/server/auth/session");
    const [analyst] = (await ctx.db.execute("select id from users where email = 'analyst@npc.qa'")).rows;
    const user = analyst ? await getUserById(String(analyst.id)) : null;
    if (user) {
      const ctxTool = { user, state: new AnalystState() } as never;
      const experts = await runTool(ctxTool, "find_experts_grouped", { query: "census methodology and household surveys" });
      check(
        "find_experts_grouped answers in two labelled groups, internal first",
        /INTERNAL EXPERTS/.test(experts) && /EXTERNAL EXPERTS/.test(experts) && experts.indexOf("INTERNAL EXPERTS") < experts.indexOf("EXTERNAL EXPERTS"),
        experts.slice(0, 140)
      );
      const scoped = await runTool(ctxTool, "find_experts_grouped", { query: "survey methodology", domain: "household_surveys", limit: 2 });
      check("find_experts_grouped honours a domain scope", /EXPERTS/.test(scoped) && !/^Tool /.test(scoped), scoped.slice(0, 100));
      const studiesTool = await runTool({ user, state: new AnalystState() } as never, "get_studies", { type: "evaluation" });
      check(
        "get_studies cites evaluations and names illustrative content",
        /\[1\]/.test(studiesTool) && /evaluation/i.test(studiesTool) && /ILLUSTRATIVE/.test(studiesTool),
        studiesTool.slice(0, 120)
      );
    } else {
      check("expert tools user loaded", false, "analyst user missing");
    }
  } catch (e) {
    check("expert and studies tools run", false, (e as Error).message);
  }
}
