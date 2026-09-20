/* eslint-disable no-console */
// CR08 9.1 (library surfaces): smoke checks for the owner chip on the
// Institutional Memory shelves and list, the document page, collections,
// Studies, the Learning Room and lessons, Reports, and Ask answers. Wired
// into scripts/smoke.ts by the coordinator.
//   ctx.cookie is a Contributor session (analyst@npc.qa), ctx.adminCookie the
//   Super Admin, ctx.db a raw libsql client. Read-only: nothing is written.
import type { Client } from "@libsql/client";

type Check = (name: string, ok: boolean, detail?: string) => void;
type Ctx = { base: string; cookie: string; adminCookie: string; db: Client };

async function html(ctx: Ctx, cookie: string, path: string): Promise<string> {
  const res = await fetch(ctx.base + path, { headers: { cookie } });
  if (!res.ok) return "";
  return res.text();
}

const OWNER_CONTROL = 'data-testid="owner-control"';
const OWNER_COMPACT = 'data-testid="owner-control-compact"';

/** The chip renders a <button>, so it may never sit inside a link or another
    button: the markup would be invalid and the clicks would be swallowed. */
function nestedInInteractive(markup: string, testId: string): boolean {
  const re = new RegExp(`<(a|button)\\b[^>]*data-testid="${testId}"`, "i");
  return re.test(markup);
}

