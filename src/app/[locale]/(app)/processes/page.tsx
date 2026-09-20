// CR08 10.1: Processes, Policies, and SOPs. One page, one URL: the Level 0
// chain as a horizontal process map, the by-unit and by-policy-type views,
// and the process panel. State arrives in the query string
// (?view=process|unit|policy, ?p=<code>, ?l0=<code>, ?unit=<code>, ?tab=<tab>).
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { canEditUnitProcesses, getProcess, getProcessMap } from "@/server/services/operating-model";
import { getUnitHeads, listPickerUnits } from "@/server/services/operating-model-unit";
import type { PolicyTab } from "@/server/services/organisation";
import { Reveal } from "@/components/motion";
import { ProcessesPage, type ProcessesInitialState, type ProcessesView } from "./ProcessesPage";

export const dynamic = "force-dynamic";

const VIEWS: ProcessesView[] = ["process", "unit", "policy"];
const TABS: PolicyTab[] = ["policy_internal", "procedure", "form_template", "service"];

export default async function ProcessesRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; p?: string; l0?: string; unit?: string; tab?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const [map, process] = await Promise.all([
    getProcessMap(user),
    sp.p ? getProcess(user, sp.p) : Promise.resolve(null),
  ]);

  /* the owner units of every process plus the units of the by-unit view */
  const unitIds = new Set<string>();
  for (const l0 of map.chain) {
    if (l0.ownerUnit) unitIds.add(l0.ownerUnit.id);
    for (const l1 of l0.children) {
      if (l1.ownerUnit) unitIds.add(l1.ownerUnit.id);
      for (const l2 of l1.children) if (l2.ownerUnit) unitIds.add(l2.ownerUnit.id);
    }
  }
  for (const u of map.byUnit) unitIds.add(u.unit.id);
  if (process?.ownerUnit) unitIds.add(process.ownerUnit.id);

  const [unitHeads, units] = await Promise.all([getUnitHeads([...unitIds]), listPickerUnits()]);

  /* a unit head writes their own unit's processes: the page tells the client which units */
  let editableUnitIds: string[] = [];
  if (map.canEdit) {
    editableUnitIds = units.map((u) => u.id);
  } else {
    const candidates = new Set(unitIds);
    if (user.departmentId) candidates.add(user.departmentId);
    for (const id of candidates) {
      if (await canEditUnitProcesses(user, id)) editableUnitIds.push(id);
    }
  }

  const initialState: ProcessesInitialState = {
    view: VIEWS.includes(sp.view as ProcessesView) ? (sp.view as ProcessesView) : "process",
    p: process?.code ?? null,
    l0: sp.l0 ?? null,
    unit: sp.unit ?? null,
    tab: TABS.includes(sp.tab as PolicyTab) ? (sp.tab as PolicyTab) : "policy_internal",
  };

  return (
    <Reveal>
      <ProcessesPage
        map={map}
        initialProcess={process}
        initialState={initialState}
        unitHeads={unitHeads}
        units={units}
        editableUnitIds={editableUnitIds}
      />
    </Reveal>
  );
}
