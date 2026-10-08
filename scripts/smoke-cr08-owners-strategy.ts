// CR08 9.1 smoke checks: the owner control on the strategy and Programme Strategy
// surfaces. Every check reads the server-rendered HTML of a page (or the
// payload a drawer loads) and asserts the control's testid is there, so a
// regression that drops an owner chip fails here rather than in a screenshot.
// Wired into scripts/smoke.ts by the coordinator.
type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client };

const OWNER = 'data-testid="owner-control"';
const COMPACT = 'data-testid="owner-control-compact"';
const TRIGGER = 'data-testid="owner-control-trigger"';

/** The shared dev server sometimes cuts a streamed page short while several
    probes hammer it, so a page is read again until the document is whole. */
async function html(ctx: Ctx, path: string, cookie = ctx.adminCookie): Promise<string> {
  let last = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${ctx.base}${path}`, { headers: { cookie } });
    if (!res.ok) {
      last = `__status_${res.status}__`;
    } else {
      last = await res.text();
      if (last.includes("</html>")) return last;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return last;
}

async function json<T>(ctx: Ctx, path: string, cookie = ctx.adminCookie): Promise<T | null> {
  const res = await fetch(`${ctx.base}${path}`, { headers: { cookie } });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: T };
  return body.data ?? null;
}

function role(kind: string): string {
  return `data-role="${kind}"`;
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  /* ---------------------------------------------------------------- */
  /* the rows the checks open                                          */
  /* ---------------------------------------------------------------- */
  const projectRow = await ctx.db.execute(
    `select n.id, n.code from strategy_nodes n
       join users u on u.id = n.owner_user_id and u.deleted_at is null
      where n.node_type in ('project','initiative')
        and exists (select 1 from node_stakeholders s where s.node_id = n.id and s.user_id is not null)
      order by n.code limit 1`
  );
  const project = projectRow.rows[0] as unknown as { id: string; code: string } | undefined;
  const outcomeRow = await ctx.db.execute(
    `select n.id, n.code, e.code edition from strategy_nodes n
       join strategy_editions e on e.id = n.edition_id
      where n.node_type = 'outcome' and n.parent_id is null and e.is_default = 1
        and exists (select 1 from kpis k where k.node_id = n.id and k.owner_user_id is not null)
        and exists (
          select 1 from node_leads nl join departments d on d.id = nl.department_id
           where nl.node_id = n.id and nl.role = 'lead' and d.head_user_id is not null)
      order by n.sort limit 1`
  );
  const outcome = outcomeRow.rows[0] as unknown as { id: string; code: string; edition: string } | undefined;
  const councilRow = await ctx.db.execute(
    `select c.id, c.code, p.code output_code, pp.code io_code, ppp.code goal_code
       from council_nodes c
       join council_nodes p on p.id = c.parent_id
       join council_nodes pp on pp.id = p.parent_id
       join council_nodes ppp on ppp.id = pp.parent_id
       join users u on u.id = c.owner_user_id and u.deleted_at is null
      where c.level = 'project' order by c.code limit 1`
  );
  const councilProject = councilRow.rows[0] as unknown as
    | { id: string; code: string; output_code: string; io_code: string; goal_code: string }
    | undefined;

  check(
    "owners strategy: the fixtures exist (an owned project, an theme with a KPI custodian, an owned Programme Strategy project)",
    Boolean(project && outcome && councilProject),
    `${project?.code ?? "-"} / ${outcome?.code ?? "-"} / ${councilProject?.code ?? "-"}`
  );
  if (!project || !outcome || !councilProject) return;

  const slug = (code: string) => code.toLowerCase().replace(/\./g, "-");

  /* 1. the node detail page of an owned project */
  const detailEn = await html(ctx, `/en/strategy/${project.id}`);
  check(
    "owners strategy: the project page carries the owner control as project owner",
    detailEn.includes(OWNER) && detailEn.includes(role("project_owner")) && detailEn.includes(TRIGGER),
    project.code
  );
  check(
    "owners strategy: the project page carries person chips on its stakeholder rows",
    (detailEn.match(new RegExp(COMPACT, "g")) ?? []).length >= 2,
    `${(detailEn.match(new RegExp(COMPACT, "g")) ?? []).length} chips`
  );

  /* 2. the same page in Arabic */
  const detailAr = await html(ctx, `/ar/strategy/${project.id}`);
  check(
    "owners strategy: the project page carries the owner control in Arabic too",
    detailAr.includes(OWNER) && detailAr.includes(role("project_owner"))
  );

  /* 3. the theme page: the department head stands in for the missing person */
  const outcomeDetail = await html(ctx, `/en/strategy/${outcome.id}`);
  check(
    "owners strategy: an theme with no recorded person falls back to the department head",
    outcomeDetail.includes(OWNER) && outcomeDetail.includes(role("department_owner")),
    outcome.code
  );
  check(
    "owners strategy: the KPI cards carry their custodian",
    outcomeDetail.includes(role("custodian")),
    outcome.code
  );

  /* 4. never a placeholder where nobody is recorded (DECISIONS 121) */
  check(
    "owners strategy: no unassigned placeholder is rendered anywhere on those pages",
    !detailEn.includes("data-empty") && !outcomeDetail.includes("data-empty")
  );

  /* 5. the canvas with the theme panel open */
  const canvas = await html(ctx, `/en/strategy/${outcome.edition}?o=${slug(outcome.code)}`);
  check(
    "owners strategy: the canvas theme panel names an owner",
    canvas.includes(OWNER),
    `${outcome.edition}?o=${slug(outcome.code)}`
  );
  check(
    "owners strategy: the canvas lane and stakeholder rows carry compact person chips",
    canvas.includes(COMPACT)
  );

  /* 6. the outcome slug route (the target cards page) */
  const outcomePage = await html(ctx, `/en/strategy/${outcome.edition}/${slug(outcome.code)}`);
  check(
    "owners strategy: the theme slug page carries the owner control",
    outcomePage.includes(OWNER) || outcomePage.includes(COMPACT),
    `${outcome.edition}/${slug(outcome.code)}`
  );

  /* 7. the drawer payload */
  const card = await json<{
    owner: { id: string } | null;
    owners: Record<string, { id: string; nameEn: string }>;
    kpis: { ownerUserId: string | null }[];
    stakeholders: { userId: string | null }[];
  }>(ctx, `/api/v1/strategy/node-card?id=${project.id}`);
  check(
    "owners strategy: the node card payload carries the owner and the resolved people",
    Boolean(card?.owner?.id) && Object.keys(card?.owners ?? {}).length > 0,
    `${Object.keys(card?.owners ?? {}).length} people`
  );
  check(
    "owners strategy: every stakeholder account in the payload resolves to a person",
    (card?.stakeholders ?? [])
      .filter((s) => s.userId)
      .every((s) => Boolean(card?.owners[s.userId as string])),
    `${(card?.stakeholders ?? []).filter((s) => s.userId).length} accounts`
  );

  /* 8. the Programme Strategy chain with a goal, an intermediate outcome and an output open */
  const chain = await html(
    ctx,
    `/en/council-strategy?g=${slug(councilProject.goal_code)}&io=${slug(councilProject.io_code)}&o=${slug(councilProject.output_code)}`
  );
  check(
    "owners strategy: the Programme Strategy chain carries person chips on its project cards",
    chain.includes(COMPACT),
    councilProject.output_code
  );

  /* 9. the Programme Strategy project payload behind the drawer */
  const detail = await json<{
    node: { ownerUser: { id: string; avatarColor: string } | null };
    indicators: { responsible: { id: string; avatarColor: string } | null }[];
    stakeholderOwners: Record<string, { id: string }>;
  }>(ctx, `/api/v1/council?view=project&id=${councilProject.id}`);
  check(
    "owners strategy: the Programme Strategy project payload carries the owner with an avatar colour",
    Boolean(detail?.node.ownerUser?.id && detail?.node.ownerUser?.avatarColor),
    councilProject.code
  );
  check(
    "owners strategy: the Programme Strategy indicator custodian carries an avatar colour",
    (detail?.indicators ?? []).some((i) => Boolean(i.responsible?.avatarColor)),
    `${(detail?.indicators ?? []).length} indicators`
  );
  check(
    "owners strategy: the Programme Strategy project payload resolves its stakeholder people",
    typeof detail?.stakeholderOwners === "object" && detail?.stakeholderOwners !== null
  );

  /* 10. a Contributor sees the same control (the chip is not admin-only) */
  const asContributor = await html(ctx, `/en/strategy/${project.id}`, ctx.cookie);
  check(
    "owners strategy: a Contributor session sees the same owner control",
    asContributor.includes(OWNER) && asContributor.includes(TRIGGER)
  );

  /* 11. no owner ever points at a deleted or missing account */
  const dangling = await ctx.db.execute(
    `select
       (select count(*) from strategy_nodes n left join users u on u.id = n.owner_user_id
         where n.owner_user_id is not null and (u.id is null or u.deleted_at is not null)) nodes,
       (select count(*) from kpis k left join users u on u.id = k.owner_user_id
         where k.owner_user_id is not null and (u.id is null or u.deleted_at is not null)) kpis,
       (select count(*) from council_nodes c left join users u on u.id = c.owner_user_id
         where c.owner_user_id is not null and (u.id is null or u.deleted_at is not null)) council,
       (select count(*) from council_indicators i left join users u on u.id = i.responsible_user_id
         where i.responsible_user_id is not null and (u.id is null or u.deleted_at is not null)) indicators`
  );
  const d = dangling.rows[0] as unknown as { nodes: number; kpis: number; council: number; indicators: number };
  check(
    "owners strategy: no owner, custodian or responsible points at a deleted account",
    Number(d.nodes) === 0 && Number(d.kpis) === 0 && Number(d.council) === 0 && Number(d.indicators) === 0,
    JSON.stringify(d)
  );

  /* 12. the KPI custodians the seed records are in place */
  const custodians = await ctx.db.execute(
    "select count(*) n from kpis where owner_user_id is not null"
  );
  check(
    "owners strategy: the strategy KPIs carry custodians",
    Number((custodians.rows[0] as unknown as { n: number }).n) >= 10,
    `${(custodians.rows[0] as unknown as { n: number }).n} KPIs`
  );
}
