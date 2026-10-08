// CR08 10.3: get_operating_model(section), get_process(code), get_interfaces(unit).
// Each tool reads through the operating-model service (so document visibility
// and portal rules hold), registers its sources for citations and returns
// compact text. While the seeded content is illustrative the source line says
// "EnviroAI Operating Model, illustrative data", the way the Office tools do.
import type { ToolContext } from "../tools";
import type { ToolModule } from "./types";
import {
  OPERATING_MODEL_SECTIONS,
  getCalendar,
  getGovernance,
  getOperatingModel,
  getOpsKpis,
  getPrinciples,
  getProcess,
  getUnitInterfaces,
  type OperatingModelSection,
  type ProcessMapNode,
  type ProcessSummary,
} from "@/server/services/operating-model";
import { findUnit } from "@/server/services/organisation";

const ILLUSTRATIVE = "EnviroAI Operating Model, illustrative data";
const REAL = "EnviroAI Operating Model";

function sourceLabel(illustrative: boolean): string {
  return illustrative ? ILLUSTRATIVE : REAL;
}

function sectionSource(ctx: ToolContext, section: string, title: string, excerpt: string, illustrative: boolean): number {
  return ctx.state.addSource({
    resource_type: "operating_model",
    resource_id: section,
    title: `${title} (${sourceLabel(illustrative)})`,
    page: null,
    excerpt: excerpt.slice(0, 240),
    verified: false,
  });
}

function processSource(ctx: ToolContext, p: ProcessSummary): number {
  return ctx.state.addSource({
    resource_type: "process",
    resource_id: p.id,
    title: `${p.code} ${p.nameEn}`,
    page: null,
    excerpt: (p.purposeEn ?? "").slice(0, 240),
    verified: false,
  });
}

function owner(p: ProcessSummary): string {
  return p.ownerUnit ? `${p.ownerUnit.code} ${p.ownerUnit.nameEn}` : "unassigned";
}

