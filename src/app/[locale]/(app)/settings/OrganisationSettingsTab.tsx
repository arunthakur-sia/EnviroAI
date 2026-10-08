"use client";
// CR07 3.6 and CR08 1.2: Settings > Organisation, Super Admin only. The
// structure editor (drag to move with a confirmation that counts what moves,
// add a child at any level, inline rename, the kebab with edit, deactivate and
// delete through the risk dialog that reassigns everything first), the levels
// editor, the snapshots with restore, the CSV import, the change requests from
// unit heads, and the CR07 sections kept as they were: bulk member assignment,
// the website re-sync diff, and the Programme Strategy Office. The last ten
// mutations of the session can be undone: every mutation answers with its
// inverse, which is applied through the same API.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, RefreshCw, Undo2, UserPlus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, Label, NativeSelect, Skeleton, SectionTitle, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { editorCall, useUndoStack, type StructurePayload } from "./OrganisationEditorShared";
import { OrganisationTreeEditor } from "./OrganisationTreeEditor";
import { OrganisationLevelsEditor } from "./OrganisationLevelsEditor";
import { OrganisationSnapshots } from "./OrganisationSnapshots";
import { OrganisationCsvImport } from "./OrganisationCsvImport";
import { OrganisationChangeRequests } from "./OrganisationChangeRequests";

type SyncKind = "new" | "renamed" | "mandate" | "head" | "removed";

type SyncChange = {
  code: string;
  kind: SyncKind;
  nameEn: string;
  nameAr: string;
  beforeEn?: string;
  afterEn?: string;
  beforeAr?: string;
  afterAr?: string;
};

const UNIT_ROLES = ["head", "deputy", "member"] as const;
const SYNC_KINDS: SyncKind[] = ["new", "renamed", "mandate", "head", "removed"];
/** CR07 3.6: the knowledge types the Organisation module publishes. */
const POLICY_KNOWLEDGE_TYPES = ["policy_internal", "procedure", "form_template", "service"] as const;
/** The default Strategy Office when the setting has never been saved. */
const DEFAULT_STRATEGY_OFFICE = "IDP";

