// CR08 7: leaderboard tools (top people or departments for a period).
// Owned by the Gamification agent. One tool, get_leaderboard, reads the
// materialised table through the same service as the page, so Ask EnviroAI and
// the board can never disagree, and it respects the viewer: top five only,
// hidden in quiet mode, administrator accounts unranked.
import type { ToolModule } from "./types";
import { describeBoard, getLeaderboard } from "@/server/services/leaderboard";
import { isBoardKind, isCategory, isPeriodKind } from "@/lib/leaderboard-math";

const mod: ToolModule = {
  definitions: [
    {
      name: "get_leaderboard",
      description:
        "CR08 7.2: the top five of the EnviroAI leaderboard for a period, from the materialised board (refreshed every ten minutes, never live). board: people (colleagues) or departments (organisation units, ranked by points per member). window: week, month, quarter, year or all. category: overall, contributors (uploads, answers, lessons, verified work), guardians (verification and review), learners (reading, listening, quizzes). Returns the ranked lines, the period, the refresh time and the asker's own position. Say the board is hidden when the tool says so (quiet mode).",
      input_schema: {
        type: "object",
        properties: {
          board: { type: "string", enum: ["people", "departments"] },
          window: { type: "string", enum: ["week", "month", "quarter", "year", "all"] },
          category: {
            type: "string",
            enum: ["overall", "contributors", "guardians", "learners"],
          },
        },
      },
    },
  ],
  portal: { get_leaderboard: "leaderboard" },
  run: async (ctx, name, input) => {
    if (name !== "get_leaderboard") return null;
    const board = isBoardKind(input.board) ? input.board : "people";
    const window = isPeriodKind(input.window) ? input.window : "month";
    const category = isCategory(input.category) ? input.category : "overall";
    const view = await getLeaderboard(ctx.user, { board, window, category });
    if (view.hidden) {
      return "The leaderboard is hidden for this person: quiet mode is on, so their own view of the board is switched off (their points still count). Say so plainly and offer the profile page to switch quiet mode off; do not list any ranking.";
    }
    return describeBoard(view, 5);
  },
};

export default mod;
