/* eslint-disable no-console */
// CR08 9: one delegate relationship (head.stats delegates to a member of the
// Statistics unit for the current month) and six conversations across the
// item kinds (a project, a document, an indicator, a council node, a unit and
// one with no item) between seeded accounts: two to four messages each, one
// done, one with an attachment from Institutional Memory, one landing with
// the delegate. Notifications for the unread ones.
//
// Idempotent: threads carry deterministic ids (cr08msg_thread_1..6) and are
// skipped when present; the delegate is set only when head.stats has none or
// an expired one.
//   npx tsx scripts/cr08-messaging-seed.ts
// Owned by the Owners and messaging agent.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { ulid } from "ulid";

const THREAD_ID = (n: number) => `cr08msg_thread_${n}`;

type Person = { id: string; email: string; nameEn: string; nameAr: string; departmentId: string | null };

type MessageSpec = { from: Person; daysAgo: number; hour: number; body: string; attach?: { id: string; titleEn: string; titleAr: string } };

type ThreadSpec = {
  n: number;
  from: Person;
  to: Person;
  subject: string;
  resource: { type: string; id: string; titleEn: string; titleAr: string; link: string } | null;
  messages: MessageSpec[];
  /** participants who have read everything */
  read: Person[];
  done?: boolean;
  withDelegate?: Person | null;
};

const slugOf = (code: string | null, id: string) => (code ? code.toLowerCase().replace(/\./g, "-") : id);

