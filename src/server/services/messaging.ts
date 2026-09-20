// CR08 9.2 and 9.3: in-app messaging and delegates.
//
// Privacy contract (CR08 9.2): a thread is visible to its participants only,
// the delegate of a recipient counted as a participant. Admins get no special
// read. Nothing in this file, in src/server/search (fts.ts, vector.ts,
// hybrid.ts, records.ts) or in the embed_records job reads message_threads,
// thread_participants or messages, so message bodies never reach the search
// index or Ask NPC. The only way a thread's words leave the thread is
// convertToQuestion(), which a participant chooses explicitly.
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { CurrentUser } from "@/server/auth/session";
import { canSeeDocument, canSeePortal } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { notify } from "@/server/gamification/engine";
import { audit } from "@/server/auth/audit";
import { createQuestion, routeToExpert } from "./ask";

/* ------------------------------------------------------------------ */
/* types                                                                */
/* ------------------------------------------------------------------ */

export type PersonRef = {
  id: string;
  nameEn: string;
  nameAr: string;
  avatarColor: string;
};

export type ThreadResource = {
  type: string;
  id: string;
  titleEn: string;
  titleAr: string;
  link: string;
};

export type Attachment = { documentId: string; titleEn: string; titleAr: string };

export type ThreadListItem = {
  id: string;
  subject: string;
  resource: ThreadResource | null;
  status: "open" | "done";
  createdBy: string;
  createdAt: string;
  lastMessageAt: string;
  unread: boolean;
  questionId: string | null;
  /** the person this viewer sees the thread for (delegate threads) */
  asDelegateFor: PersonRef | null;
  /** everyone else on the thread, direct participants first */
  others: PersonRef[];
  messageCount: number;
  lastSnippet: string;
  lastSenderId: string;
};

export type ThreadMessage = {
  id: string;
  senderId: string;
  sender: PersonRef;
  body: string;
  attachments: Attachment[];
  createdAt: string;
};

export type ThreadDetail = {
  id: string;
  subject: string;
  resource: ThreadResource | null;
  status: "open" | "done";
  createdBy: string;
  createdAt: string;
  lastMessageAt: string;
  questionId: string | null;
  asDelegateFor: PersonRef | null;
  participants: (PersonRef & { isDelegateFor: PersonRef | null })[];
  messages: ThreadMessage[];
};

export type ListFilter = "all" | "unread" | "done" | "delegate" | "mine";

export type DelegateInfo = {
  delegate: PersonRef | null;
  from: string | null;
  to: string | null;
  active: boolean;
};

export class MessagingError extends Error {
  constructor(
    public code: string,
    public status = 400
  ) {
    super(code);
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

const today = () => new Date().toISOString().slice(0, 10);

function canMessage(user: CurrentUser): boolean {
  // the messaging module carries no role matrix of its own: reachability is
  // the inbox portal (CR05 6.1), visible to every role by default
  return canSeePortal(user, "inbox");
}

async function peopleById(ids: string[]): Promise<Map<string, PersonRef>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      avatarColor: schema.users.avatarColor,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, unique));
  return new Map(rows.map((r) => [r.id, r]));
}

function parseAttachments(raw: string | null): Attachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.documentId === "string")
      .map((a) => ({
        documentId: String(a.documentId),
        titleEn: String(a.titleEn ?? ""),
        titleAr: String(a.titleAr ?? ""),
      }));
  } catch {
    return [];
  }
}

/** Resolves attachment ids to titles, dropping documents the sender cannot see. */
async function resolveAttachments(
  user: CurrentUser,
  input: { documentId: string }[] | undefined
): Promise<Attachment[]> {
  const ids = [...new Set((input ?? []).map((a) => a.documentId).filter(Boolean))].slice(0, 5);
  if (!ids.length) return [];
  const docs = await db
    .select({
      id: schema.documents.id,
      titleEn: schema.documents.titleEn,
      titleAr: schema.documents.titleAr,
      classificationLevel: schema.documents.classificationLevel,
      visibilityScope: schema.documents.visibilityScope,
      ownerUserId: schema.documents.ownerUserId,
      departmentId: schema.documents.departmentId,
      visibilityAllowJson: schema.documents.visibilityAllowJson,
      deletedAt: schema.documents.deletedAt,
    })
    .from(schema.documents)
    .where(inArray(schema.documents.id, ids));
  return docs
    .filter((d) => !d.deletedAt && canSeeDocument(user, d))
    .map((d) => ({ documentId: d.id, titleEn: d.titleEn, titleAr: d.titleAr }));
}

