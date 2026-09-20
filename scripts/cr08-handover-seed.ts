/* eslint-disable no-console */
// CR08 6: sample handovers in every state. Idempotent: each seeded handover
// carries a marker in its notes ("[Illustrative] cr08-seed:<key>") and is
// skipped when present.
//   (a) an internal leaving handover for a statistics contributor, mixed
//       recipients, one interview complete with an Expert Insights lesson,
//       one in progress, a learning path with two modules understood;
//   (b) an external engagement-ending handover for a consultant on a
//       project, items to the system with filing proposals, one approved,
//       an access link created (the plain token goes to the seed log only);
//   (c) a closed handover with the report archived, cut off, points paid
//       (the CR05 "transferring, complete" handover, closed with a logged
//       override);
//   (d) the CR05 seeded handovers mapped into the new columns.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

const MARK = (key: string) => `[Illustrative] cr08-seed:${key}`;

/** The handover note the leaving person writes, per item category. */
const ITEM_NOTES: Record<string, string> = {
  document: "Final version in the Vault; the working spreadsheets sit in the SOA shared drive under /operations/2026. Ask the data quality team before re-running the tables.",
  deliverable: "Accepted by the project owner; the source files and the review comments are in the project folder, and the next revision is due with the quality review.",
  report: "Published edition in the Vault; the figures come from the operations round and are refreshed with each release.",
  lesson: "Written after the 2025 field round; the recommendation still stands and the census team applies it.",
  project_role: "Hand the project calendar over in the first week; the milestones and the budget line are in the project folder.",
  stakeholder_role: "Weekly stand-up on Mondays with the project owner; the risk log lives in the project folder. Nothing is blocked today.",
  indicator: "Values are entered after each operations round; the methodology note sits beside the indicator.",
  council_indicator: "Values arrive from the NSC monthly release on the 12th; enter them the same week and flag any revision to the owner.",
  tacit_topic: "Covered in the capture interview; the key contacts and the pitfalls are in the Expert Insights lesson.",
  community: "The community meets quarterly; the next agenda is drafted in the community folder.",
  collection: "A working collection for the operations round; keep it in step with the Vault shelves.",
  other: "See the handover note on the linked item.",
};

