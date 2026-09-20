// CR08 4: index group tools for Ask NPC. get_index_groups lists the nine
// groups with their counts and summary strips, query_index_group lists one
// group's members with Qatar's latest values, get_sdg_scores returns the 17
// goal scores and the SDG Index headline. Every line registers a source the
// way tools.ts's get_index does (resource_type "index", resource_id = code),
// groups register as "index_group".
import type { ToolContext } from "../tools";
import type { ToolModule } from "./types";
import { getIndicesBoard, type BoardCard, type BoardGroup } from "@/server/services/indices";
import { SDG_GOALS } from "@/lib/sdg-colours";

const PORTAL = "indices";

function registerIndex(ctx: ToolContext, c: BoardCard): number {
  const excerpt = c.qatar
    ? `Qatar ${c.qatar.year}: ${c.qatar.rank != null ? `rank ${c.qatar.rank}${c.qatar.total ? ` of ${c.qatar.total}` : ""}` : ""}${
        c.qatar.score != null ? ` score ${c.qatar.score}` : ""
      }`.trim()
    : "no published value";
  return ctx.state.addSource({
    resource_type: "index",
    resource_id: c.code,
    title: `${c.nameEn} (${c.statistics ? "Statistics Hub" : c.publisher ?? ""})`,
    page: null,
    excerpt: excerpt.slice(0, 240),
    verified: true,
  });
}

function registerGroup(ctx: ToolContext, g: BoardGroup): number {
  return ctx.state.addSource({
    resource_type: "index_group",
    resource_id: g.code,
    title: `Index group: ${g.nameEn}`,
    page: null,
    excerpt: (g.descriptionEn ?? `${g.cards.length} indices`).slice(0, 240),
    verified: true,
  });
}

function valueLine(c: BoardCard): string {
  if (!c.qatar) return "no published value";
  const parts: string[] = [`${c.qatar.year}`];
  if (c.qatar.rank != null) parts.push(`#${c.qatar.rank}${c.qatar.total ? `/${c.qatar.total}` : ""}`);
  if (c.qatar.score != null) parts.push(`score ${c.qatar.score}${c.statistics?.unit ? ` ${c.statistics.unit}` : ""}`);
  if (c.change != null && c.change !== 0) {
    parts.push(
      c.changeKind === "rank"
        ? `${c.change > 0 ? "up" : "down"} ${Math.abs(c.change)} place${Math.abs(c.change) === 1 ? "" : "s"}`
        : `${c.change > 0 ? "improved" : "declined"} ${Math.abs(c.change).toFixed(2)}`
    );
  }
  if (c.gccPosition) parts.push(`GCC position ${c.gccPosition} of ${c.gccCount}`);
  if (c.target) {
    parts.push(
      `target ${c.target.value}${c.target.year ? ` by ${c.target.year}` : ""}${
        c.target.gap == null ? "" : c.target.met ? " (met)" : ` (${c.target.gap} to go)`
      }`
    );
  }
  if (c.forecastDirection) parts.push(`SiaNexus 3y forecast direction ${c.forecastDirection}`);
  else if (!c.forecastEnabled) parts.push("forecast off");
  return parts.join(", ");
}

function summaryLine(g: BoardGroup): string {
  return `${g.cards.length} indices: ${g.summary.improving} improving, ${g.summary.stable} stable, ${g.summary.declining} declining, Qatar leads the GCC in ${g.summary.gccLead}`;
}

function findGroup(groups: BoardGroup[], needle: string): BoardGroup | null {
  const q = needle.trim().toLowerCase();
  if (!q) return null;
  return (
    groups.find((g) => g.code === q) ??
    groups.find((g) => g.nameEn.toLowerCase() === q || g.nameAr === needle.trim()) ??
    groups.find((g) => g.nameEn.toLowerCase().includes(q) || g.nameAr.includes(needle.trim())) ??
    groups.find((g) => (g.descriptionEn ?? "").toLowerCase().includes(q)) ??
    null
  );
}

/* ---- get_index_groups ---- */
async function toolGetIndexGroups(ctx: ToolContext): Promise<string> {
  const board = await getIndicesBoard(ctx.user);
  if (!board.groups.length) return "No index groups have been set up yet.";
  const lines = board.groups.map((g) => {
    const n = registerGroup(ctx, g);
    const members = g.cards.map((c) => c.code).join(", ") || "none yet";
    return `[${n}] ${g.code}: ${g.nameEn} / ${g.nameAr}. ${summaryLine(g)}. Members: ${members}.`;
  });
  const head = [
    `${board.groups.length} index groups on the Indices board (${board.cards.length} active indices; across the board ${board.summary.improving} improving, ${board.summary.stable} stable, ${board.summary.declining} declining, GCC leads ${board.summary.gccLead}).`,
  ];
  if (board.sdgHeadline) {
    head.push(
      `SDG Index headline (${board.sdgHeadline.year}): Qatar score ${board.sdgHeadline.score ?? "-"}${
        board.sdgHeadline.rank != null ? `, rank ${board.sdgHeadline.rank}${board.sdgHeadline.total ? ` of ${board.sdgHeadline.total}` : ""}` : ""
      }.`
    );
  }
  if (board.ungrouped.length) head.push(`Not in any group: ${board.ungrouped.map((c) => c.code).join(", ")}.`);
  return [...head, ...lines].join("\n");
}

