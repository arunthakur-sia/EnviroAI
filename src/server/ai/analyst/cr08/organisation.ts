// CR08 1: organisation tools. The editable levels in order, the open change
// requests (Super Admin only), and the structure snapshots (Super Admin only).
// CR07's get_org_unit, query_org and get_unit_policies stay in tools-cr07.ts.
import { can } from "@/server/auth/permissions";
import {
  getOrgLevels,
  listChangeRequests,
  listSnapshots,
} from "@/server/services/organisation";
import type { ToolModule } from "./types";

const mod: ToolModule = {
  definitions: [
    {
      name: "get_org_levels",
      description:
        "The levels of the National Planning Council's organisational structure in order from the top (for example Secretary General, Sector, Office, Department, Section), as the Super Admin has defined them, with their bilingual names and codes.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "get_org_change_requests",
      description:
        "Change requests that unit heads have filed against the organisational structure (what they ask to change and why), with their status. Only a Super Admin may read them; pass status = open | resolved | declined, default open.",
      input_schema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "resolved", "declined", "all"] },
          unit: { type: "string", description: "a unit code to narrow to" },
        },
      },
    },
    {
      name: "get_org_snapshots",
      description:
        "The most recent snapshots of the organisational structure (one is taken on every structural save), with who took them and why. Super Admin only.",
      input_schema: { type: "object", properties: { limit: { type: "number" } } },
    },
  ],
  portal: {
    get_org_levels: "organisation",
    get_org_change_requests: "organisation",
    get_org_snapshots: "organisation",
  },
  async run(ctx, name, input) {
    if (name === "get_org_levels") {
      const levels = await getOrgLevels();
      return [
        `The organisational structure has ${levels.length} levels, from the top:`,
        ...levels.map((l, i) => `${i + 1}. ${l.nameEn} / ${l.nameAr} (code ${l.code})`),
      ].join("\n");
    }
    if (name === "get_org_change_requests") {
      if (!can(ctx.user, "manage", "settings")) {
        return "Only a Super Admin may read the organisation change requests.";
      }
      const status = typeof input.status === "string" && input.status !== "all" ? input.status : undefined;
      let rows = await listChangeRequests({ status: status ?? (input.status === "all" ? undefined : "open"), limit: 50 });
      if (typeof input.unit === "string" && input.unit.trim()) {
        const needle = input.unit.trim().toLowerCase();
        rows = rows.filter((r) => r.unitCode.toLowerCase() === needle || r.unitNameEn.toLowerCase().includes(needle));
      }
      if (!rows.length) return "No organisation change requests match that scope.";
      return [
        `${rows.length} organisation change requests (Internal, Settings > Organisation):`,
        ...rows.map(
          (r) =>
            `${r.status.toUpperCase()} | ${r.unitCode} ${r.unitNameEn}: "${r.what.slice(0, 220)}"${r.why ? ` because "${r.why.slice(0, 160)}"` : ""}, requested by ${r.requesterEn} on ${r.createdAt.slice(0, 10)}${r.resolvedAt ? `, ${r.status} on ${r.resolvedAt.slice(0, 10)}` : ""}`
        ),
      ].join("\n");
    }
    if (name === "get_org_snapshots") {
      if (!can(ctx.user, "manage", "settings")) {
        return "Only a Super Admin may read the organisation snapshots.";
      }
      const limit = typeof input.limit === "number" ? Math.min(30, Math.max(1, input.limit)) : 10;
      const rows = await listSnapshots(limit);
      if (!rows.length) return "No structure snapshot has been taken yet.";
      return [
        `${rows.length} most recent structure snapshots:`,
        ...rows.map(
          (s) => `${s.takenAt.slice(0, 16).replace("T", " ")} by ${s.takenByName ?? "the seed"}: ${s.note ?? "no note"} (${s.unitCount} units)`
        ),
      ].join("\n");
    }
    return null;
  },
};

export default mod;