export default async function seedCr08Handover(): Promise<void> {
  const { db, schema } = await import("../src/server/db/client");
  const { and, eq, inArray, isNull, like } = await import("drizzle-orm");
  const { newId, nowIso } = await import("../src/lib/ids");
  const { getUserById } = await import("../src/server/auth/session");
  const handover = await import("../src/server/services/handover");
  const { CR08_GAME_RULES } = await import("./cr08-gamification-seed");

  const users = await db.select().from(schema.users).where(isNull(schema.users.deletedAt));
  const byEmail = (email: string) => users.find((u) => u.email === email) ?? null;
  const admin = byEmail("admin@npc.qa");
  const hr = byEmail("hr@npc.qa");
  if (!admin || !hr) throw new Error("seeded admin accounts missing");
  const actor = (await getUserById(hr.id))!;
  const superAdmin = (await getUserById(admin.id))!;
  const counts = { handovers: 0, items: 0, interviews: 0, lessons: 0, paths: 0, episodes: 0, filing: 0, reports: 0, notifications: 0, mapped: 0, rules: 0, polished: 0, relabelled: 0, rebuilt: 0 };

  /* the learning_path_completed rule exists (the gamification seed also inserts it) */
  for (const [eventType, points] of CR08_GAME_RULES) {
    if (eventType !== "learning_path_completed") continue;
    const [row] = await db.select({ id: schema.gameRules.id }).from(schema.gameRules).where(eq(schema.gameRules.eventType, eventType)).limit(1);
    if (!row) {
      await db.insert(schema.gameRules).values({ id: newId(), eventType, points, multiplierRulesJson: null, isActive: 1, excludedFromBoards: 0 });
      counts.rules++;
    }
  }

  const findSeeded = async (key: string) => {
    const [row] = await db.select().from(schema.handovers).where(like(schema.handovers.notes, `${MARK(key)}%`)).limit(1);
    return row ?? null;
  };
  const dateIn = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  /* ---- (d) the CR05 handovers: map kind and successor into the new columns ---- */
  const legacy = await db.select().from(schema.handovers).where(isNull(schema.handovers.updatedAt));
  for (const h of legacy) {
    await db
      .update(schema.handovers)
      .set({ personKind: "employee", lastWorkingDay: h.lastWorkingDay ?? h.dueDate, interviewRequired: 1, updatedAt: nowIso() })
      .where(eq(schema.handovers.id, h.id));
    const items = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, h.id));
    for (const i of items) {
      if (i.category) continue;
      const category =
        i.itemKind === "document" ? "document" : i.itemKind === "node_owner" ? "project_role" : i.itemKind === "node_role" ? "stakeholder_role" : i.itemKind === "indicator" ? "indicator" : i.itemKind === "lesson" ? "lesson" : i.itemKind === "expert_request" ? "expert_profile" : i.itemKind === "collection" ? "collection" : i.itemKind === "community_lead" ? "community" : "tacit_topic";
      const recipient = i.successorUserId ?? h.successorDefaultUserId;
      await db
        .update(schema.handoverItems)
        .set({
          category,
          inScope: i.status === "not_needed" ? 0 : 1,
          recipientKind: recipient ? "person" : null,
          recipientUserId: recipient,
          successorUserId: recipient,
          note: i.note ?? (i.status !== "pending" ? "Reassigned during the CR05 handover; see the successor for the working files." : null),
          addedBy: h.createdBy,
          createdAt: h.createdAt,
        })
        .where(eq(schema.handoverItems.id, i.id));
    }
    counts.mapped++;
  }

  /* ---- (a) the internal leaving handover ---- */
  const person = byEmail("ahmed.fathy@npc.qa");
  const recipient = byEmail("mohammed.alsulaiti@npc.qa");
  const unitHead = byEmail("saud.alshammari@npc.qa");
  if (person && recipient && unitHead) {
    let h = await findSeeded("a");
    if (!h) {
      // the person owns a few of the unit's seeded documents and a stakeholder role, so the inventory has substance
      const soaDocs = await db
        .select()
        .from(schema.documents)
        .where(and(eq(schema.documents.departmentId, person.departmentId ?? ""), eq(schema.documents.isSeeded, 1), isNull(schema.documents.deletedAt)));
      const ownedAlready = soaDocs.filter((d) => d.ownerUserId === person.id).length;
      if (ownedAlready < 3) {
        const knowledge = byEmail("knowledge@npc.qa");
        const pool = soaDocs.filter((d) => d.ownerUserId === knowledge?.id || d.ownerUserId === admin.id).slice(0, 3 - ownedAlready);
        for (const d of pool) await db.update(schema.documents).set({ ownerUserId: person.id }).where(eq(schema.documents.id, d.id));
      }
      const projects = await db.select().from(schema.strategyNodes).where(eq(schema.strategyNodes.nodeType, "project"));
      const roles = await db.select().from(schema.nodeStakeholders).where(eq(schema.nodeStakeholders.userId, person.id));
      if (roles.length < 2) {
        for (const p of projects.filter((x) => /PRJ-(1[0-9]|2[0-9])a/.test(x.code ?? "")).slice(0, 2 - roles.length)) {
          await db.insert(schema.nodeStakeholders).values({ id: newId(), nodeId: p.id, personKind: "employee", userId: person.id, role: "manager", roleNoteEn: "Statistical delivery lead", roleNoteAr: "مسؤول التنفيذ الإحصائي", nodeKind: "nds", sort: 5, createdAt: nowIso() });
        }
      }
      const created = await handover.startHandover2(actor, {
        person: { userId: person.id },
        kind: "leaving",
        reason: "Moving to the Gulf Cooperation Council statistical centre",
        lastWorkingDay: dateIn(21),
        dueDate: dateIn(18),
        recipient: { mode: "person", defaultRecipientUserId: recipient.id },
        notes: `${MARK("a")} Statistical operations handover with mixed recipients.`,
      });
      h = (await db.select().from(schema.handovers).where(eq(schema.handovers.id, created.id)))[0];
      counts.handovers++;
      counts.items += created.items;
      // mixed: most items to the person (notes written), a few to the system
      const items = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, h.id));
      const notes = ITEM_NOTES;
      let toSystem = 0;
      for (const i of items) {
        const sendToSystem = (i.category === "document" || i.category === "report") && toSystem < 2;
        if (sendToSystem) {
          toSystem++;
          await handover.setItemRecipient(actor, i.id, { recipientKind: "system" });
        } else {
          await handover.setItemNote({ userId: person.id, admin: false }, i.id, notes[i.category ?? "other"] ?? notes.other);
        }
      }
      // filing proposals for the system items
      counts.filing += await handover.proposeAllFiling(actor, h.id);
      // the interviews: one complete (project or general), one in progress
      const detail = await handover.getHandoverForViewer(actor, h.id);
      const topics = detail?.topics ?? [];
      const first = topics[0] ?? { topic: "General handover", refType: "topic" as const, refId: null };
      const iv1 = await handover.startInterview({ userId: person.id }, h.id, { topic: first.topic, refType: first.refType === "topic" && !first.refId ? "general" : first.refType, refId: first.refId });
      const answers = [
        "The statistical operations round for 2026 is 70 percent complete. The next milestone is the quality review on the 15th of next month, and the field teams already have their schedules.",
        "We decided in March to move the enumeration to tablets after the 2025 pilot showed a 30 percent drop in re-contacts; the Secretary General approved it and the budget came from the data programme.",
        "Inside NPC, Saud Al-Shammari owns the operations calendar and Mohammed Al-Sulaiti runs the field teams. Outside, the contact at the Ministry of Municipality is the geospatial unit head, who cares about address quality.",
        "The 2024 round slipped because the address register arrived late. Lock the register delivery date in writing and never start training before the questionnaire is frozen.",
        "The working files are in the SOA shared drive under /operations/2026, the final tables in the Vault, and the field logs in the tablet console; the data quality team holds the console admin account.",
        "Walk the field schedule with the team leads in the first week and read the 2025 lessons before touching the questionnaire.",
      ];
      for (const a of answers) await handover.answerInterview({ userId: person.id }, iv1.id, a);
      const done1 = await handover.completeInterview({ userId: person.id }, iv1.id);
      counts.interviews++;
      if (done1.insightLessonId) counts.lessons++;
      const second = topics.find((x) => x.key !== first.key) ?? { topic: "Data quality review", refType: "topic" as const, refId: null };
      const iv2 = await handover.startInterview({ userId: person.id }, h.id, { topic: second.topic, refType: second.refType === "topic" && !second.refId ? "general" : second.refType, refId: second.refId });
      await handover.answerInterview({ userId: person.id }, iv2.id, "The review checklist is versioned in the Vault; the current one is v3 and the next revision waits for the census team's comments.");
      await handover.answerInterview({ userId: person.id }, iv2.id, "We chose to keep the manual double-entry check for the first two months after the tablet rollout, because the automated rule caught only half of the coding errors in the pilot.");
      counts.interviews++;
      // the learning path for the recipient, two modules understood
      const path = await handover.buildLearningPath(h.id, recipient.id, { locale: "en", episodes: true });
      counts.paths++;
      counts.episodes += path.modules.filter((m) => m.episodeId).length;
      const recipientUser = (await getUserById(recipient.id))!;
      for (const m of path.modules.slice(0, 2)) await handover.markModuleUnderstood(recipientUser, h.id, m.id);
      counts.notifications += 3;
    }
  } else {
    console.log("cr08 handover: (a) skipped, seeded accounts missing");
  }

  /* ---- polish: items written before the per-category notes existed keep the
     generic fallback; give them their category's note and rebuild the path so
     its summaries pick the better text up. Idempotent: after one pass no item
     outside category "other" carries the fallback any more. ---- */
  {
    const generic = ITEM_NOTES.other;
    const stale = (await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.note, generic))).filter(
      (i) => i.category && ITEM_NOTES[i.category] && ITEM_NOTES[i.category] !== generic
    );
    for (const i of stale) {
      await db.update(schema.handoverItems).set({ note: ITEM_NOTES[i.category!] }).where(eq(schema.handoverItems.id, i.id));
    }
    if (stale.length) {
      counts.polished = stale.length;
      const touched = [...new Set(stale.map((i) => i.handoverId))];
      for (const hid of touched) {
        const paths = await db.select().from(schema.handoverLearningPaths).where(eq(schema.handoverLearningPaths.handoverId, hid));
        for (const p of paths) await handover.buildLearningPath(hid, p.recipientUserId, { episodes: false });
      }
    }
  }

  /* ---- polish: a stakeholder role item written before the role labels
     existed carries the raw enum in its title ("team: PRJ-01a ..."), which
     the successor reads on the checklist and inside the module summary.
     Relabel those rows, then rebuild any learning path whose stored summary
     still shows the raw token or the interview tail that the module text no
     longer quotes twice. Idempotent: after one pass nothing matches. ---- */
  {
    const RAW = ["sponsor", "owner", "manager", "team", "expert", "external_partner"];
    const roleItems = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.category, "stakeholder_role"));
    const touched = new Set<string>();
    for (const i of roleItems) {
      const raw = RAW.find((r) => i.title.startsWith(`${r}: `));
      if (!raw) continue;
      await db
        .update(schema.handoverItems)
        .set({ title: `${handover.roleLabel(raw).en}: ${i.title.slice(raw.length + 2)}` })
        .where(eq(schema.handoverItems.id, i.id));
      touched.add(i.handoverId);
      counts.relabelled++;
    }
    const allPaths = await db.select().from(schema.handoverLearningPaths);
    for (const p of allPaths) {
      const mods = JSON.parse(p.modulesJson) as { textVersion?: number }[];
      const stale = touched.has(p.handoverId) || mods.some((m) => (m.textVersion ?? 0) < handover.PATH_TEXT_VERSION);
      if (!stale) continue;
      await handover.buildLearningPath(p.handoverId, p.recipientUserId, { episodes: false });
      counts.rebuilt++;
    }
  }

  /* ---- (b) the external engagement-ending handover ---- */
  const external = (await db.select().from(schema.experts).where(and(eq(schema.experts.type, "consultant"), like(schema.experts.nameEn, "%Tariq Al-Farsi%"))))[0] ?? null;
  if (external) {
    let h = await findSeeded("b");
    if (!h) {
      const created = await handover.startHandover2(superAdmin, {
        person: { expertId: external.id },
        kind: "engagement_ending",
        reason: "Advisory contract ends with the statistical modernisation phase",
        lastWorkingDay: dateIn(12),
        dueDate: dateIn(10),
        recipient: { mode: "system", defaultRecipientUserId: null },
        notes: `${MARK("b")} External advisory engagement ending; deliverables filed to the Institutional Memory.`,
      });
      h = (await db.select().from(schema.handovers).where(eq(schema.handovers.id, created.id)))[0];
      counts.handovers++;
      counts.items += created.items;
      // the project owner is the default recipient for anything sent to a person
      const owner = await (async () => {
        const rows = await db.select().from(schema.nodeStakeholders).where(eq(schema.nodeStakeholders.expertId, external.id));
        for (const r of rows) {
          const owners = await db.select().from(schema.nodeStakeholders).where(and(eq(schema.nodeStakeholders.nodeId, r.nodeId), eq(schema.nodeStakeholders.role, "owner")));
          const u = owners.find((o) => o.userId);
          if (u?.userId) return u.userId;
        }
        return null;
      })();
      if (owner) await db.update(schema.handovers).set({ successorDefaultUserId: owner }).where(eq(schema.handovers.id, h.id));
      // an uploaded deliverable note through the access link path
      const token = await handover.createAccessLink(superAdmin, h.id);
      console.log(`cr08 handover: (b) access link (plain token shown once here only): /handover/access/${token.token}`);
      await handover.addItemViaToken(token.token, {
        title: "Modernisation advisory: closing memorandum",
        note: "Summarises the recommendations of the advisory phase and where each working paper is filed.",
        text: "Closing memorandum of the statistical modernisation advisory engagement. The sampling redesign, the tablet enumeration protocol and the quality framework are delivered; the open recommendation is the address register integration, owned by the operations department.",
      });
      counts.items++;
      const items = await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, h.id));
      for (const i of items) {
        await handover.setItemNote({ userId: null, admin: false }, i.id, "Delivered and accepted; the final version is in the Vault and the working files were returned to the project owner.");
      }
      counts.filing += await handover.proposeAllFiling(superAdmin, h.id);
      const proposed = (await db.select().from(schema.handoverItems).where(eq(schema.handoverItems.handoverId, h.id))).filter((i) => i.filingStatus === "proposed");
      if (proposed[0]) await handover.approveFiling(superAdmin, h.id, [proposed[0].id]);
      counts.notifications += 2;
    }
  } else {
    console.log("cr08 handover: (b) skipped, the external expert is missing");
  }

  /* ---- (c) a closed handover with the report archived, cut off, points paid ---- */
  const transferring = byEmail("nasser.almannai@npc.qa");
  if (transferring) {
    const rows = await db.select().from(schema.handovers).where(eq(schema.handovers.userId, transferring.id));
    const target = rows.find((r) => (r.notes ?? "").startsWith(MARK("c"))) ?? rows.find((r) => r.kind === "transferring") ?? null;
    if (target && !target.reportDocumentId) {
      await db.update(schema.handovers).set({ notes: `${MARK("c")} ${target.notes ?? ""}`.trim(), status: target.completedAt ? "complete" : target.status, completedAt: null, updatedAt: nowIso() }).where(eq(schema.handovers.id, target.id));
      // reopen for the close so the report and the points come through the real path
      await db.update(schema.handovers).set({ status: "in_progress", completedAt: null }).where(eq(schema.handovers.id, target.id));
      const closed = await handover.closeHandover(superAdmin, target.id, { override: "Legacy CR05 handover: every item was reassigned before the CR08 rebuild; the recipients confirmed by email." });
      if (closed.reportDocumentId) counts.reports++;
      else console.log(`cr08 handover: (c) report not rendered: ${closed.reportError}`);
      await handover.performCutOff(superAdmin, target.id);
      // the person keeps a usable seeded account: the cut-off's login lock is lifted for the demo
      await db.update(schema.users).set({ lockedUntil: null }).where(eq(schema.users.id, transferring.id));
      counts.notifications += 2;
    }
  }

  const all = await db.select().from(schema.handovers);
  const items = await db.select({ id: schema.handoverItems.id }).from(schema.handoverItems).where(inArray(schema.handoverItems.handoverId, all.map((h) => h.id)));
  const interviews = await db.select({ id: schema.handoverInterviews.id }).from(schema.handoverInterviews);
  const paths = await db.select({ id: schema.handoverLearningPaths.id }).from(schema.handoverLearningPaths);
  console.log(
    `cr08 handover: created ${counts.handovers} handovers, ${counts.items} items, ${counts.interviews} interviews, ${counts.lessons} insight lessons, ${counts.paths} paths, ${counts.episodes} episodes, ${counts.filing} filing proposals, ${counts.reports} reports; ${counts.mapped} legacy rows mapped, ${counts.polished} notes polished, ${counts.relabelled} roles relabelled, ${counts.rebuilt} paths rebuilt; ${counts.rules} rules added. Totals: ${all.length} handovers, ${items.length} items, ${interviews.length} interviews, ${paths.length} paths.`
  );
}

const isMain = process.argv[1] && /cr08-handover-seed\.ts$/.test(process.argv[1]);
if (isMain) {
  seedCr08Handover()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