export async function run(check: Check, ctx: Ctx): Promise<void> {
  /* ---- 1. the shelf payload carries the owner id ---- */
  let shelfOwnerId = "";
  try {
    const { toShelfDocs } = await import("../src/server/services/documents");
    const { db, schema } = await import("../src/server/db/client");
    const { and, eq, inArray, isNull } = await import("drizzle-orm");
    const owned = await ctx.db.execute(
      "select d.id from documents d join users u on u.id = d.owner_user_id where d.deleted_at is null and u.deleted_at is null limit 5"
    );
    const ids = owned.rows.map((r) => String(r.id));
    const rows = ids.length
      ? await db.select().from(schema.documents).where(inArray(schema.documents.id, ids))
      : [];
    const shelf = await toShelfDocs(rows);
    const withOwner = shelf.filter((d) => d.ownerUserId);
    shelfOwnerId = withOwner[0]?.ownerUserId ?? "";
    check(
      "toShelfDocs emits ownerUserId beside the owner name and colour",
      shelf.length > 0 && withOwner.length === shelf.length && Boolean(withOwner[0]?.ownerName),
      `${withOwner.length}/${shelf.length} carry an id`
    );
    const live = shelfOwnerId
      ? await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(and(eq(schema.users.id, shelfOwnerId), isNull(schema.users.deletedAt)))
      : [];
    check("every emitted owner id belongs to a live account", live.length === 1, shelfOwnerId);
  } catch (e) {
    check("toShelfDocs emits ownerUserId beside the owner name and colour", false, (e as Error).message);
  }

  /* ---- 2. the bulk loader behind every page of this pass ---- */
  try {
    const { getOwnerRefs } = await import("../src/server/services/people");
    const refs = await getOwnerRefs([shelfOwnerId, null, undefined, "01NOTAREALUSERID0000000000"]);
    const ref = refs[shelfOwnerId];
    check(
      "getOwnerRefs answers with the shape OwnerControl takes and drops unknown ids",
      Boolean(ref?.nameEn && ref?.nameAr && ref?.avatarColor) && Object.keys(refs).length === 1,
      Object.keys(refs).join(",")
    );
  } catch (e) {
    check("getOwnerRefs answers with the shape OwnerControl takes", false, (e as Error).message);
  }

  /* ---- 3. Institutional Memory: the list rows ---- */
  const list = await html(ctx, ctx.cookie, "/en/vault?view=list");
  check(
    "the Institutional Memory list renders owner chips",
    list.includes('data-testid="doc-list-row"') && list.includes(OWNER_COMPACT)
  );
  check(
    "the list row is no longer one link around the owner chip",
    /<div\b[^>]*data-testid="doc-list-row"/.test(list) && !nestedInInteractive(list, "doc-list-row")
  );

  /* ---- 4. a document page: the owner, with the role ---- */
  const docRow = await ctx.db.execute(
    "select d.id from documents d join users u on u.id = d.owner_user_id where d.deleted_at is null and u.deleted_at is null and d.classification_level <= 2 order by d.updated_at desc limit 1"
  );
  const documentId = String(docRow.rows[0]?.id ?? "");
  const doc = documentId ? await html(ctx, ctx.cookie, `/en/vault/${documentId}`) : "";
  check(
    "the document page carries the owner control with the owner role",
    doc.includes(OWNER_CONTROL) && /data-testid="owner-control"[^>]*data-role="owner"/.test(doc),
    documentId
  );

  /* ---- 5. a collection: the custodian ---- */
  const colRow = await ctx.db.execute(
    "select c.id from collections c join users u on u.id = c.owner_user_id where u.deleted_at is null limit 1"
  );
  const collectionId = String(colRow.rows[0]?.id ?? "");
  const collection = collectionId ? await html(ctx, ctx.cookie, `/en/vault/collections/${collectionId}`) : "";
  check(
    "the collection page carries the custodian",
    /data-testid="owner-control"[^>]*data-role="custodian"/.test(collection),
    collectionId
  );

  /* ---- 6. Studies: the featured study's author ---- */
  const studies = await html(ctx, ctx.cookie, "/en/studies");
  check(
    "the Studies hero carries the author chip",
    studies.includes('data-testid="featured-study"') && studies.includes(OWNER_COMPACT)
  );

  /* ---- 7. the Learning Room projection carries the author id ---- */
  try {
    const { getLearningRoomData } = await import("../src/server/services/lessons");
    const { getUserById } = await import("../src/server/auth/session");
    const userRow = await ctx.db.execute("select id from users where email = 'analyst@npc.qa'");
    const user = await getUserById(String(userRow.rows[0]?.id ?? ""));
    if (!user) throw new Error("analyst user missing");
    const data = await getLearningRoomData(user);
    const named = data.lessons.filter((l) => l.authorNameEn);
    const withId = named.filter((l) => l.authorId);
    check(
      "every Learning Room lesson with an author name carries the author id",
      named.length > 0 && withId.length === named.length,
      `${withId.length}/${named.length}`
    );
    const first = withId[0];
    const dbRow = first
      ? await ctx.db.execute({ sql: "select author_id from lessons where id = ?", args: [first.id] })
      : null;
    check(
      "the author id is the lesson's own author",
      Boolean(first) && String(dbRow?.rows[0]?.author_id ?? "") === first!.authorId,
      first?.authorId ?? ""
    );
  } catch (e) {
    check("every Learning Room lesson with an author name carries the author id", false, (e as Error).message);
  }

  /* ---- 8. a lesson page: the author ---- */
  const lessonRow = await ctx.db.execute(
    "select l.id from lessons l join users u on u.id = l.author_id where l.status in ('published','verified') and l.classification_level <= 2 and u.deleted_at is null limit 1"
  );
  const lessonId = String(lessonRow.rows[0]?.id ?? "");
  const lesson = lessonId ? await html(ctx, ctx.cookie, `/en/lessons/${lessonId}`) : "";
  check(
    "the lesson page carries the author",
    /data-testid="owner-control"[^>]*data-role="author"/.test(lesson),
    lessonId
  );

  /* ---- 9. Reports: the requester carries a colour, and the rows are not links ----
     (the reports service is server-only, so the widened lookup is read back
     through the module API rather than by importing it here) */
  const reportRow = await ctx.db.execute(
    "select r.id from reports r join users u on u.id = r.requested_by where r.type_id is not null and u.deleted_at is null order by r.created_at desc limit 1"
  );
  const reportId = String(reportRow.rows[0]?.id ?? "");
  if (reportId) {
    const res = await fetch(`${ctx.base}/api/v1/report-builder/${reportId}`, { headers: { cookie: ctx.adminCookie } });
    const json = (await res.json().catch(() => ({ data: null }))) as {
      data: { report?: { requestedBy?: string | null; requesterNameEn?: string | null; requesterColor?: string | null } } | null;
    };
    const r = json.data?.report;
    check(
      "a report with a live requester carries the requester id, name and avatar colour",
      res.status === 200 && Boolean(r?.requestedBy && r?.requesterNameEn && r?.requesterColor),
      `${res.status} ${r?.requesterColor ?? "no colour"}`
    );
  } else {
    check("a report with a live requester carries the requester id, name and avatar colour", false, "no seeded report");
  }
  const hub = await html(ctx, ctx.adminCookie, "/en/reports");
  check(
    "the Reports hub renders requester chips and its rows are no longer links",
    hub.includes(OWNER_COMPACT) && /<div\b[^>]*data-testid="report-row"/.test(hub) && !nestedInInteractive(hub, "report-row")
  );
  const report = reportId ? await html(ctx, ctx.adminCookie, `/en/reports/${reportId}`) : "";
  check(
    "the report page shows the requester as a person chip inside the metadata list",
    report.includes('data-testid="report-meta"') && report.includes(OWNER_COMPACT),
    reportId
  );

  /* ---- 10. Ask: the human answer's author ---- */
  const qRow = await ctx.db.execute(
    "select q.id from questions q join answers a on a.question_id = q.id and a.is_ai = 0 and a.author_id is not null join users u on u.id = a.author_id where q.classification_level <= 2 and u.deleted_at is null group by q.id limit 1"
  );
  const questionId = String(qRow.rows[0]?.id ?? "");
  const thread = questionId ? await html(ctx, ctx.cookie, `/en/ask/${questionId}`) : "";
  check(
    "the Ask conversation carries the asker and the human answer's author",
    /data-testid="owner-control"[^>]*data-role="author"/.test(thread) && thread.includes(OWNER_COMPACT),
    questionId
  );

  /* ---- 11. nothing is offered where no person is recorded ---- */
  const orphan = await ctx.db.execute(
    "select id from documents where owner_user_id is null and deleted_at is null and classification_level <= 2 limit 1"
  );
  if (orphan.rows.length) {
    const orphanId = String(orphan.rows[0].id);
    const page = await html(ctx, ctx.cookie, `/en/vault/${orphanId}`);
    check(
      "a document with no recorded owner renders no owner control at all",
      page.length > 0 && !page.includes(OWNER_CONTROL),
      orphanId
    );
  } else {
    check("a document with no recorded owner renders no owner control at all", true, "no ownerless document seeded");
  }

  /* ---- 12. the person card behind every chip on these pages ---- */
  if (shelfOwnerId) {
    const res = await fetch(`${ctx.base}/api/v1/people/${shelfOwnerId}/card?itemType=document&itemId=${documentId}`, {
      headers: { cookie: ctx.cookie },
    });
    const json = (await res.json().catch(() => ({ data: null }))) as { data: { id?: string; links?: unknown } | null };
    check(
      "the person card of a shelf owner loads for a Contributor",
      res.status === 200 && json.data?.id === shelfOwnerId,
      String(res.status)
    );
  }
}