/* ---- query_index_group ---- */
async function toolQueryIndexGroup(
  ctx: ToolContext,
  input: { group?: string; sort?: string }
): Promise<string> {
  const board = await getIndicesBoard(ctx.user);
  const group = findGroup(board.groups, input.group ?? "");
  if (!group) {
    return `Unknown group. The groups are: ${board.groups.map((g) => `${g.code} (${g.nameEn})`).join(", ")}.`;
  }
  const gn = registerGroup(ctx, group);
  const cards = [...group.cards];
  const sort = (input.sort ?? "rank").toLowerCase();
  if (sort === "change") cards.sort((a, b) => (b.change ?? -999) - (a.change ?? -999));
  else if (sort === "name") cards.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  else if (sort === "goal") cards.sort((a, b) => (a.sdgGoal ?? 99) - (b.sdgGoal ?? 99));
  else cards.sort((a, b) => (a.qatar?.rank ?? 9999) - (b.qatar?.rank ?? 9999));
  if (!cards.length) return `[${gn}] Group ${group.nameEn} has no indices yet.`;
  const lines = cards.map((c) => {
    const n = registerIndex(ctx, c);
    const goal = c.sdgGoal != null ? `SDG ${c.sdgGoal} ` : "";
    return `[${n}] ${goal}${c.code}: ${c.nameEn} (${c.statistics ? "Statistics Hub" : c.publisher ?? "-"}) Qatar ${valueLine(c)}${
      c.groupCodes.length > 1 ? `; also in ${c.groupCodes.filter((x) => x !== group.code).join(", ")}` : ""
    }`;
  });
  return [
    `[${gn}] Group ${group.code}: ${group.nameEn} / ${group.nameAr}. ${summaryLine(group)}. Sorted by ${sort}.`,
    ...lines,
  ].join("\n");
}

/* ---- get_sdg_scores ---- */
async function toolGetSdgScores(ctx: ToolContext): Promise<string> {
  const board = await getIndicesBoard(ctx.user);
  const goals = board.cards
    .filter((c) => c.sdgGoal != null)
    .sort((a, b) => (a.sdgGoal ?? 0) - (b.sdgGoal ?? 0));
  if (!goals.length && !board.sdgHeadline) {
    return "No SDG scores have been recorded yet (the SDG group is empty).";
  }
  const lines: string[] = [];
  if (board.sdgHeadline) {
    const n = ctx.state.addSource({
      resource_type: "index",
      resource_id: board.sdgHeadline.code,
      title: "SDG Index (Sustainable Development Report, SDSN)",
      page: null,
      excerpt: `Qatar ${board.sdgHeadline.year}: score ${board.sdgHeadline.score ?? "-"}${
        board.sdgHeadline.rank != null ? `, rank ${board.sdgHeadline.rank}${board.sdgHeadline.total ? ` of ${board.sdgHeadline.total}` : ""}` : ""
      }`,
      verified: true,
    });
    lines.push(
      `[${n}] SDG Index ${board.sdgHeadline.year}: Qatar overall score ${board.sdgHeadline.score ?? "-"} of 100${
        board.sdgHeadline.rank != null ? `, rank ${board.sdgHeadline.rank}${board.sdgHeadline.total ? ` of ${board.sdgHeadline.total}` : ""}` : ""
      }.${board.sdgHeadline.sourceUrl ? ` Source: ${board.sdgHeadline.sourceUrl}` : ""}`
    );
  }
  for (const c of goals) {
    const n = registerIndex(ctx, c);
    const g = SDG_GOALS.find((x) => x.n === c.sdgGoal);
    lines.push(`[${n}] Goal ${c.sdgGoal} ${g?.shortEn ?? c.nameEn}: Qatar ${valueLine(c)}`);
  }
  const scored = goals.filter((c) => c.qatar?.score != null);
  if (scored.length) {
    const best = [...scored].sort((a, b) => (b.qatar!.score ?? 0) - (a.qatar!.score ?? 0));
    lines.push(
      `Strongest goals: ${best.slice(0, 3).map((c) => `SDG ${c.sdgGoal} (${c.qatar!.score})`).join(", ")}. Weakest: ${best
        .slice(-3)
        .reverse()
        .map((c) => `SDG ${c.sdgGoal} (${c.qatar!.score})`)
        .join(", ")}.`
    );
  }
  lines.push("Goal scores are published figures from the Sustainable Development Report; forecast directions are SiaNexus model outputs.");
  return lines.join("\n");
}

const mod: ToolModule = {
  definitions: [
    {
      name: "get_index_groups",
      description:
        "The Indices board's groups (SDGs, National Indicators, Competitiveness, Gallup, Governance, Human Development, Environment, Peace, Digital) with member counts, each group's improving/stable/declining/GCC-leads summary, and the SDG Index headline.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "query_index_group",
      description:
        "The members of one index group with Qatar's latest published value, change, GCC standing, target and forecast direction. Pass the group code (sdg, national, competitiveness, gallup, governance, human, environment, peace, digital) or its name.",
      input_schema: {
        type: "object",
        properties: {
          group: { type: "string", description: "Group code or name" },
          sort: { type: "string", enum: ["rank", "change", "name", "goal"] },
        },
        required: ["group"],
      },
    },
    {
      name: "get_sdg_scores",
      description:
        "Qatar's 17 Sustainable Development Goal scores from the Sustainable Development Report with the overall SDG Index score and rank, strongest and weakest goals.",
      input_schema: { type: "object", properties: {} },
    },
  ],
  portal: {
    get_index_groups: PORTAL,
    query_index_group: PORTAL,
    get_sdg_scores: PORTAL,
  },
  run: async (ctx, name, input) => {
    switch (name) {
      case "get_index_groups":
        return toolGetIndexGroups(ctx);
      case "query_index_group":
        return toolQueryIndexGroup(ctx, input as { group?: string; sort?: string });
      case "get_sdg_scores":
        return toolGetSdgScores(ctx);
      default:
        return null;
    }
  },
};

export default mod;
