// CR08: every new module registers its analyst tools through one small shape,
// so tools-cr08.ts can aggregate them without the modules touching tools.ts.
import type { ToolContext } from "../tools";

export type ToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type ToolModule = {
  definitions: ToolDef[];
  /** tool name -> portal key that must be visible for the caller */
  portal: Record<string, string>;
  /** returns null when the name is not one of this module's tools */
  run: (ctx: ToolContext, name: string, input: Record<string, unknown>) => Promise<string | null>;
};

export const emptyModule = (): ToolModule => ({
  definitions: [],
  portal: {},
  run: async () => null,
});