function resourceOf(t: {
  resourceType: string | null;
  resourceId: string | null;
  resourceTitle: string | null;
  resourceLink: string | null;
}): ThreadResource | null {
  if (!t.resourceType || !t.resourceId) return null;
  let titleEn = t.resourceTitle ?? "";
  let titleAr = t.resourceTitle ?? "";
  // stored as "enar" so one column carries both names
  if (t.resourceTitle && t.resourceTitle.includes("")) {
    const [en, ar] = t.resourceTitle.split("");
    titleEn = en;
    titleAr = ar || en;
  }
  return {
    type: t.resourceType,
    id: t.resourceId,
    titleEn,
    titleAr,
    link: t.resourceLink ?? "",
  };
}

const packTitle = (r: ThreadResource) => `${r.titleEn}${r.titleAr || r.titleEn}`;

async function participantRow(threadId: string, userId: string) {
  const [row] = await db
    .select()
    .from(schema.threadParticipants)
    .where(
      and(eq(schema.threadParticipants.threadId, threadId), eq(schema.threadParticipants.userId, userId))
    )
    .limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* delegates (9.3)                                                      */
/* ------------------------------------------------------------------ */

/** The delegate of a person when the delegation is in force today. */
export async function activeDelegateOf(
  userId: string
): Promise<(PersonRef & { from: string | null; to: string | null }) | null> {
  const [u] = await db
    .select({
      delegateUserId: schema.users.delegateUserId,
      delegateFrom: schema.users.delegateFrom,
      delegateTo: schema.users.delegateTo,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!u?.delegateUserId || u.delegateUserId === userId) return null;
  const day = today();
  if (u.delegateFrom && u.delegateFrom > day) return null;
  if (u.delegateTo && u.delegateTo < day) return null;
  const [d] = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      avatarColor: schema.users.avatarColor,
      deletedAt: schema.users.deletedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, u.delegateUserId))
    .limit(1);
  if (!d || d.deletedAt) return null;
  return { id: d.id, nameEn: d.nameEn, nameAr: d.nameAr, avatarColor: d.avatarColor, from: u.delegateFrom, to: u.delegateTo };
}

