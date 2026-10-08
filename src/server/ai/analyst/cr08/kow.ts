// CR08 8: Knowledge of the Week tool. `get_knowledge_of_week` answers with
// this week's pick and the last four archived ones through the same service
// as the Hall page, so Ask EnviroAI and the Hall never disagree. Each pick's item
// is registered as a source (a study is a document) so the answer can cite
// it; items above the asker's clearance never reach the model.
import type { ToolModule } from "./types";
import { getHallOfKnowledge, type KowCard } from "@/server/services/knowledge-of-week";

const mod: ToolModule = {
  definitions: [
    {
      name: "get_knowledge_of_week",
      description:
        "CR08 8: the Office's Knowledge of the Week: this week's pick (a verified document, lesson, study or report chosen by a Knowledge Admin, opened on Home for everyone) and the last four picks from the Hall of Knowledge. Each line carries the week, the item and its kind, the contributor and their unit, the administrator's note on why it was chosen, and how many colleagues read it. Use it for questions like 'what is this week's knowledge', 'who was featured recently', 'what should I read this week'. Cite the item.",
      input_schema: {
        type: "object",
        properties: {
          past: {
            type: "integer",
            description: "How many past picks to include after the current one (default 4, at most 8).",
          },
        },
      },
    },
  ],
  portal: { get_knowledge_of_week: "vault" },
  run: async (ctx, name, input) => {
    if (name !== "get_knowledge_of_week") return null;
    const past = Math.max(0, Math.min(8, Number(input.past ?? 4) || 4));
    const hall = await getHallOfKnowledge(ctx.user);
    const archived = hall.months.flatMap((m) => m.items).slice(0, past);

    const line = (card: KowCard, label: string): string => {
      const n = ctx.state.addSource({
        resource_type: card.resourceType === "study" ? "document" : card.resourceType,
        resource_id: card.resourceId,
        title: card.titleEn,
        page: null,
        excerpt: (card.summaryEn ?? card.noteEn ?? "").slice(0, 240),
        classification: card.classificationLevel,
        verified: true,
      });
      const who = card.contributor
        ? `${card.contributor.nameEn}${card.contributor.positionEn ? `, ${card.contributor.positionEn}` : ""}${card.contributor.unitNameEn ? ` (${card.contributor.unitNameEn})` : ""}`
        : "contributor not recorded";
      return [
        `[${n}] ${label} | week of ${card.weekStart} | ${card.resourceType} "${card.titleEn}" / "${card.titleAr}"`,
        `  Contributor: ${who}`,
        card.noteEn ? `  Why it was chosen: ${card.noteEn.slice(0, 300)}` : "",
        card.summaryEn ? `  Summary: ${card.summaryEn.slice(0, 300)}` : "",
        `  Read by ${card.readCount} colleague${card.readCount === 1 ? "" : "s"}${card.illustrative ? " (illustrative seed data)" : ""}`,
        `  Open: ${card.href}`,
      ]
        .filter(Boolean)
        .join("\n");
    };

    const out: string[] = [];
    if (hall.current) out.push(line(hall.current, "THIS WEEK"));
    else out.push("No Knowledge of the Week is active this week (no pick was set, or it is above the asker's clearance).");
    if (archived.length) {
      out.push(`Past picks (${archived.length}, newest first):`);
      for (const c of archived) out.push(line(c, "PAST"));
    } else {
      out.push("No past picks in the Hall of Knowledge yet.");
    }
    out.push("Hall of Knowledge: /hall-of-knowledge. Readers earn 10 points once for reading the current pick in full; the contributor earned 150 and the permanent Knowledge of the Week award, their unit 100 on the Departments board.");
    return out.join("\n");
  },
};

export default mod;