export default async function seedCr08Messaging(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const nowMs = Date.now();
  const at = (daysAgo: number, hour: number, minute = 0) => {
    const d = new Date(nowMs - daysAgo * 86400000);
    d.setUTCHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      departmentId: schema.users.departmentId,
      delegateUserId: schema.users.delegateUserId,
      delegateTo: schema.users.delegateTo,
    })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt));
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const need = (email: string): Person => {
    const u = byEmail.get(email);
    if (!u) throw new Error(`cr08 messaging: seeded user ${email} is missing`);
    return u;
  };
  const admin = need("admin@npc.qa");
  const knowledge = need("knowledge@npc.qa");
  const head = need("head.stats@npc.qa");
  const verifier = need("verifier@npc.qa");
  const analyst = need("analyst@npc.qa");
  const reader = need("reader@npc.qa");
  const named = new Set([admin, knowledge, head, verifier, analyst, reader].map((p) => p.id));

  /* ---- 1. the delegate: a member of head.stats's own unit, this month ---- */
  const unitMates = users.filter((u) => u.departmentId && u.departmentId === head.departmentId && !named.has(u.id));
  const delegate: Person = unitMates[0] ?? analyst;
  const today = new Date(nowMs);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const headRow = byEmail.get(head.email)!;
  const dayStr = today.toISOString().slice(0, 10);
  if (!headRow.delegateUserId || (headRow.delegateTo && headRow.delegateTo < dayStr)) {
    await db
      .update(schema.users)
      .set({ delegateUserId: delegate.id, delegateFrom: monthStart, delegateTo: monthEnd, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, head.id));
    console.log(`cr08 messaging: ${head.email} delegates to ${delegate.email} for ${monthStart}..${monthEnd}`);
  } else {
    console.log(`cr08 messaging: delegate already set for ${head.email}`);
  }
  const [headNow] = await db
    .select({ delegateUserId: schema.users.delegateUserId })
    .from(schema.users)
    .where(eq(schema.users.id, head.id))
    .limit(1);
  const activeDelegate = users.find((u) => u.id === headNow?.delegateUserId) ?? null;

  /* ---- 2. the items ---- */
  const projects = await db
    .select()
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.nodeType, "project"))
    .orderBy(asc(schema.strategyNodes.sort), asc(schema.strategyNodes.code));
  const project = projects.find((p) => p.ownerUserId && p.ownerUserId !== analyst.id) ?? projects[0];
  const projectOwner: Person =
    (project?.ownerUserId && users.find((u) => u.id === project.ownerUserId)) || knowledge;

  const docs = await db
    .select({ id: schema.documents.id, titleEn: schema.documents.titleEn, titleAr: schema.documents.titleAr })
    .from(schema.documents)
    .where(
      and(
        isNull(schema.documents.deletedAt),
        eq(schema.documents.status, "verified"),
        eq(schema.documents.visibilityScope, "all_staff"),
        sql`${schema.documents.classificationLevel} <= 2`
      )
    )
    .orderBy(asc(schema.documents.createdAt))
    .limit(2);
  const doc = docs[0];
  const attachDoc = docs[1] ?? docs[0];

  const [indicator] = await db
    .select({ id: schema.indicators.id, nameEn: schema.indicators.nameEn, nameAr: schema.indicators.nameAr })
    .from(schema.indicators)
    .where(sql`${schema.indicators.classificationLevel} <= 1`)
    .orderBy(asc(schema.indicators.code))
    .limit(1);

  const councilNodes = await db
    .select()
    .from(schema.councilNodes)
    .where(inArray(schema.councilNodes.level, ["output", "intermediate_outcome"]))
    .orderBy(asc(schema.councilNodes.sort));
  const council = councilNodes.find((n) => n.level === "output") ?? councilNodes[0];

  const [unit] = head.departmentId
    ? await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.id, head.departmentId)).limit(1)
    : [];

  if (!project || !doc || !indicator || !council || !unit) {
    console.log("cr08 messaging: base seed incomplete (project, document, indicator, council node or unit missing); nothing seeded");
    return;
  }

  /* ---- 3. the conversations ---- */
  const specs: ThreadSpec[] = [
    {
      n: 1,
      from: analyst,
      to: projectOwner,
      subject: `About: ${project.titleEn}`,
      resource: { type: "project", id: project.id, titleEn: project.titleEn, titleAr: project.titleAr, link: `/strategy/${project.id}` },
      messages: [
        { from: analyst, daysAgo: 6, hour: 8, body: `Regarding ${project.titleEn}\n\nCould you confirm whether the Q3 status update reflects the revised milestone dates? The dashboard still shows the original plan and the quarterly brief goes to the Strategy Office on Thursday.` },
        { from: projectOwner, daysAgo: 5, hour: 10, body: "Thanks for flagging it. The revised dates were agreed with the delivery partner last week; I will post the status update today and attach the revised plan to the project record." },
        { from: analyst, daysAgo: 4, hour: 14, body: "Much appreciated. Once it is in, I will refresh the brief and cite the project page as the source." },
      ],
      read: [analyst],
    },
    {
      n: 2,
      from: verifier,
      to: analyst,
      subject: `About: ${doc.titleEn}`,
      resource: { type: "document", id: doc.id, titleEn: doc.titleEn, titleAr: doc.titleAr, link: `/vault/${doc.id}` },
      messages: [
        { from: verifier, daysAgo: 3, hour: 9, body: `Regarding ${doc.titleEn}\n\nBefore I verify the new version, could you check the figures in section 3 against the source tables? I have attached the guidance we use for verification so the checks line up.`, attach: attachDoc },
        { from: analyst, daysAgo: 3, hour: 11, body: "Will do. The 2024 baseline came from the annual bulletin; I will re-run the totals against the published tables and note any difference in the version history." },
        { from: verifier, daysAgo: 2, hour: 16, body: "Thank you. If the totals match, add a line in the summary saying the figures were reconciled with the bulletin, then I can sign it off tomorrow morning." },
      ],
      read: [verifier],
    },
    {
      n: 3,
      from: reader,
      to: head,
      subject: `About: ${indicator.nameEn}`,
      resource: { type: "indicator", id: indicator.id, titleEn: indicator.nameEn, titleAr: indicator.nameAr, link: `/statistics/${indicator.id}` },
      messages: [
        { from: reader, daysAgo: 2, hour: 8, body: `Regarding ${indicator.nameEn}\n\nIs the latest value on the indicator page final or provisional? A ministry colleague is quoting a different figure from an earlier release.` },
        { from: head, daysAgo: 1, hour: 9, body: "It is the final release; the earlier figure was the flash estimate. The page shows the revision note under the chart." },
        { from: reader, daysAgo: 0, hour: 7, minute: 30, body: "Thank you. One more question: will the next release change the methodology note? We would like to reference it in a policy brief." } as MessageSpec,
      ],
      read: [reader],
      withDelegate: activeDelegate,
    },
    {
      n: 4,
      from: analyst,
      to: admin,
      subject: `About: ${council.titleEn}`,
      resource: { type: "council_node", id: council.id, titleEn: council.titleEn, titleAr: council.titleAr, link: `/council-strategy?o=${encodeURIComponent(slugOf(council.code, council.id))}` },
      messages: [
        { from: analyst, daysAgo: 12, hour: 9, body: `Regarding ${council.titleEn}\n\nThe indicator targets for this output look ambitious for 2027. Were they set before the resource review?` },
        { from: admin, daysAgo: 11, hour: 10, body: "They were set in the planning round last year. The Strategy Office is revisiting the 2027 milestones; nothing changes for the current period." },
        { from: analyst, daysAgo: 11, hour: 13, body: "Understood. I will keep the current targets in the results view and add a note to the lessons record when the review lands." },
        { from: admin, daysAgo: 10, hour: 8, body: "Good. Marking this as done; reopen it if the review changes the targets." },
      ],
      read: [analyst, admin],
      done: true,
    },
    {
      n: 5,
      from: head,
      to: knowledge,
      subject: `بشأن: ${unit.nameAr}`,
      resource: { type: "unit", id: unit.id, titleEn: unit.nameEn, titleAr: unit.nameAr, link: `/organisation?unit=${encodeURIComponent(unit.code)}` },
      messages: [
        { from: head, daysAgo: 4, hour: 9, body: `بخصوص ${unit.nameAr}\n\nنرغب في تحديث صفحة الوحدة بإضافة الإجراءات المعتمدة حديثاً. هل يمكن تفعيل تبويب الإجراءات لرؤساء الأقسام أيضاً؟` },
        { from: knowledge, daysAgo: 3, hour: 15, body: "تم تفعيل الصلاحية لرؤساء الأقسام في وحدتكم، ويمكنهم الآن إضافة الإجراءات من صفحة الوحدة مباشرة. يرجى مراجعة السياسات المرفقة قبل النشر." },
      ],
      read: [knowledge],
    },
    {
      n: 6,
      from: admin,
      to: analyst,
      subject: "Welcome to the Inbox",
      resource: null,
      messages: [
        { from: admin, daysAgo: 8, hour: 9, body: "Welcome to in-app messaging. Every conversation about an item stays next to that item, and you can turn a conversation into an Ask NPC question when the answer deserves a wider audience." },
        { from: analyst, daysAgo: 7, hour: 9, body: "Thanks. Does a delegate see everything I receive, or only new messages?" },
        { from: admin, daysAgo: 7, hour: 12, body: "Only new conversations that start while the delegation is active. The delegate is added as a participant and sees the thread marked as delegate." },
      ],
      read: [admin],
    },
  ];

  /* other seeds write concurrently on the shared dev database: retry on a
     busy lock, and treat a half-written thread (no messages) as absent */
  const retry = async <T,>(fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        const busy = /SQLITE_BUSY|database is locked/i.test(String((e as Error)?.message ?? e) + String((e as { cause?: unknown }).cause ?? ""));
        if (!busy || attempt >= 6) throw e;
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }
  };
  const insert = <T extends SQLiteTable>(table: T, values: T["$inferInsert"]) =>
    retry(() => db.insert(table).values(values as never));

  let created = 0;
  for (const spec of specs) {
    const id = THREAD_ID(spec.n);
    const [existing] = await db.select({ id: schema.messageThreads.id }).from(schema.messageThreads).where(eq(schema.messageThreads.id, id)).limit(1);
    if (existing) {
      const [count] = await db.select({ c: sql<number>`count(*)` }).from(schema.messages).where(eq(schema.messages.threadId, id));
      if (Number(count?.c ?? 0) > 0) continue;
      console.log(`cr08 messaging: ${id} was half written, rebuilding it`);
      await retry(() => db.delete(schema.threadParticipants).where(eq(schema.threadParticipants.threadId, id)));
      await retry(() => db.delete(schema.messageThreads).where(eq(schema.messageThreads.id, id)));
    }
    const msgs = spec.messages.map((m) => ({ ...m, createdAt: at(m.daysAgo, m.hour, (m as { minute?: number }).minute ?? 0) }));
    const lastAt = msgs[msgs.length - 1].createdAt;
    const firstAt = msgs[0].createdAt;
    const lastSender = msgs[msgs.length - 1].from.id;
    await insert(schema.messageThreads, {
      id,
      subject: spec.subject,
      resourceType: spec.resource?.type ?? null,
      resourceId: spec.resource?.id ?? null,
      resourceTitle: spec.resource ? `${spec.resource.titleEn}${spec.resource.titleAr || spec.resource.titleEn}` : null,
      resourceLink: spec.resource?.link ?? null,
      createdBy: spec.from.id,
      createdAt: firstAt,
      lastMessageAt: lastAt,
      status: spec.done ? "done" : "open",
      questionId: null,
    });
    const readIds = new Set(spec.read.map((p) => p.id));
    const lastOwnMessageAt = (personId: string) => msgs.filter((m) => m.from.id === personId).map((m) => m.createdAt).pop() ?? null;
    const participants: { userId: string; isDelegateForUserId: string | null }[] = [
      { userId: spec.from.id, isDelegateForUserId: null },
      { userId: spec.to.id, isDelegateForUserId: null },
    ];
    if (spec.withDelegate && spec.withDelegate.id !== spec.from.id && spec.withDelegate.id !== spec.to.id) {
      participants.push({ userId: spec.withDelegate.id, isDelegateForUserId: spec.to.id });
    }
    const unreadFor: string[] = [];
    for (const p of participants) {
      const read = readIds.has(p.userId) || lastSender === p.userId;
      const lastReadAt = read ? lastAt : lastOwnMessageAt(p.userId);
      if (!read) unreadFor.push(p.userId);
      await insert(schema.threadParticipants, {
        id: ulid(),
        threadId: id,
        userId: p.userId,
        lastReadAt,
        isDelegateForUserId: p.isDelegateForUserId,
        doneAt: spec.done ? lastAt : null,
      });
    }
    for (const m of msgs) {
      await insert(schema.messages, {
        id: ulid(),
        threadId: id,
        senderId: m.from.id,
        body: m.body,
        attachmentsJson: m.attach ? JSON.stringify([{ documentId: m.attach.id, titleEn: m.attach.titleEn, titleAr: m.attach.titleAr }]) : null,
        createdAt: m.createdAt,
      });
    }
    const sender = msgs[msgs.length - 1].from;
    for (const userId of unreadFor) {
      const asDelegate = participants.find((p) => p.userId === userId)?.isDelegateForUserId;
      const forWhom = asDelegate ? users.find((u) => u.id === asDelegate) : null;
      await insert(schema.notifications, {
        id: ulid(),
        userId,
        kind: "message",
        titleEn: forWhom
          ? `As delegate for ${forWhom.nameEn}: new message from ${sender.nameEn}`
          : `New message from ${sender.nameEn}: ${spec.subject.slice(0, 60)}`,
        titleAr: forWhom
          ? `بصفتك مفوضاً عن ${forWhom.nameAr}: رسالة جديدة من ${sender.nameAr}`
          : `رسالة جديدة من ${sender.nameAr}: ${spec.subject.slice(0, 60)}`,
        bodyEn: null,
        bodyAr: null,
        link: `/inbox?thread=${id}`,
        readAt: null,
        createdAt: lastAt,
      });
    }
    created++;
  }
  console.log(`cr08 messaging: ${created} conversations created (${specs.length - created} already present)`);
}

const isMain = process.argv[1] && /cr08-messaging-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Messaging()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