export function OrganisationSettingsTab() {
  const t = useTranslations("settings.organisationTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const uid = React.useId();

  const [data, setData] = React.useState<StructurePayload | null>(null);
  const [version, setVersion] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const undo = useUndoStack();

  // member assignment (CR07)
  const [memberUnitId, setMemberUnitId] = React.useState("");
  const [memberRole, setMemberRole] = React.useState<(typeof UNIT_ROLES)[number]>("member");
  const [emails, setEmails] = React.useState("");
  const [assignResult, setAssignResult] = React.useState<{ added: number; matched: number; unknown: string[] } | null>(null);

  // re-sync (CR07)
  const [sync, setSync] = React.useState<{ changes: SyncChange[]; fetchedAt: string | null } | null>(null);
  const [ticked, setTicked] = React.useState<number[]>([]);

  // Programme Strategy Office (CR07)
  const [officeCode, setOfficeCode] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/organisation/structure");
      const j = await res.json();
      const payload: StructurePayload = {
        units: j.data?.units ?? [],
        users: j.data?.users ?? [],
        levels: j.data?.levels ?? [],
        levelDefs: j.data?.levelDefs ?? [],
        canManage: Boolean(j.data?.canManage),
        canEditStructure: Boolean(j.data?.canEditStructure),
      };
      setData(payload);
      setVersion((v) => v + 1);
      setMemberUnitId((current) => current || payload.units[0]?.id || "");
    } catch {
      setData({ units: [], users: [], levels: [], levelDefs: [], canManage: false, canEditStructure: false });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/v1/settings")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const raw = (j?.data ?? {}) as Record<string, { unitCode?: string } | undefined>;
        const stored = raw.councilStrategyOffice ?? raw.council_strategy_office;
        if (stored?.unitCode) setOfficeCode(String(stored.unitCode));
      })
      .catch(() => {
        /* the setting is only readable by an administrator */
      });
    return () => {
      alive = false;
    };
  }, []);

  const units = React.useMemo(() => data?.units ?? [], [data]);
  const users = React.useMemo(() => data?.users ?? [], [data]);
  const levelDefs = React.useMemo(() => data?.levelDefs ?? [], [data]);
  const canManage = data?.canManage ?? false;
  const canEdit = data?.canEditStructure ?? false;
  const usersById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const ordered = React.useMemo(() => {
    // the same walk the editor uses, for the selects
    const ids = new Set(units.map((u) => u.id));
    const byParent = new Map<string, typeof units>();
    for (const u of units) {
      const key = u.parentId && ids.has(u.parentId) ? u.parentId : " root";
      const bucket = byParent.get(key);
      if (bucket) bucket.push(u);
      else byParent.set(key, [u]);
    }
    for (const bucket of byParent.values()) bucket.sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code));
    const out: { unit: (typeof units)[number]; depth: number }[] = [];
    const seen = new Set<string>();
    const walk = (key: string, depth: number) => {
      for (const unit of byParent.get(key) ?? []) {
        if (seen.has(unit.id)) continue;
        seen.add(unit.id);
        out.push({ unit, depth });
        walk(unit.id, depth + 1);
      }
    };
    walk(" root", 0);
    return out;
  }, [units]);

  const unitLabel = (unit: { nameEn: string; nameAr: string }) => bi(locale, unit.nameEn, unit.nameAr);
  const indentedLabel = (row: { unit: { nameEn: string; nameAr: string }; depth: number }) =>
    `${"  ".repeat(row.depth)}${unitLabel(row.unit)}`;
  void usersById;

  function explain(code: string | null | undefined): string {
    if (code === "would_create_a_cycle") return t("cycleError");
    if (code === "code_taken") return t("codeTaken");
    if (code === "forbidden") return tc("forbidden");
    return tc("error");
  }

  /* ---------------------------------- undo --------------------------------- */

  async function undoLast() {
    const entry = undo.last;
    if (!entry) return;
    setBusy("undo");
    try {
      const res = await editorCall(entry.inverse);
      if (!res.ok) {
        toast(t("undoFailed"), "error");
        return;
      }
      undo.pop();
      toast(t("undone"), "success");
      await load();
    } finally {
      setBusy(null);
    }
  }

  /* --------------------------- member assignment -------------------------- */

  async function assignMembers() {
    setBusy("members");
    try {
      const res = await fetch("/api/v1/organisation/structure", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitId: memberUnitId, emails, roleInUnit: memberRole }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        setAssignResult({ added: j?.data?.added ?? 0, matched: j?.data?.matched ?? 0, unknown: j?.data?.unknown ?? [] });
        toast(t("membersAssigned", { count: j?.data?.added ?? 0 }), "success");
        setEmails("");
        await load();
      } else {
        setAssignResult(null);
        toast(j?.error === "no_emails" ? t("noEmails") : explain(j?.error), "error");
      }
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------- the re-sync ---------------------------- */

  async function checkSync() {
    setBusy("sync");
    try {
      const res = await fetch("/api/v1/organisation/structure?view=sync");
      const j = await res.json().catch(() => null);
      if (res.ok) {
        setSync({ changes: j?.data?.changes ?? [], fetchedAt: j?.data?.fetchedAt ?? null });
        setTicked([]);
      } else {
        toast(explain(j?.error), "error");
      }
    } finally {
      setBusy(null);
    }
  }

  const syncGroups = React.useMemo(() => {
    const changes = sync?.changes ?? [];
    return SYNC_KINDS.map((kind) => ({
      kind,
      items: changes.map((change, index) => ({ change, index })).filter((entry) => entry.change.kind === kind),
    })).filter((group) => group.items.length > 0);
  }, [sync]);

  function toggleTick(index: number) {
    setTicked((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }

  function toggleGroup(indexes: number[], on: boolean) {
    setTicked((prev) => {
      const next = new Set(prev);
      for (const i of indexes) {
        if (on) next.add(i);
        else next.delete(i);
      }
      return [...next];
    });
  }

  async function applySync() {
    if (!sync || !ticked.length) return;
    setBusy("apply");
    try {
      const apply = ticked
        .slice()
        .sort((a, b) => a - b)
        .map((i) => sync.changes[i])
        .filter(Boolean)
        .map((change) => ({ code: change.code, kind: change.kind }));
      const res = await fetch("/api/v1/organisation/structure", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        toast(t("syncApplied", { count: j?.data?.applied ?? 0 }), "success");
        setSync(null);
        setTicked([]);
        await load();
      } else {
        toast(j?.error === "no_source" ? t("syncNotFetched") : explain(j?.error), "error");
      }
    } finally {
      setBusy(null);
    }
  }

  /* --------------------------- Programme Strategy --------------------------- */

  const councilValue = officeCode || (units.some((u) => u.code === DEFAULT_STRATEGY_OFFICE) ? DEFAULT_STRATEGY_OFFICE : "");

  async function saveCouncilOffice() {
    setBusy("council");
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        // the setting lives under the key council_strategy_office with the
        // shape { unitCode }; both spellings of the body field are sent so the
        // payload matches the settings route however it names the field.
        body: JSON.stringify({
          councilStrategyOffice: { unitCode: councilValue },
          council_strategy_office: { unitCode: councilValue },
        }),
      });
      if (res.ok) toast(t("councilSaved"), "success");
      else toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  /* -------------------------------- render -------------------------------- */

  if (!data) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-8" data-testid="organisation-settings">
      {/* 1. the structure editor */}
      <section data-testid="org-settings-structure">
        <SectionTitle aside={<span className="text-xs text-ink-600 tnum">{t("unitsCount", { count: units.length })}</span>}>{t("editorTitle")}</SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{t("editorHint")}</p>
        {!canEdit ? <p className="mb-3 text-xs text-warn">{t("superAdminOnly")}</p> : null}
        <OrganisationTreeEditor units={units} users={users} levels={levelDefs} canEdit={canEdit} onChanged={load} pushUndo={undo.push} />
      </section>

      {/* 2. the levels */}
      <section data-testid="org-settings-levels">
        <SectionTitle>{t("levelsTitle")}</SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{t("levelsHint")}</p>
        <OrganisationLevelsEditor levels={levelDefs} units={units} canEdit={canEdit} onChanged={load} pushUndo={undo.push} />
      </section>

      {/* 3. snapshots */}
      <section data-testid="org-settings-snapshots">
        <SectionTitle>{t("snapshotsTitle")}</SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{t("snapshotsHint")}</p>
        <OrganisationSnapshots version={version} canEdit={canEdit} onChanged={load} pushUndo={undo.push} />
      </section>

      {/* 4. CSV import */}
      <section data-testid="org-settings-csv">
        <SectionTitle>{t("csvTitle")}</SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{t("csvHint")}</p>
        <OrganisationCsvImport canEdit={canEdit} onChanged={load} pushUndo={undo.push} />
      </section>

      {/* 5. change requests */}
      <section data-testid="org-settings-requests">
        <SectionTitle>{t("requestsTitle")}</SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{t("requestsHint")}</p>
        <OrganisationChangeRequests canEdit={canEdit} />
      </section>

      {/* 6. member assignment (CR07) */}
      <section data-testid="org-settings-members">
        <SectionTitle>{t("membersTitle")}</SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{t("membersHint")}</p>
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Label htmlFor={`${uid}-member-unit`}>{t("unit")}</Label>
              <NativeSelect id={`${uid}-member-unit`} value={memberUnitId} onChange={(e) => setMemberUnitId(e.target.value)} className="cursor-pointer">
                {ordered.map((row) => (
                  <option key={row.unit.id} value={row.unit.id}>
                    {indentedLabel(row)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="min-w-40">
              <Label htmlFor={`${uid}-member-role`}>{t("roleInUnit")}</Label>
              <NativeSelect id={`${uid}-member-role`} value={memberRole} onChange={(e) => setMemberRole(e.target.value as (typeof UNIT_ROLES)[number])} className="cursor-pointer">
                {UNIT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`roles.${role}` as never)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Label htmlFor={`${uid}-emails`}>{t("emailsLabel")}</Label>
            <Textarea id={`${uid}-emails`} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={t("emailsPlaceholder")} dir="ltr" className="min-h-28 font-mono text-xs" />
            <p className="mt-1.5 text-[11px] text-ink-400">{t("emailsHint")}</p>
          </div>
          <div className="flex justify-end">
            <Button loading={busy === "members"} disabled={!canManage || !memberUnitId || emails.trim().length < 3} onClick={assignMembers} data-testid="org-members-assign">
              <UserPlus /> {t("assign")}
            </Button>
          </div>
          {assignResult ? (
            <div className="rounded-xl border border-mist-200 bg-mist-50 p-3" data-testid="org-members-result">
              <p className="text-sm text-ink-900">{t("assignResult", { matched: assignResult.matched, added: assignResult.added })}</p>
              {assignResult.unknown.length ? (
                <>
                  <p className="mt-2 text-xs font-medium text-warn">{t("unknownTitle", { count: assignResult.unknown.length })}</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {assignResult.unknown.map((address) => (
                      <li key={address}>
                        <Chip tone="warn" className="tnum" dir="ltr">
                          {address}
                        </Chip>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11px] text-ink-400">{t("unknownHint")}</p>
                </>
              ) : (
                <p className="mt-1.5 text-[11px] text-ink-400">{t("allMatched")}</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* 7. the re-sync from the website (CR07) */}
      <section data-testid="org-settings-sync">
        <SectionTitle
          aside={
            <Button size="sm" variant="secondary" loading={busy === "sync"} onClick={checkSync} disabled={!canManage} data-testid="org-sync-check">
              <RefreshCw /> {t("syncCheck")}
            </Button>
          }
        >
          {t("syncTitle")}
        </SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{t("syncHint")}</p>
        <div className="card p-4">
          {!sync ? (
            <p className="text-sm text-ink-600">{t("syncIdle")}</p>
          ) : sync.fetchedAt === null ? (
            <p className="text-sm text-ink-600">{t("syncNotFetched")}</p>
          ) : sync.changes.length === 0 ? (
            <>
              <p className="text-sm text-ink-900">{t("syncNoChanges")}</p>
              <p className="mt-1.5 text-[11px] text-ink-400 tnum" dir="ltr">
                {t("syncFetchedOn", { date: sync.fetchedAt.slice(0, 10) })}
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-ink-400 tnum">{t("syncFetchedOn", { date: sync.fetchedAt.slice(0, 10) })}</p>
              {syncGroups.map((group) => {
                const indexes = group.items.map((entry) => entry.index);
                const allOn = indexes.every((i) => ticked.includes(i));
                return (
                  <div key={group.kind} className="rounded-xl border border-mist-200">
                    <div className="flex items-center gap-3 border-b border-mist-100 bg-mist-50 px-3 py-2">
                      <span className="text-sm font-medium text-ink-900">{t(`syncKinds.${group.kind}` as never)}</span>
                      <span className="text-[11px] text-ink-400 tnum">{group.items.length}</span>
                      <label className="ms-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-600">
                        <input
                          type="checkbox"
                          checked={allOn}
                          onChange={(e) => toggleGroup(indexes, e.target.checked)}
                          className="size-3.5 cursor-pointer accent-navy-700"
                          aria-label={t("selectAllIn", { group: t(`syncKinds.${group.kind}` as never) })}
                        />
                        {t("selectAll")}
                      </label>
                    </div>
                    <ul className="divide-y divide-mist-100">
                      {group.items.map(({ change, index }) => (
                        <li key={`${change.kind}:${change.code}:${index}`} className="px-3 py-2">
                          <label className="flex cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={ticked.includes(index)}
                              onChange={() => toggleTick(index)}
                              className="mt-1 size-3.5 cursor-pointer accent-navy-700"
                              aria-label={t("selectChange", { unit: bi(locale, change.nameEn, change.nameAr) || change.code })}
                              data-testid="org-sync-change"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-ink-400 tnum" dir="ltr">
                                  {change.code}
                                </span>
                                <span className="text-sm text-ink-900">{bi(locale, change.nameEn, change.nameAr) || change.code}</span>
                              </span>
                              {change.beforeEn || change.afterEn ? (
                                <span className="block text-xs text-ink-600">
                                  {t("beforeAfter", { before: change.beforeEn || t("nothingRecorded"), after: change.afterEn || t("nothingRecorded") })}
                                </span>
                              ) : null}
                              {change.beforeAr || change.afterAr ? (
                                <span className="block text-xs text-ink-400" dir="auto">
                                  {t("beforeAfter", { before: change.beforeAr || t("nothingRecorded"), after: change.afterAr || t("nothingRecorded") })}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center justify-end gap-3">
                <span className="text-xs text-ink-600 tnum">{t("tickedCount", { count: ticked.length })}</span>
                <Button loading={busy === "apply"} disabled={!canManage || ticked.length === 0} onClick={applySync} data-testid="org-sync-apply">
                  <Check /> {t("syncApply")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 8. Programme Strategy (CR07) */}
      <section data-testid="org-settings-council">
        <SectionTitle>{t("councilTitle")}</SectionTitle>
        <div className="card flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Label htmlFor={`${uid}-council-office`}>{t("strategyOffice")}</Label>
              <NativeSelect id={`${uid}-council-office`} value={councilValue} onChange={(e) => setOfficeCode(e.target.value)} className="cursor-pointer" data-testid="org-council-office">
                <option value="">{tc("choose")}</option>
                {ordered.map((row) => (
                  <option key={row.unit.id} value={row.unit.code}>
                    {indentedLabel(row)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button loading={busy === "council"} disabled={!canManage || !councilValue} onClick={saveCouncilOffice} data-testid="org-council-save">
              {tc("save")}
            </Button>
          </div>
          <p className="text-xs text-ink-600">{t("strategyOfficeHint")}</p>
          <div className="border-t border-mist-100 pt-4">
            <p className="mb-2 text-sm font-medium text-ink-900">{t("knowledgeTypesTitle")}</p>
            <ul className="flex flex-wrap gap-1.5" data-testid="org-council-types">
              {POLICY_KNOWLEDGE_TYPES.map((type) => (
                <li key={type}>
                  <Chip tone="navy">{t(`knowledgeTypes.${type}` as never)}</Chip>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-ink-400">{t("knowledgeTypesHint")}</p>
          </div>
        </div>
      </section>

      {/* the undo bar: the last ten changes of this session */}
      <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center">
        <AnimatePresence>
          {undo.last ? (
            <motion.div
              key="undo"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className={cn("pointer-events-auto flex items-center gap-3 rounded-full border border-mist-300 bg-white py-1.5 pe-2 ps-4 shadow-[var(--shadow-lift)]")}
              role="status"
              data-testid="org-undo-bar"
            >
              <span className="max-w-72 truncate text-xs text-ink-900">{undo.last.label}</span>
              <span className="text-[11px] text-ink-400 tnum">{t("undoCount", { count: undo.stack.length })}</span>
              <Button size="sm" variant="secondary" loading={busy === "undo"} onClick={undoLast} aria-label={t("undoAria", { label: undo.last.label })} data-testid="org-undo">
                <Undo2 /> {t("undo")}
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