export async function getDelegate(user: CurrentUser): Promise<DelegateInfo> {
  const [u] = await db
    .select({
      delegateUserId: schema.users.delegateUserId,
      delegateFrom: schema.users.delegateFrom,
      delegateTo: schema.users.delegateTo,
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  if (!u?.delegateUserId) return { delegate: null, from: null, to: null, active: false };
  const people = await peopleById([u.delegateUserId]);
  const delegate = people.get(u.delegateUserId) ?? null;
  const active = Boolean(await activeDelegateOf(user.id));
  return { delegate, from: u.delegateFrom, to: u.delegateTo, active };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function setDelegate(
  user: CurrentUser,
  input: { delegateUserId: string | null; from?: string | null; to?: string | null }
): Promise<DelegateInfo> {
  if (!input.delegateUserId) {
    await db
      .update(schema.users)
      .set({ delegateUserId: null, delegateFrom: null, delegateTo: null, updatedAt: nowIso() })
      .where(eq(schema.users.id, user.id));
    await audit(user.id, "delegate_clear", "user", user.id);
    return { delegate: null, from: null, to: null, active: false };
  }
  if (input.delegateUserId === user.id) throw new MessagingError("self_delegate", 400);
  const from = input.from || null;
  const to = input.to || null;
  if ((from && !DAY.test(from)) || (to && !DAY.test(to))) throw new MessagingError("invalid_dates", 400);
  if (from && to && from > to) throw new MessagingError("invalid_dates", 400);
  const [target] = await db
    .select({ id: schema.users.id, deletedAt: schema.users.deletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, input.delegateUserId))
    .limit(1);
  if (!target || target.deletedAt) throw new MessagingError("not_found", 404);
  await db
    .update(schema.users)
    .set({ delegateUserId: target.id, delegateFrom: from, delegateTo: to, updatedAt: nowIso() })
    .where(eq(schema.users.id, user.id));
  await audit(user.id, "delegate_set", "user", user.id, { delegateUserId: target.id, from, to });
  return getDelegate(user);
}

/* ------------------------------------------------------------------ */
/* threads                                                              */
/* ------------------------------------------------------------------ */

export async function createThread(
  user: CurrentUser,
  input: {
    toUserId: string;
    subject: string;
    body: string;
    resource?: ThreadResource | null;
    attachments?: { documentId: string }[];
  }
): Promise<{ id: string }> {
  if (!canMessage(user)) throw new MessagingError("forbidden", 403);
  if (input.toUserId === user.id) throw new MessagingError("self_message", 400);
  const [to] = await db
    .select({ id: schema.users.id, nameEn: schema.users.nameEn, nameAr: schema.users.nameAr, deletedAt: schema.users.deletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, input.toUserId))
    .limit(1);
  if (!to || to.deletedAt) throw new MessagingError("not_found", 404);

  const subject = input.subject.trim().slice(0, 200);
  const body = input.body.trim();
  if (!subject || !body) throw new MessagingError("invalid_body", 400);
  const attachments = await resolveAttachments(user, input.attachments);
  const now = nowIso();
  const id = newId();
  const resource = input.resource ?? null;

  await db.insert(schema.messageThreads).values({
    id,
    subject,
    resourceType: resource?.type ?? null,
    resourceId: resource?.id ?? null,
    resourceTitle: resource ? packTitle(resource) : null,
    resourceLink: resource?.link ?? null,
    createdBy: user.id,
    createdAt: now,
    lastMessageAt: now,
    status: "open",
    questionId: null,
  });
  await db.insert(schema.threadParticipants).values([
    { id: newId(), threadId: id, userId: user.id, lastReadAt: now, isDelegateForUserId: null, doneAt: null },
    { id: newId(), threadId: id, userId: to.id, lastReadAt: null, isDelegateForUserId: null, doneAt: null },
  ]);
  const delegate = await activeDelegateOf(to.id);
  if (delegate && delegate.id !== user.id && delegate.id !== to.id) {
    await db.insert(schema.threadParticipants).values({
      id: newId(),
      threadId: id,
      userId: delegate.id,
      lastReadAt: null,
      isDelegateForUserId: to.id,
      doneAt: null,
    });
  }
  await db.insert(schema.messages).values({
    id: newId(),
    threadId: id,
    senderId: user.id,
    body,
    attachmentsJson: attachments.length ? JSON.stringify(attachments) : null,
    createdAt: now,
  });

  const link = `/inbox?thread=${id}`;
  await notify(
    to.id,
    "message",
    `New message from ${user.nameEn}: ${subject.slice(0, 60)}`,
    `رسالة جديدة من ${user.nameAr}: ${subject.slice(0, 60)}`,
    link
  );
  if (delegate && delegate.id !== user.id && delegate.id !== to.id) {
    await notify(
      delegate.id,
      "message",
      `As delegate for ${to.nameEn}: new message from ${user.nameEn}`,
      `بصفتك مفوضاً عن ${to.nameAr}: رسالة جديدة من ${user.nameAr}`,
      link
    );
  }
  // the audit trail records the act, never the words
  await audit(user.id, "message_send", "message_thread", id, {
    toUserId: to.id,
    resourceType: resource?.type ?? null,
    resourceId: resource?.id ?? null,
    attachments: attachments.length,
  });
  return { id };
}

export async function reply(
  user: CurrentUser,
  threadId: string,
  body: string,
  attachments?: { documentId: string }[]
): Promise<{ id: string }> {
  if (!canMessage(user)) throw new MessagingError("forbidden", 403);
  const me = await participantRow(threadId, user.id);
  if (!me) throw new MessagingError("not_found", 404);
  const text = body.trim();
  if (!text) throw new MessagingError("invalid_body", 400);
  const [thread] = await db.select().from(schema.messageThreads).where(eq(schema.messageThreads.id, threadId)).limit(1);
  if (!thread) throw new MessagingError("not_found", 404);
  const resolved = await resolveAttachments(user, attachments);
  const now = nowIso();
  const id = newId();
  await db.insert(schema.messages).values({
    id,
    threadId,
    senderId: user.id,
    body: text,
    attachmentsJson: resolved.length ? JSON.stringify(resolved) : null,
    createdAt: now,
  });
  // a reply reopens a done thread for everyone
  await db
    .update(schema.messageThreads)
    .set({ lastMessageAt: now, status: "open" })
    .where(eq(schema.messageThreads.id, threadId));
  await db
    .update(schema.threadParticipants)
    .set({ doneAt: null })
    .where(eq(schema.threadParticipants.threadId, threadId));
  await db
    .update(schema.threadParticipants)
    .set({ lastReadAt: now })
    .where(eq(schema.threadParticipants.id, me.id));

  const others = await db
    .select()
    .from(schema.threadParticipants)
    .where(eq(schema.threadParticipants.threadId, threadId));
  const names = await peopleById(others.map((p) => p.isDelegateForUserId).filter((x): x is string => Boolean(x)));
  for (const p of others) {
    if (p.userId === user.id) continue;
    const forWhom = p.isDelegateForUserId ? names.get(p.isDelegateForUserId) : null;
    await notify(
      p.userId,
      "message",
      forWhom
        ? `As delegate for ${forWhom.nameEn}: ${user.nameEn} replied on "${thread.subject.slice(0, 50)}"`
        : `${user.nameEn} replied on "${thread.subject.slice(0, 50)}"`,
      forWhom
        ? `بصفتك مفوضاً عن ${forWhom.nameAr}: رد ${user.nameAr} على "${thread.subject.slice(0, 50)}"`
        : `رد ${user.nameAr} على "${thread.subject.slice(0, 50)}"`,
      `/inbox?thread=${threadId}`
    );
  }
  await audit(user.id, "message_reply", "message_thread", threadId, { attachments: resolved.length });
  return { id };
}

export async function listThreads(
  user: CurrentUser,
  opts: { filter?: ListFilter; q?: string } = {}
): Promise<ThreadListItem[]> {
  if (!canMessage(user)) return [];
  const filter = opts.filter ?? "all";
  const mine = await db
    .select()
    .from(schema.threadParticipants)
    .where(eq(schema.threadParticipants.userId, user.id));
  if (!mine.length) return [];
  const byThread = new Map(mine.map((p) => [p.threadId, p]));
  const threadIds = [...byThread.keys()];
  const threads = await db
    .select()
    .from(schema.messageThreads)
    .where(inArray(schema.messageThreads.id, threadIds))
    .orderBy(desc(schema.messageThreads.lastMessageAt));
  const everyone = await db
    .select()
    .from(schema.threadParticipants)
    .where(inArray(schema.threadParticipants.threadId, threadIds));
  const lastRows = await db
    .select({
      threadId: schema.messages.threadId,
      count: sql<number>`count(*)`,
      lastAt: sql<string>`max(${schema.messages.createdAt})`,
    })
    .from(schema.messages)
    .where(inArray(schema.messages.threadId, threadIds))
    .groupBy(schema.messages.threadId);
  const lastMessages = await db
    .select({
      threadId: schema.messages.threadId,
      senderId: schema.messages.senderId,
      body: schema.messages.body,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(inArray(schema.messages.threadId, threadIds))
    .orderBy(desc(schema.messages.createdAt));
  const lastByThread = new Map<string, (typeof lastMessages)[number]>();
  for (const m of lastMessages) if (!lastByThread.has(m.threadId)) lastByThread.set(m.threadId, m);
  const countByThread = new Map(lastRows.map((r) => [r.threadId, Number(r.count)]));
  const people = await peopleById([
    ...everyone.map((p) => p.userId),
    ...everyone.map((p) => p.isDelegateForUserId ?? ""),
  ]);

  const q = (opts.q ?? "").trim().toLowerCase();
  const out: ThreadListItem[] = [];
  for (const t of threads) {
    const me = byThread.get(t.id)!;
    const unread = t.status === "open" && (!me.lastReadAt || me.lastReadAt < t.lastMessageAt);
    const asDelegateFor = me.isDelegateForUserId ? people.get(me.isDelegateForUserId) ?? null : null;
    if (filter === "unread" && !unread) continue;
    if (filter === "done" && t.status !== "done") continue;
    if (filter === "delegate" && !asDelegateFor) continue;
    if (filter === "mine" && asDelegateFor) continue;
    const others = everyone
      .filter((p) => p.threadId === t.id && p.userId !== user.id)
      .sort((a, b) => Number(Boolean(a.isDelegateForUserId)) - Number(Boolean(b.isDelegateForUserId)))
      .map((p) => people.get(p.userId))
      .filter((p): p is PersonRef => Boolean(p));
    const resource = resourceOf(t);
    if (q) {
      const hay = [t.subject, resource?.titleEn, resource?.titleAr, ...others.flatMap((o) => [o.nameEn, o.nameAr])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const last = lastByThread.get(t.id);
    out.push({
      id: t.id,
      subject: t.subject,
      resource,
      status: t.status === "done" ? "done" : "open",
      createdBy: t.createdBy,
      createdAt: t.createdAt,
      lastMessageAt: t.lastMessageAt,
      unread,
      questionId: t.questionId,
      asDelegateFor,
      others,
      messageCount: countByThread.get(t.id) ?? 0,
      lastSnippet: (last?.body ?? "").replace(/\s+/g, " ").slice(0, 140),
      lastSenderId: last?.senderId ?? t.createdBy,
    });
  }
  return out;
}

/** The thread for a participant; marks it read for the viewer. */
export async function getThread(user: CurrentUser, id: string): Promise<ThreadDetail | null> {
  if (!canMessage(user)) return null;
  const me = await participantRow(id, user.id);
  if (!me) return null; // non-participants (admins included) learn nothing
  const [t] = await db.select().from(schema.messageThreads).where(eq(schema.messageThreads.id, id)).limit(1);
  if (!t) return null;
  const parts = await db.select().from(schema.threadParticipants).where(eq(schema.threadParticipants.threadId, id));
  const msgs = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.threadId, id))
    .orderBy(asc(schema.messages.createdAt));
  const people = await peopleById([
    ...parts.map((p) => p.userId),
    ...parts.map((p) => p.isDelegateForUserId ?? ""),
    ...msgs.map((m) => m.senderId),
  ]);
  const now = nowIso();
  await db.update(schema.threadParticipants).set({ lastReadAt: now }).where(eq(schema.threadParticipants.id, me.id));
  const unknown = (uid: string): PersonRef => ({ id: uid, nameEn: "Former colleague", nameAr: "زميل سابق", avatarColor: "maroon" });
  return {
    id: t.id,
    subject: t.subject,
    resource: resourceOf(t),
    status: t.status === "done" ? "done" : "open",
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    lastMessageAt: t.lastMessageAt,
    questionId: t.questionId,
    asDelegateFor: me.isDelegateForUserId ? people.get(me.isDelegateForUserId) ?? null : null,
    participants: parts.map((p) => ({
      ...(people.get(p.userId) ?? unknown(p.userId)),
      isDelegateFor: p.isDelegateForUserId ? people.get(p.isDelegateForUserId) ?? null : null,
    })),
    messages: msgs.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      sender: people.get(m.senderId) ?? unknown(m.senderId),
      body: m.body,
      attachments: parseAttachments(m.attachmentsJson),
      createdAt: m.createdAt,
    })),
  };
}

export async function markDone(user: CurrentUser, id: string, done = true): Promise<void> {
  if (!canMessage(user)) throw new MessagingError("forbidden", 403);
  const me = await participantRow(id, user.id);
  if (!me) throw new MessagingError("not_found", 404);
  const now = nowIso();
  await db
    .update(schema.messageThreads)
    .set({ status: done ? "done" : "open" })
    .where(eq(schema.messageThreads.id, id));
  await db
    .update(schema.threadParticipants)
    .set({ doneAt: done ? now : null, lastReadAt: now })
    .where(eq(schema.threadParticipants.id, me.id));
  await audit(user.id, done ? "message_done" : "message_reopen", "message_thread", id);
}

/** Turns a thread into a routed Ask NPC question: the subject becomes the
    title, the opening message the body, and the question is routed to the
    other party's expert profile when one exists. The thread keeps the link. */
export async function convertToQuestion(
  user: CurrentUser,
  id: string
): Promise<{ questionId: string; routed: boolean }> {
  if (!canMessage(user)) throw new MessagingError("forbidden", 403);
  const me = await participantRow(id, user.id);
  if (!me) throw new MessagingError("not_found", 404);
  const [t] = await db.select().from(schema.messageThreads).where(eq(schema.messageThreads.id, id)).limit(1);
  if (!t) throw new MessagingError("not_found", 404);
  if (t.questionId) return { questionId: t.questionId, routed: false };

  const [first] = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.threadId, id))
    .orderBy(asc(schema.messages.createdAt))
    .limit(1);
  const resource = resourceOf(t);
  const context = resource ? `\n\nContext: ${resource.titleEn}${resource.link ? ` (${resource.link})` : ""}` : "";
  const created = await createQuestion(user, {
    title: t.subject,
    body: `${(first?.body ?? "").slice(0, 3500)}${context}`.trim() || undefined,
  });
  if (!created.ok || !created.id) throw new MessagingError(created.error ?? "forbidden", 403);
  const questionId = created.id;

  // route to the other direct participant's expert profile
  const parts = await db.select().from(schema.threadParticipants).where(eq(schema.threadParticipants.threadId, id));
  const counterpart =
    parts.find((p) => p.userId !== user.id && !p.isDelegateForUserId && p.userId !== me.isDelegateForUserId) ??
    parts.find((p) => p.userId !== user.id);
  let routed = false;
  if (counterpart) {
    const [expert] = await db
      .select({ id: schema.experts.id })
      .from(schema.experts)
      .where(eq(schema.experts.userId, counterpart.userId))
      .limit(1);
    if (expert) {
      const r = await routeToExpert(user, {
        questionId,
        expertId: expert.id,
        reason: "Converted from an Inbox conversation",
      });
      routed = r.ok;
    }
  }
  await db.update(schema.messageThreads).set({ questionId }).where(eq(schema.messageThreads.id, id));
  for (const p of parts) {
    if (p.userId === user.id) continue;
    await notify(
      p.userId,
      "message",
      `${user.nameEn} turned "${t.subject.slice(0, 50)}" into an Ask NPC question`,
      `حوّل ${user.nameAr} "${t.subject.slice(0, 50)}" إلى سؤال في اسأل المجلس`,
      `/ask/${questionId}`
    );
  }
  await audit(user.id, "message_convert", "message_thread", id, { questionId, routed });
  return { questionId, routed };
}

