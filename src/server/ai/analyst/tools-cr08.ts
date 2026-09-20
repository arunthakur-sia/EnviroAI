// CR08 11: the new modules' analyst tools, aggregated. Each module owns its
// file under ./cr08/ and never edits tools.ts.
import type { ToolContext } from "./tools";
import type { ToolModule } from "./cr08/types";
import organisation from "./cr08/organisation";
import experts from "./cr08/experts";
import indices from "./cr08/indices";
import reports from "./cr08/reports";
import handover from "./cr08/handover";
import leaderboard from "./cr08/leaderboard";
import kow from "./cr08/kow";
import messaging from "./cr08/messaging";
import operatingModel from "./cr08/operating-model";

const MODULES: ToolModule[] = [
  organisation,
  experts,
  indices,
  reports,
  handover,
  leaderboard,
  kow,
  messaging,
  operatingModel,
];

export const CR08_TOOLS = MODULES.flatMap((m) => m.definitions);

export const CR08_TOOL_PORTAL: Record<string, string> = Object.assign(
  {},
  ...MODULES.map((m) => m.portal)
);

export async function runCr08Tool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<string | null> {
  for (const m of MODULES) {
    if (m.definitions.some((d) => d.name === name)) return m.run(ctx, name, input);
  }
  return null;
}
