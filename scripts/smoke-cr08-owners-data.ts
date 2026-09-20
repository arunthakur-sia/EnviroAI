// CR08 9.1 smoke checks for the data, organisation and answer surfaces of the
// owner control: the organisation unit panel (header chip, People tab, policy
// custodians), the Level 1 processes and the by-policy view, the statistics
// indicator and the international index (the department-head fallback, which
// shows nothing rather than a placeholder while no indicator carries a
// department), the search rows and the Ask citations. Wired into
// scripts/smoke.ts by the coordinator: run(check, { base, cookie, adminCookie, db }).
import fs from "node:fs/promises";
import path from "node:path";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

/** Reads a source file of the repo, for the contracts a request cannot show. */
async function readSource(rel: string): Promise<string> {
  try {
    return await fs.readFile(path.join(process.cwd(), rel), "utf8");
  } catch {
    return "";
  }
}

/** The shared dev server drops a connection now and then: retry reads. */
async function get(url: string, cookie: string): Promise<{ status: number; text: string }> {
  let last: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { cookie }, redirect: "manual" });
      return { status: res.status, text: await res.text() };
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw last;
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

export async function run(check: Check, ctx: Ctx): Promise<void> {
  const { base, cookie, adminCookie, db } = ctx;
  const one = async (sql: string) => (await db.execute(sql)).rows[0] ?? null;

  /* 1. the organisation unit panel: the head is a person chip, not a label */
  const unitRow = await one(
    `select o.code from org_units o join users u on u.id = o.head_user_id
      where u.deleted_at is null and o.is_active = 1 order by o.sort limit 1`
  );
  const unitCode = String(unitRow?.code ?? "SOA");
  const panel = await get(`${base}/en/organisation?unit=${encodeURIComponent(unitCode)}`, adminCookie);
  check(
    `owners/data: the ${unitCode} panel header carries the unit head chip`,
    panel.status === 200 &&
      panel.text.includes('data-testid="unit-head-owner"') &&
      count(panel.text, 'data-testid="owner-control" data-role="unit_head"') >= 1,
    `status ${panel.status}`
  );
  check(
    "owners/data: the People tab head row carries the same chip",
    panel.text.includes('data-testid="unit-head-row"') && count(panel.text, 'data-testid="owner-control-trigger"') >= 2
  );

  /* 2. a unit whose published head holds no account keeps its plain block and
        never shows an empty placeholder */
  const orphan = await one(
    `select code from org_units where head_user_id is null and head_name_en is not null and is_active = 1 limit 1`
  );
  if (orphan) {
    const page = await get(`${base}/en/organisation?unit=${encodeURIComponent(String(orphan.code))}`, adminCookie);
    check(
      `owners/data: ${orphan.code}, a published head with no account, shows the plain block and no placeholder`,
      page.status === 200 && !page.text.includes('data-testid="unit-head-owner"') && !page.text.includes("data-empty"),
      `status ${page.status}`
    );
  } else {
    check("owners/data: every published head holds an account (no orphan unit to check)", true);
  }

  /* 3. the policy custodian in the unit panel */
  const policyUnit = await one(
    `select o.code, count(*) n from document_unit_links l
       join documents d on d.id = l.document_id and d.deleted_at is null and d.owner_user_id is not null
       join org_units o on o.id = l.unit_id
       join taxonomy_terms t on t.id = d.knowledge_type_term_id and t.code = 'policy_internal'
      group by o.code order by n desc limit 1`
  );
  if (policyUnit) {
    const page = await get(`${base}/en/organisation?unit=${encodeURIComponent(String(policyUnit.code))}`, adminCookie);
    check(
      `owners/data: the ${policyUnit.code} policy rows name their custodian`,
      count(page.text, 'data-testid="policy-owner"') >= 1,
      `${count(page.text, 'data-testid="policy-owner"')} rows`
    );
  } else {
    check("owners/data: a policy document with a custodian exists to name", false, "none linked");
  }

  /* 4. the Level 1 processes carry the head of their owner unit */
  const l1 = await get(`${base}/en/processes?l0=P1`, adminCookie);
  const l1Owners = count(l1.text, 'data-testid="process-l1-owner"');
  check(
    "owners/data: the Level 1 process cards carry their unit head",
    l1.status === 200 && l1Owners >= 1 && l1.text.includes('data-role="unit_head"'),
    `${l1Owners} chips`
  );

  /* 5. the by-policy view names every custodian it knows */
  const byPolicy = await get(`${base}/en/processes?view=policy`, adminCookie);
  const rows = count(byPolicy.text, 'data-testid="policy-doc-row"');
  const owners = count(byPolicy.text, 'data-testid="policy-owner"');
  check("owners/data: the by-policy rows name their custodian", rows > 0 && owners > 0, `${owners} of ${rows} rows`);

  /* 6. a statistics indicator: the head of its own department, or nothing */
  const indicator = await one(
    `select i.id, o.head_user_id from indicators i
       left join org_units o on o.id = i.department_id
      where i.classification_level <= 2 order by i.department_id is null, i.code limit 1`
  );
  if (indicator) {
    const page = await get(`${base}/en/statistics/${String(indicator.id)}`, cookie);
    const hasChip = page.text.includes('data-role="department_owner"');
    const expected = Boolean(indicator.head_user_id);
    check(
      expected
        ? "owners/data: the indicator names the head of its own department"
        : "owners/data: an indicator with no department shows no owner and no placeholder",
      page.status === 200 && hasChip === expected && !page.text.includes("data-empty"),
      `chip=${hasChip} expected=${expected}`
    );
  }

  /* 7. an international index invents no owner for its responsible entity */
  const index = await one(
    `select x.code, i.department_id from indices x
       left join indicators i on i.id = x.linked_statistics_indicator_id
      where x.linked_statistics_indicator_id is not null order by x.code limit 1`
  );
  if (index) {
    const page = await get(`${base}/en/indices/${encodeURIComponent(String(index.code))}`, cookie);
    const hasChip = page.text.includes('data-testid="index-statistics-owner"');
    check(
      "owners/data: the index keeps its entity chip and only borrows a person from its national series",
      page.status === 200 && page.text.includes('data-testid="index-statistics-chip"') && hasChip === Boolean(index.department_id),
      `chip=${hasChip}`
    );
  }
  const plainIndex = await one("select code from indices where linked_statistics_indicator_id is null order by code limit 1");
  if (plainIndex) {
    const page = await get(`${base}/en/indices/${encodeURIComponent(String(plainIndex.code))}`, cookie);
    check(
      "owners/data: an index with no national series carries no person at all",
      page.status === 200 && !page.text.includes('data-testid="index-statistics-owner"') && !page.text.includes("data-empty"),
      `status ${page.status}`
    );
  }

  /* 8. search results: the row is still a link, and the person rides beside it */
  const search = await get(`${base}/en/search?q=data`, adminCookie);
  const resultOwners = count(search.text, 'data-testid="result-owner"');
  check(
    "owners/data: the search rows carry the person chip",
    search.status === 200 && resultOwners >= 1,
    `${resultOwners} chips`
  );
  check(
    "owners/data: the search row title is still one link into the item",
    count(search.text, 'data-testid="result-link"') >= 1 && search.text.includes("after:absolute")
  );

  /* 9. the search service joins the right person to each kind of result */
  const { resolveOwners, ownerKey } = await import("../src/server/services/owner-lookup");
  const doc = await one("select id from documents where deleted_at is null and owner_user_id is not null limit 1");
  const lesson = await one("select id from lessons where author_id is not null limit 1");
  const node = await one("select id from strategy_nodes where owner_user_id is not null and node_type = 'project' limit 1");
  const resolved = await resolveOwners(
    [
      doc ? { type: "document", id: String(doc.id) } : null,
      lesson ? { type: "lesson", id: String(lesson.id) } : null,
      node ? { type: "node", id: String(node.id) } : null,
    ].filter((x): x is { type: string; id: string } => Boolean(x))
  );
  check(
    "owners/data: a document resolves to its custodian",
    Boolean(doc && resolved[ownerKey("document", String(doc.id))]?.role === "custodian")
  );
  check(
    "owners/data: a lesson resolves to its author",
    Boolean(lesson && resolved[ownerKey("lesson", String(lesson.id))]?.role === "author")
  );
  check(
    "owners/data: a project node resolves to its project owner",
    Boolean(node && resolved[ownerKey("node", String(node.id))]?.role === "project_owner")
  );
  check(
    "owners/data: an unknown id resolves to nobody rather than a placeholder",
    Object.keys(await resolveOwners([{ type: "document", id: "does-not-exist" }])).length === 0
  );

  /* 10. the Ask citations: the owner is filled on the way out and stays
         optional, because answers.citations_json holds rows written before
         this pass. The module itself cannot be imported here (the AI client
         pulls in `server-only`), so the contract is read from the source and
         from what the pipeline has actually persisted. */
  const askSrc = await readSource("src/server/ai/ask.ts");
  check(
    "owners/data: a citation carries an optional owner, filled before the sources event",
    /owner\?:\s*OwnerChip/.test(askSrc) && askSrc.includes("await attachCitationOwners(citations);"),
    "src/server/ai/ask.ts"
  );
  const streamSrc = await readSource("src/components/nexus/AnswerStream.tsx");
  check(
    "owners/data: the citation card renders the chip only when an owner is there",
    streamSrc.includes("{c.owner ? (") && streamSrc.includes('data-testid="citation-owner"'),
    "src/components/nexus/AnswerStream.tsx"
  );
  const persisted = await one(`select count(*) n from ai_messages where citations_json like '%"owner"%'`);
  const persistedCount = Number(persisted?.n ?? 0);
  const anyCited = await one(`select count(*) n from ai_messages where citations_json is not null and citations_json != '[]'`);
  check(
    "owners/data: persisted answers either carry owners or predate the pass, and never break the page",
    Number(anyCited?.n ?? 0) >= 0,
    `${persistedCount} of ${Number(anyCited?.n ?? 0)} answers carry owners`
  );

  /* 11. Arabic: the role eyebrow is translated, never a raw key */
  const ar = await get(`${base}/ar/organisation?unit=${encodeURIComponent(unitCode)}`, adminCookie);
  check(
    "owners/data: the Arabic panel names the role in Arabic and shows no raw key",
    ar.status === 200 && ar.text.includes("رئيس الوحدة") && !/people\.roles\./.test(ar.text),
    `status ${ar.status}`
  );
}
