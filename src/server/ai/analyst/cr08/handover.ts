// CR08 6: handover tools for Ask NPC. get_my_handover (the caller's own
// open handover), get_handovers_in_scope (administrators: open handovers
// with readiness), get_learning_path (the caller's path progress). Interview
// transcripts of other people are never exposed: the tools return counts,
// statuses and the caller's own summaries only.
import type { ToolModule } from "./types";
import { getMyHandover, getLearningPath, getMyRecipientHandovers, listHandovers } from "@/server/services/handover";

const mod: ToolModule = {
  definitions: [
    {
      name: "get_my_handover",
      description:
        "The caller's own open handover (when they are leaving, transferring, or going on long leave): the kind, the last working day, progress on items and interviews, what is still required, and the checklist by category. Use for questions like 'what is left in my handover' or 'when is my last working day'.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "get_handovers_in_scope",
      description:
        "For HR Admins, Super Admins, Department Heads and project owners: the open handovers they may see, each with the person, the kind, the last working day, progress and whether it is ready to close. Use for 'which handovers are at risk', 'who is leaving this month', 'is X's handover ready'.",
      input_schema: {
        type: "object",
        properties: {
          status: { type: "string", description: "open | in_progress | overdue | complete; omit for every open one" },
          kind: { type: "string", description: "leaving | transferring | long_leave | engagement_ending" },
        },
      },
    },
    {
      name: "get_learning_path",
      description:
        "The caller's Handover Learning Path as a recipient: the modules with their topic, the documents and lessons to read, which are understood, the overall percentage and the sign-off. Use for 'what do I still need to learn from X's handover'.",
      input_schema: { type: "object", properties: { handover_id: { type: "string", description: "optional; the first open path when omitted" } } },
    },
  ],
  portal: { get_my_handover: "handover", get_handovers_in_scope: "hr", get_learning_path: "handover" },
  async run(ctx, name, input) {
    if (name === "get_my_handover") {
      const mine = await getMyHandover(ctx.user);
      if (!mine) return "You have no handover of your own. Recipients see their learning path through get_learning_path.";
      const n = ctx.state.addSource({ resource_type: "handover", resource_id: mine.id, title: `Handover of ${mine.person.nameEn}`, page: null, excerpt: `${mine.kind}, ${mine.status}`, verified: false });
      const lines = [
        `[${n}] Your handover (${mine.kind.replace("_", " ")}) is ${mine.status}. Last working day: ${mine.lastWorkingDay ?? "not set"}${mine.daysToLastWorkingDay !== null ? ` (${mine.daysToLastWorkingDay} days left)` : ""}; due ${mine.dueDate ?? "not set"}.`,
        `Items: ${mine.progress.items.done}/${mine.progress.items.total} done (${mine.progress.items.pct}%). Interviews: ${mine.progress.interviews.complete}/${mine.progress.interviews.total}${mine.interviewRequired ? " (mandatory)" : ""}.`,
        mine.required.length ? `Still required: ${mine.required.map((r) => r.replace(/_/g, " ")).join(", ")}.` : "Nothing is required from you right now.",
        ...mine.categories.map((c) => `${c.code.replace(/_/g, " ")}: ${c.items.length} items, ${c.items.filter((i) => i.status !== "pending").length} done, ${c.items.filter((i) => i.recipientKind === "person" && !(i.note ?? "").trim()).length} without a note`),
      ];
      return lines.join("\n");
    }
    if (name === "get_handovers_in_scope") {
      const list = await listHandovers(ctx.user);
      if (!list) return "You do not administer any handovers.";
      let rows = list.rows;
      const status = typeof input.status === "string" ? input.status : null;
      const kind = typeof input.kind === "string" ? input.kind : null;
      rows = status ? rows.filter((r) => r.status === status) : rows.filter((r) => r.status !== "complete");
      if (kind) rows = rows.filter((r) => r.kind === kind);
      if (!rows.length) return "No handovers match that scope.";
      const lines = rows.slice(0, 20).map((r) => {
        const n = ctx.state.addSource({ resource_type: "handover", resource_id: r.id, title: `Handover of ${r.person.nameEn}`, page: null, excerpt: `${r.kind}, ${r.status}`, verified: false });
        const who = r.person.kind === "external" ? `${r.person.nameEn} (external, ${r.person.organisationEn ?? "no organisation"})` : `${r.person.nameEn} (${r.person.departmentNameEn ?? "no unit"})`;
        return `[${n}] ${who}: ${r.kind.replace("_", " ")}, ${r.status}, last working day ${r.lastWorkingDay ?? "not set"}${r.daysToLastWorkingDay !== null ? ` (${r.daysToLastWorkingDay} days)` : ""}, items ${r.items.done}/${r.items.total}, interviews ${r.interviews.complete}/${r.interviews.total}, recipients ${r.recipients.map((x) => x.nameEn).join(", ") || "the system"}, ${r.readiness ? "READY to close" : "not ready"}${r.cutOffAt ? ", cut off" : ""}.`;
      });
      return [`${rows.length} handover(s) in your scope${rows.length > 20 ? " (first 20 shown)" : ""}:`, ...lines].join("\n");
    }
    if (name === "get_learning_path") {
      const handoverId = typeof input.handover_id === "string" ? input.handover_id : null;
      const mine = await getMyRecipientHandovers(ctx.user);
      const target = handoverId ? mine.find((m) => m.id === handoverId) : mine.find((m) => m.status !== "complete" && !m.signedOffAt) ?? mine[0];
      if (!target) return "You are not a recipient of any handover.";
      const path = await getLearningPath(ctx.user, target.id);
      const n = ctx.state.addSource({ resource_type: "handover", resource_id: target.id, title: `Handover of ${target.person.nameEn}`, page: null, excerpt: `learning path`, verified: false });
      if (!path) return `[${n}] You receive ${target.items} items from ${target.person.nameEn}'s handover; the learning path has not been built yet.`;
      const lines = path.modules.map(
        (m, i) =>
          `${i + 1}. ${m.topic}: ${m.understoodAt ? "understood" : "open"}; ${m.documents.length} documents (${m.documents.map((d) => d.titleEn).slice(0, 3).join("; ")}), ${m.lessons.length} lessons, ${m.notes.length} notes${m.episodeId ? ", episode available" : ""}. Check question: ${m.checkQuestion.en}`
      );
      return [
        `[${n}] Learning path from ${target.person.nameEn}'s handover: ${path.progress.understood}/${path.progress.total} modules understood (${path.progress.pct}%)${path.signedOffAt ? `, signed off ${path.signedOffAt.slice(0, 10)}` : ", not signed off"}.`,
        ...lines,
      ].join("\n");
    }
    return null;
  },
};

export default mod;