export async function unreadCount(user: CurrentUser): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.threadParticipants)
    .innerJoin(schema.messageThreads, eq(schema.messageThreads.id, schema.threadParticipants.threadId))
    .where(
      and(
        eq(schema.threadParticipants.userId, user.id),
        eq(schema.messageThreads.status, "open"),
        or(
          isNull(schema.threadParticipants.lastReadAt),
          gt(schema.messageThreads.lastMessageAt, schema.threadParticipants.lastReadAt)
        )
      )
    );
  return Number(row?.c ?? 0);
}

/* ------------------------------------------------------------------ */
/* people search (compose recipient, delegate picker)                   */
/* ------------------------------------------------------------------ */

export async function searchPeople(
  user: CurrentUser,
  q: string,
  opts: { limit?: number; excludeSelf?: boolean } = {}
): Promise<(PersonRef & { positionEn: string | null; positionAr: string | null; unitEn: string | null; unitAr: string | null; email: string })[]> {
  const needle = q.trim().toLowerCase();
  const rows = await db
    .select({
      id: schema.users.id,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      avatarColor: schema.users.avatarColor,
      positionEn: schema.users.positionEn,
      positionAr: schema.users.positionAr,
      email: schema.users.email,
      unitEn: schema.orgUnits.nameEn,
      unitAr: schema.orgUnits.nameAr,
    })
    .from(schema.users)
    .leftJoin(schema.orgUnits, eq(schema.orgUnits.id, schema.users.departmentId))
    .where(isNull(schema.users.deletedAt))
    .orderBy(asc(schema.users.nameEn));
  const filtered = rows.filter((r) => {
    if (opts.excludeSelf !== false && r.id === user.id) return false;
    if (!needle) return true;
    return (
      r.nameEn.toLowerCase().includes(needle) ||
      r.nameAr.includes(q.trim()) ||
      r.email.toLowerCase().includes(needle) ||
      (r.unitEn ?? "").toLowerCase().includes(needle)
    );
  });
  return filtered.slice(0, opts.limit ?? 12);
}