/* ---- get_operating_model ---- */
async function toolGetOperatingModel(ctx: ToolContext, input: { section?: string }): Promise<string> {
  const raw = (input.section ?? "all").trim().toLowerCase();
  const section = (OPERATING_MODEL_SECTIONS as readonly string[]).includes(raw) ? (raw as OperatingModelSection) : null;

  if (!section) {
    const model = await getOperatingModel(ctx.user);
    const n = sectionSource(ctx, "all", "Operating Model overview", "Principles, governance, processes, RACI, calendar, interfaces, KPIs", model.isIllustrative);
    const l1 = model.chain.reduce((s, c) => s + c.children.length, 0);
    const l2 = model.chain.reduce((s, c) => s + c.children.reduce((t, k) => t + k.children.length, 0), 0);
    return [
      `[${n}] Internal | Programme Office Operating Model. Source: ${sourceLabel(model.isIllustrative)}.`,
      `Principles: ${model.principles.length} (${model.principles.map((p) => p.titleEn).join("; ")}).`,
      `Governance: ${model.governance.bodies.length} bodies (${model.governance.bodies.map((b) => b.nameEn).join("; ")}), ${model.governance.connectors.length} decision flows.`,
      `Process landscape: ${model.chain.length} Level 0 processes, ${l1} Level 1 processes, ${l2} Level 2 procedures: ${model.chain.map((c) => `${c.code} ${c.nameEn}`).join("; ")}.`,
      `RACI: ${model.raci.processes.length} Level 1 processes across ${model.raci.units.length} units, ${model.raci.cells.length} cells.`,
      `Calendar ${model.calendar.year}: ${model.calendar.events.length} dated items.`,
      `Interfaces: ${model.interfaces.external.length} external entities, ${model.interfaces.internal.length} internal unit-to-unit flows across ${model.interfaces.units.length} units.`,
      `Operational KPIs: ${model.kpis.map((k) => `${k.nameEn} ${k.latest?.value ?? "-"}${k.unit === "percent" ? "%" : k.unit ? ` ${k.unit}` : ""} (${k.rag})`).join("; ")}.`,
      "Ask for a section (principles, governance, processes, raci, calendar, interfaces, kpis) for the detail.",
    ].join("\n");
  }

  if (section === "principles") {
    const rows = await getPrinciples();
    if (!rows.length) return "No operating principles have been recorded yet.";
    const illustrative = rows.some((r) => r.isIllustrative);
    const n = sectionSource(ctx, "principles", "Operating principles", rows.map((r) => r.titleEn).join("; "), illustrative);
    return [
      `[${n}] Internal | ${rows.length} operating principles. Source: ${sourceLabel(illustrative)}.`,
      ...rows.map((r, i) => `${i + 1}. ${r.titleEn} / ${r.titleAr}: ${r.textEn ?? ""}`),
    ].join("\n");
  }

  if (section === "governance") {
    const g = await getGovernance();
    if (!g.bodies.length) return "No governance bodies have been recorded yet.";
    const illustrative = g.bodies.some((b) => b.isIllustrative);
    const byId = new Map(g.bodies.map((b) => [b.id, b]));
    const n = sectionSource(ctx, "governance", "Governance and decision rights", g.bodies.map((b) => b.nameEn).join("; "), illustrative);
    return [
      `[${n}] Internal | Governance: ${g.bodies.length} bodies. Source: ${sourceLabel(illustrative)}. Programme Strategy bodies are reused from the Programme Strategy governance table.`,
      ...g.bodies.map(
        (b) =>
          `${b.nameEn} / ${b.nameAr} (${b.source === "council" ? "Programme Strategy body" : "operating model body"}, cadence ${b.cadence ?? "-"}): decides ${b.decisionsEn.length ? b.decisionsEn.join("; ") : (b.roleEn ?? "").slice(0, 200)}. Members: ${b.members.map((m) => m.en).join("; ") || "-"}. Escalates to: ${b.escalatesToId ? byId.get(b.escalatesToId)?.nameEn ?? "-" : "none"}.`
      ),
      `Decision flows: ${g.connectors.map((c) => `${byId.get(c.fromId)?.nameEn} ${c.kind.replace("_", " ")} ${byId.get(c.toId)?.nameEn}`).join("; ")}.`,
    ].join("\n");
  }

  if (section === "processes" || section === "raci") {
    const model = await getOperatingModel(ctx.user);
    if (section === "processes") {
      if (!model.chain.length) return "No processes have been recorded yet.";
      const lines = model.chain.map((l0: ProcessMapNode) => {
        const n = processSource(ctx, l0);
        return `[${n}] ${l0.code} ${l0.nameEn} / ${l0.nameAr}, owner ${owner(l0)}: ${l0.children.map((c) => `${c.code} ${c.nameEn} (${owner(c)}${c.children.length ? `, ${c.children.length} procedures` : ""})`).join("; ")}`;
      });
      return [`Internal | The Level 0 value chain, ${model.chain.length} processes. Source: ${sourceLabel(model.isIllustrative)}.`, ...lines].join("\n");
    }
    if (!model.raci.cells.length) return "No RACI has been recorded yet.";
    const unitCode = new Map(model.raci.units.map((u) => [u.id, u.code]));
    const n = sectionSource(ctx, "raci", "RACI matrix", `${model.raci.processes.length} Level 1 processes`, model.isIllustrative);
    const lines = model.raci.processes.map((p) => {
      const cells = model.raci.cells.filter((c) => c.processId === p.id);
      const of = (role: string) => cells.filter((c) => c.role === role).map((c) => unitCode.get(c.unitId)).filter(Boolean).join(", ") || "-";
      return `${p.code} ${p.nameEn}: A=${of("A")}; R=${of("R")}; C=${of("C")}; I=${of("I")}`;
    });
    return [`[${n}] Internal | RACI across ${model.raci.units.length} units. Source: ${sourceLabel(model.isIllustrative)}.`, ...lines].join("\n");
  }

  if (section === "calendar") {
    const cal = await getCalendar();
    if (!cal.events.length) return `No calendar items are recorded for ${cal.year}.`;
    const illustrative = cal.events.some((e) => e.isIllustrative);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = cal.events.filter((e) => e.dateFrom >= today).slice(0, 15);
    const n = sectionSource(ctx, "calendar", `Planning and reporting calendar ${cal.year}`, `${cal.events.length} items`, illustrative);
    const counts = new Map<string, number>();
    for (const e of cal.events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    return [
      `[${n}] Internal | Calendar ${cal.year}: ${cal.events.length} items (${[...counts.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}). Source: ${sourceLabel(illustrative)}.`,
      `Next up: ${upcoming.map((e) => `${e.dateFrom}${e.dateTo ? ` to ${e.dateTo}` : ""} ${e.titleEn} (${e.kind}${e.ownerUnit ? `, ${e.ownerUnit.code}` : ""})`).join("; ")}`,
    ].join("\n");
  }

  if (section === "interfaces") {
    const model = await getOperatingModel(ctx.user);
    const { external, internal, units, chord } = model.interfaces;
    if (!external.length && !internal.length) return "No interfaces have been recorded yet.";
    const n = sectionSource(ctx, "interfaces", "Interfaces", `${external.length} external, ${internal.length} internal`, model.isIllustrative);
    const codeOf = new Map(units.map((u) => [u.id, u.code]));
    const top = [...chord].sort((a, b) => b.count - a.count).slice(0, 8);
    return [
      `[${n}] Internal | Interfaces. Source: ${sourceLabel(model.isIllustrative)}.`,
      `External (${external.length}): ${external.map((e) => `${e.entity.shortNameEn ?? e.entity.nameEn} (${e.cadence ?? "-"}; Programme Office provides ${(e.providesEn ?? "").slice(0, 80)}; receives ${(e.receivesEn ?? "").slice(0, 80)})`).join("; ")}`,
      `Internal (${internal.length} flows across ${units.length} units). Busiest pairs: ${top.map((c) => `${codeOf.get(c.fromUnitId)} to ${codeOf.get(c.toUnitId)} (${c.count})`).join("; ")}.`,
      "Use get_interfaces with a unit code for one unit's flows and focal points.",
    ].join("\n");
  }

  const kpis = await getOpsKpis();
  if (!kpis.length) return "No operational KPIs have been recorded yet.";
  const n = sectionSource(ctx, "kpis", "Operational KPI scorecard", kpis.map((k) => k.nameEn).join("; "), true);
  return [
    `[${n}] Internal | Operational KPIs (${kpis.length}). Source: ${ILLUSTRATIVE}; auto-sourced KPIs read the live tables for the current month.`,
    ...kpis.map(
      (k) =>
        `${k.nameEn} / ${k.nameAr} (${k.sourceKind}): latest ${k.latest ? `${k.latest.value ?? "-"} ${k.unit ?? ""} in ${k.latest.period}` : "no value"}, previous ${k.previous?.value ?? "-"}, target ${k.target ?? "-"} (${k.direction === "down_good" ? "lower is better" : "higher is better"}), status ${k.rag}, trend ${k.trend ?? "-"}${k.improving == null ? "" : k.improving ? " (improving)" : " (worsening)"}. ${k.definitionEn ?? ""}`
    ),
  ].join("\n");
}

/* ---- get_process ---- */
async function toolGetProcess(ctx: ToolContext, input: { code?: string }): Promise<string> {
  const code = (input.code ?? "").trim();
  if (!code) return "Give a process code such as P4 or P4.1, or a process id.";
  const p = await getProcess(ctx.user, code);
  if (!p) return "No process matched that code. Use get_operating_model with section processes to list the codes.";
  const n = processSource(ctx, p);
  const label = sourceLabel(p.isIllustrative);
  return [
    `[${n}] Internal | Level ${p.level} process ${p.code} "${p.nameEn}" / "${p.nameAr}" status=${p.status}. Source: ${label}.`,
    `Owner unit: ${owner(p)}.`,
    p.ancestors.length ? `Sits under: ${p.ancestors.map((a) => `${a.code} ${a.nameEn}`).join(" > ")}.` : "",
    `Purpose: ${p.purposeEn ?? "-"}`,
    p.inputs.length ? `Inputs: ${p.inputs.map((i) => `${i.textEn}${i.fromUnit ? ` (from ${i.fromUnit.code})` : ""}`).join("; ")}.` : "",
    p.outputs.length ? `Outputs: ${p.outputs.map((o) => o.textEn).join("; ")}.` : "",
    ...p.steps.map((s) => `Step ${s.n}: ${s.textEn}${s.roleUnit ? ` [${s.roleUnit.code}]` : ""}${s.system ? ` via ${s.system}` : ""}`),
    p.systems.length ? `Systems: ${p.systems.map((s) => s.nameEn).join(", ")}.` : "",
    p.kpis.length ? `KPIs: ${p.kpis.map((k) => `${k.nameEn}${k.target ? ` target ${k.target}${k.unit ? ` ${k.unit}` : ""}` : ""}`).join("; ")}.` : "",
    p.policies.length ? `Governing policies: ${p.policies.map((d) => `${d.titleEn} (${d.versionLabel ?? "-"})`).join("; ")}.` : "",
    p.sops.length ? `SOPs and forms: ${p.sops.map((d) => `${d.titleEn} (${d.versionLabel ?? "-"})`).join("; ")}.` : "",
    p.raci.length ? `RACI: ${p.raci.map((r) => `${r.role}=${r.unit.code}`).join(", ")}.` : "",
    p.interfaces.internal.length
      ? `Internal interfaces: ${p.interfaces.internal.map((i) => `${i.fromUnit.code} to ${i.toUnit.code} (${i.flowKind}${i.cadence ? `, ${i.cadence}` : ""})`).join("; ")}.`
      : "",
    p.interfaces.external.length ? `External interfaces: ${p.interfaces.external.map((e) => e.entity.shortNameEn ?? e.entity.nameEn).join(", ")}.` : "",
    p.children.length ? `Beneath it: ${p.children.map((c) => `${c.code} ${c.nameEn}`).join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---- get_interfaces ---- */
async function toolGetInterfaces(ctx: ToolContext, input: { unit?: string }): Promise<string> {
  const needle = (input.unit ?? "").trim();
  if (!needle) return "Give the code or the name of an organisation unit.";
  const unit = await findUnit(needle);
  if (!unit) return "No organisation unit matched that name or code.";
  const data = await getUnitInterfaces(ctx.user, unit.id);
  if (!data) return "No organisation unit matched that name or code.";
  if (!data.gives.length && !data.receives.length && !data.external.length) {
    return `${data.unit.nameEn} (${data.unit.code}) has no recorded interfaces.`;
  }
  const illustrative = [...data.gives, ...data.receives, ...data.external].some((i) => i.isIllustrative);
  const n = sectionSource(ctx, `interfaces:${data.unit.code}`, `Interfaces of ${data.unit.nameEn}`, `${data.gives.length} given, ${data.receives.length} received`, illustrative);
  const line = (i: (typeof data.gives)[number], dir: "to" | "from") =>
    `${dir === "to" ? `to ${i.toUnit.code}` : `from ${i.fromUnit.code}`}: ${i.descriptionEn ?? i.flowKind} (${i.flowKind}${i.cadence ? `, ${i.cadence}` : ""}${i.serviceLevel ? `, service level ${i.serviceLevel}` : ""}${i.process ? `, process ${i.process.code}` : ""}; focal ${i.focalFrom?.nameEn ?? "-"} to ${i.focalTo?.nameEn ?? "-"})`;
  return [
    `[${n}] Internal | Interfaces of ${data.unit.nameEn} / ${data.unit.nameAr} (${data.unit.code}). Source: ${sourceLabel(illustrative)}.`,
    data.gives.length ? `Gives (${data.gives.length}): ${data.gives.map((i) => line(i, "to")).join("; ")}` : "Gives nothing recorded.",
    data.receives.length ? `Receives (${data.receives.length}): ${data.receives.map((i) => line(i, "from")).join("; ")}` : "Receives nothing recorded.",
    data.external.length
      ? `External entities (${data.external.length}): ${data.external.map((e) => `${e.entity.nameEn} (${e.cadence ?? "-"}; legal basis ${e.legalBasisEn ?? "-"}; Programme Office focal ${e.focalOrg?.nameEn ?? "-"}, entity focal ${e.focalEntityName ?? "-"})`).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const mod: ToolModule = {
  definitions: [
    {
      name: "get_operating_model",
      description:
        "The Programme Office's operating model: pass section = principles | governance | processes | raci | calendar | interfaces | kpis, or omit it for an overview. Governance reuses the Programme Strategy's bodies plus the Council, the Secretary General, the Executive Committee, the National Statistics Committee and the Data Governance Board. All content is Internal and, while seeded, illustrative.",
      input_schema: {
        type: "object",
        properties: {
          section: { type: "string", enum: ["principles", "governance", "processes", "raci", "calendar", "interfaces", "kpis", "all"] },
        },
      },
    },
    {
      name: "get_process",
      description:
        "One process of the Programme Office process architecture by code (Level 0 P1 to P8, Level 1 such as P4.1, Level 2 procedures such as P4.3.1) with its purpose, owner unit, numbered steps naming the unit and the system, inputs and outputs, systems, KPIs, governing policies and SOPs the user may see, RACI, interfaces and children.",
      input_schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    },
    {
      name: "get_interfaces",
      description:
        "Everything one organisation unit gives to and receives from other units (flow kind, trigger, cadence, service level, linked process, focal persons) and the external entities it interfaces with.",
      input_schema: { type: "object", properties: { unit: { type: "string", description: "a unit code such as SOA or a unit name" } }, required: ["unit"] },
    },
  ],
  portal: {
    get_operating_model: "operating_model",
    get_process: "processes",
    get_interfaces: "operating_model",
  },
  async run(ctx, name, input) {
    switch (name) {
      case "get_operating_model":
        return toolGetOperatingModel(ctx, input as { section?: string });
      case "get_process":
        return toolGetProcess(ctx, input as { code?: string });
      case "get_interfaces":
        return toolGetInterfaces(ctx, input as { unit?: string });
      default:
        return null;
    }
  },
};

export default mod;
