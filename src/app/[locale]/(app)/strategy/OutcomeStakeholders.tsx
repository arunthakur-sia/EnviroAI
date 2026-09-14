"use client";
// CR06: the Outcome stakeholders section in the outcome panel. Four groups in
// order: the department owner card, lead-entity chips that filter the lanes
// above, compact expert rows (hover lights the lane cards they touch), and a
// collapsed sponsors/owners/managers list. Direct assignments to the outcome
// come first in each group with a small "Outcome" chip.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ChevronDown, Mail, Plus, Users2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { Avatar, Button, Chip, NativeSelect } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { KindGlyph } from "@/components/nexus/LeadChips";
import { AddStakeholderInline } from "@/components/nexus/Stakeholders";
import type { OutcomeStakeholders, OutcomePerson } from "@/server/services/strategy";

const EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600";

/** Toggle the gold outline on every lane card of the given nodes. */
function setLaneGlow(ids: string[], on: boolean) {
  for (const id of ids) {
    document
      .querySelectorAll(`[data-node-id="${CSS.escape(id)}"]`)
      .forEach((el) => el.classList.toggle("lane-hl", on));
  }
}

function DirectChip() {
  const t = useTranslations("strategy.outcomeStakeholders");
  return (
    <Chip tone="gold" className="ms-2 align-middle" data-testid="direct-chip">
      {t("directChip")}
    </Chip>
  );
}

/* The department owner card row (group 1) */
function DepartmentOwnerRow({
  outcomeId,
  owner,
  canEdit,
}: {
  outcomeId: string;
  owner: OutcomeStakeholders["departmentOwner"];
  canEdit: boolean;
}) {
  const t = useTranslations("strategy.outcomeStakeholders");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [picking, setPicking] = React.useState(false);
  const [deps, setDeps] = React.useState<
    { id: string; code: string; nameEn: string; nameAr: string }[]
  >([]);
  const [depId, setDepId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!picking || deps.length) return;
    fetch("/api/v1/strategy/leads?list=departments")
      .then((r) => r.json())
      .then((j) => setDeps(j.data ?? []))
      .catch(() => setDeps([]));
  }, [picking, deps.length]);

  async function save() {
    if (!depId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/strategy/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nodeId: outcomeId,
          action: "set_department_owner",
          departmentId: depId,
        }),
      });
      if (res.ok) {
        toast(t("ownerSet"), "success");
        setPicking(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3">
      <p className={cn(EYEBROW, "mb-1.5")} style={{ fontFamily: "inherit" }}>
        {t("deptOwner")}
      </p>
      <div
        className="card flex flex-wrap items-center gap-3 px-3.5 py-2.5"
        data-testid="outcome-dept-owner"
      >
        {owner ? (
          <>
            {/* the NPC emblem, as on department lead chips */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/NPC_logo_transparent.png"
              alt=""
              aria-hidden
              className="size-7 shrink-0 select-none object-cover object-right"
              draggable={false}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {bi(locale, owner.nameEn, owner.nameAr)}
                {/* dir=auto flips the logical margin, so pad both sides */}
                <span className="mx-2 inline-block text-xs font-normal text-ink-400" dir="auto">
                  {locale === "ar" ? owner.nameEn : owner.nameAr}
                </span>
              </p>
              {owner.head ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-600">
                  <Avatar
                    name={owner.head.nameEn || owner.head.nameAr}
                    color={owner.head.avatarColor}
                    size={18}
                  />
                  {t("deptHead", { name: bi(locale, owner.head.nameEn, owner.head.nameAr) })}
                </p>
              ) : null}
            </div>
            <Link
              href={`/departments/${owner.code}` as never}
              className="link-draw shrink-0 text-xs font-medium text-maroon-700"
              data-testid="dept-owner-link"
            >
              {t("openDepartment")}
            </Link>
            {canEdit ? (
              <button
                onClick={() => setPicking((v) => !v)}
                className="shrink-0 rounded-lg border border-sand-300 px-2 py-1 text-[11px] font-medium text-ink-600 hover:border-maroon-300 hover:text-maroon-700 cursor-pointer"
                data-testid="set-owner-toggle"
              >
                {t("setOwner")}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className="flex-1 text-sm text-ink-600">{t("deptOwnerEmpty")}</p>
            {canEdit ? (
              <button
                onClick={() => setPicking((v) => !v)}
                className="shrink-0 rounded-lg border border-sand-300 px-2 py-1 text-xs font-medium text-maroon-700 hover:border-maroon-300 cursor-pointer"
                data-testid="set-owner-toggle"
              >
                {t("setOwner")}
              </button>
            ) : null}
          </>
        )}
      </div>
      {picking && canEdit ? (
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="set-owner-form">
          <NativeSelect
            value={depId}
            onChange={(e) => setDepId(e.target.value)}
            className="w-64"
            aria-label={t("pickDepartment")}
          >
            <option value="">{t("pickDepartment")}</option>
            {deps.map((d) => (
              <option key={d.id} value={d.id}>
                {bi(locale, d.nameEn, d.nameAr)}
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" onClick={save} loading={busy} disabled={!depId}>
            {t("confirmOwner")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* One leaders group column (group 4, expanded) */
function LeaderGroup({
  labelKey,
  people,
}: {
  labelKey: "sponsors" | "owners" | "managers";
  people: OutcomePerson[];
}) {
  const t = useTranslations("strategy.outcomeStakeholders");
  const ts = useTranslations("strategy.stakeholders");
  const locale = useLocale();
  return (
    <div data-testid={`leaders-${labelKey}`}>
      <p className={cn(EYEBROW, "mb-1.5 flex items-baseline gap-1.5")} style={{ fontFamily: "inherit" }}>
        {t(labelKey)} <span className="tnum font-medium">{people.length}</span>
      </p>
      <ul className="flex flex-col">
        {people.map((p) => (
          <li key={p.key} className="flex items-center gap-2 py-1.5" data-testid="leader-row">
            <Avatar name={p.nameEn || p.nameAr} color={p.avatarColor} size={24} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
              {bi(locale, p.nameEn, p.nameAr)}
              {p.direct ? <DirectChip /> : null}
            </span>
            <span className="shrink-0 text-[11px] text-ink-600 tnum">
              {t("nodesCount", { count: p.count })}
            </span>
            {p.email ? (
              <a
                href={`mailto:${p.email}`}
                className="shrink-0 rounded-lg p-1 text-ink-400 hover:bg-sand-100 hover:text-maroon-700"
                aria-label={ts("email", { name: p.nameEn })}
              >
                <Mail className="size-3.5" />
              </a>
            ) : null}
            {p.expertId ? (
              <Link
                href={`/experts/${p.expertId}` as never}
                className="shrink-0 rounded-lg border border-sand-300 px-1.5 py-0.5 text-[11px] font-medium text-ink-600 hover:border-maroon-300 hover:text-maroon-700"
              >
                {ts("profile")}
              </Link>
            ) : null}
          </li>
        ))}
        {!people.length ? (
          <li className="py-1.5 text-xs text-ink-600">{t("leadersEmpty")}</li>
        ) : null}
      </ul>
    </div>
  );
}

export function OutcomeStakeholdersSection({
  outcomeId,
  data,
  canEdit,
  leadFilter,
  onLeadFilter,
}: {
  outcomeId: string;
  data: OutcomeStakeholders;
  canEdit: boolean;
  leadFilter: string | null;
  onLeadFilter: (lead: string | null) => void;
}) {
  const t = useTranslations("strategy.outcomeStakeholders");
  const ts = useTranslations("strategy.stakeholders");
  const locale = useLocale();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [adding, setAdding] = React.useState(false);
  const [allExperts, setAllExperts] = React.useState(false);
  const [leadersOpen, setLeadersOpen] = React.useState(false);

  // never leave a stray highlight behind when the panel changes outcome
  React.useEffect(
    () => () => {
      document.querySelectorAll(".lane-hl").forEach((el) => el.classList.remove("lane-hl"));
    },
    [outcomeId]
  );

  const experts = allExperts ? data.experts : data.experts.slice(0, 6);
  const leaderTotal =
    data.leaders.sponsor.length + data.leaders.owner.length + data.leaders.manager.length;

  return (
    <section className="mt-6" data-testid="outcome-stakeholders">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={EYEBROW} style={{ fontFamily: "inherit" }}>
          {t("title")}
        </p>
        {canEdit ? (
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-1 rounded-lg border border-sand-300 bg-white px-2 py-1 text-xs font-medium text-ink-600 hover:border-maroon-300 hover:text-maroon-700 cursor-pointer"
            data-testid="outcome-add-stakeholder"
          >
            {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {adding ? ts("cancel") : ts("add")}
          </button>
        ) : null}
      </div>

      {adding ? (
        <AddStakeholderInline
          nodeId={outcomeId}
          onAdded={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      ) : null}

      {/* 1. the department owner */}
      <DepartmentOwnerRow outcomeId={outcomeId} owner={data.departmentOwner} canEdit={canEdit} />

      {/* 2. lead entities, chips filter the lanes above */}
      <div className="mb-3">
        <p className={cn(EYEBROW, "mb-1.5")} style={{ fontFamily: "inherit" }}>
          {t("leadEntities")}
        </p>
        {data.leadEntities.length ? (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="outcome-lead-entities">
            {data.leadEntities.map(({ chip, count }) => {
              const key = `${chip.kind === "department" ? "d" : "e"}:${chip.id}`;
              const active = leadFilter === key;
              const short = bi(locale, chip.shortEn, chip.shortAr);
              return (
                <button
                  key={key}
                  onClick={() => onLeadFilter(active ? null : key)}
                  aria-pressed={active}
                  aria-label={t("leadChipAria", { name: short, count })}
                  title={bi(locale, chip.nameEn, chip.nameAr)}
                  data-testid="outcome-lead-chip"
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium leading-4 transition-colors cursor-pointer",
                    active
                      ? "border-maroon-700 bg-maroon-700 text-white"
                      : "border-gulf-100 bg-gulf-100 text-gulf-600 hover:border-gulf-600/40"
                  )}
                >
                  <KindGlyph lead={chip} />
                  <span className="truncate">{t("chipLabel", { name: short, count })}</span>
                </button>
              );
            })}
            {leadFilter ? (
              <button
                onClick={() => onLeadFilter(null)}
                className="link-draw text-[11px] font-medium text-ink-600 cursor-pointer"
                data-testid="outcome-lead-clear"
              >
                {t("clearFilter")}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-ink-600">{t("leadEntitiesEmpty")}</p>
        )}
      </div>

      {/* 3. experts, first six then Show all in place */}
      <div className="mb-3">
        <p className={cn(EYEBROW, "mb-1")} style={{ fontFamily: "inherit" }}>
          {t("experts")}
        </p>
        {data.experts.length ? (
          <>
            <ul className="flex flex-col divide-y divide-sand-100" data-testid="outcome-experts">
              {experts.map((e) => (
                <li
                  key={e.key}
                  className="flex items-center gap-3 py-2"
                  data-testid="outcome-expert-row"
                  onMouseEnter={() => setLaneGlow(e.items.map((i) => i.id), true)}
                  onMouseLeave={() => setLaneGlow(e.items.map((i) => i.id), false)}
                  onFocus={() => setLaneGlow(e.items.map((i) => i.id), true)}
                  onBlur={() => setLaneGlow(e.items.map((i) => i.id), false)}
                >
                  <Avatar name={e.nameEn || e.nameAr} color={e.avatarColor} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {bi(locale, e.nameEn, e.nameAr)}
                      {e.direct ? <DirectChip /> : null}
                    </p>
                    <p className="truncate text-xs text-ink-600">
                      {bi(locale, e.organisationEn ?? "", e.organisationAr ?? "")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {e.domains.slice(0, 2).map((d) => (
                      <Chip key={d.id} tone="gulf" className="hidden sm:inline-flex">
                        {bi(locale, d.nameEn, d.nameAr)}
                      </Chip>
                    ))}
                    <span
                      className="group/inv relative cursor-default text-[11px] text-ink-600 tnum"
                      tabIndex={0}
                      data-testid="expert-involvement"
                    >
                      {t("involvedIn", { count: e.count })}
                      {/* the hover list of the items they touch */}
                      <span className="pointer-events-none invisible absolute bottom-full end-0 z-30 mb-1.5 w-72 opacity-0 transition-all duration-150 group-hover/inv:visible group-hover/inv:opacity-100 group-focus-visible/inv:visible group-focus-visible/inv:opacity-100">
                        <span className="card block p-3 text-start text-xs shadow-[var(--shadow-pop)]">
                          {e.items.slice(0, 8).map((i) => (
                            <span key={i.id} className="block truncate text-ink-600">
                              {i.code ? <span className="tnum">{i.code} · </span> : null}
                              {bi(locale, i.titleEn, i.titleAr)}
                            </span>
                          ))}
                          {e.items.length > 8 ? (
                            <span className="block text-ink-400 tnum">+{e.items.length - 8}</span>
                          ) : null}
                        </span>
                      </span>
                    </span>
                    {e.email ? (
                      <a
                        href={`mailto:${e.email}`}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-sand-100 hover:text-maroon-700"
                        aria-label={ts("email", { name: e.nameEn })}
                      >
                        <Mail className="size-4" />
                      </a>
                    ) : null}
                    {e.expertId ? (
                      <Link
                        href={`/experts/${e.expertId}` as never}
                        className="rounded-lg border border-sand-300 px-2 py-1 text-[11px] font-medium text-ink-600 hover:border-maroon-300 hover:text-maroon-700"
                      >
                        {ts("profile")}
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {data.experts.length > 6 ? (
              <button
                onClick={() => setAllExperts((v) => !v)}
                className="link-draw mt-1 text-xs font-medium text-maroon-700 cursor-pointer"
                data-testid="experts-show-all"
              >
                {allExperts ? t("showLess") : t("showAll", { count: data.experts.length })}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-ink-600">{t("expertsEmpty")}</p>
        )}
      </div>

      {/* 4. sponsors, owners, and managers, collapsed to one row */}
      <div className="card overflow-hidden" data-testid="outcome-leaders">
        <button
          onClick={() => setLeadersOpen((v) => !v)}
          aria-expanded={leadersOpen}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-start cursor-pointer hover:bg-sand-50"
          data-testid="outcome-leaders-toggle"
        >
          <Users2 className="size-4 shrink-0 text-maroon-700" aria-hidden />
          <span className="text-sm font-medium text-ink-900">{t("leaders")}</span>
          <span className="text-xs text-ink-600 tnum">{leaderTotal}</span>
          <ChevronDown
            className={cn(
              "ms-auto size-4 shrink-0 text-ink-400 transition-transform",
              leadersOpen && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        <AnimatePresence initial={false}>
          {leadersOpen ? (
            <motion.div
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="grid gap-x-6 gap-y-4 border-t border-sand-100 px-3.5 py-3 sm:grid-cols-3">
                <LeaderGroup labelKey="sponsors" people={data.leaders.sponsor} />
                <LeaderGroup labelKey="owners" people={data.leaders.owner} />
                <LeaderGroup labelKey="managers" people={data.leaders.manager} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
