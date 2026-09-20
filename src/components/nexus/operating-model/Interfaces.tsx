"use client";
// CR08 10.2 section 6: interfaces. External: entity cards (what NPC provides
// and receives, focal points on both sides, legal basis, cadence, linked
// processes). Internal: the unit-to-unit matrix (CSS grid with ARIA table
// roles, counts in the cells, flow kinds on hover) beside the chord diagram,
// then the list of interfaces filterable by unit or by a matrix pair, with
// the focal persons as OwnerControls. Unit heads propose changes; editors
// edit, add, and settle the change requests.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Building2, Check, Globe2, Pencil, Plus, Send, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, EmptyState, Input, Label, NativeSelect, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, Tip } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import type { ItemRef, OwnerRef } from "@/components/nexus/people/types";
import type {
  EntityInterfaceView,
  FlowKind,
  InterfaceChangeRequestView,
  InterfaceMatrixCell,
  InterfacesView,
  PersonRef,
  ProcessRef,
  UnitInterfaceView,
  UnitRef,
} from "@/server/services/operating-model";
import { ChordDiagram } from "./ChordDiagram";
import { FLOW_ORDER, FLOW_TONE, NamePlaceholder, SectionBand, SubLabel, displayFont, omFetch, useCadenceWord, useFmt, useServiceLevelWord } from "./shared";

const FLOW_KINDS: FlowKind[] = FLOW_ORDER;
const ENTITY_KINDS = new Set(["ministry", "authority", "agency", "international", "private"]);

function ownerOf(p: PersonRef | null): OwnerRef | null {
  return p ? { id: p.id, nameEn: p.nameEn, nameAr: p.nameAr, avatarColor: p.avatarColor, positionEn: p.positionEn, positionAr: p.positionAr } : null;
}

function processHref(code: string): string {
  return `/processes?p=${encodeURIComponent(code)}`;
}

function Focal({ person, label, item }: { person: PersonRef | null; label: string; item: ItemRef }) {
  const t = useTranslations("operatingModel");
  const owner = ownerOf(person);
  return (
    <div className="min-w-0">
      <SubLabel className="mb-1">{label}</SubLabel>
      {owner ? (
        <OwnerControlCompact owner={owner} item={item} size="sm" />
      ) : (
        <span className="text-xs text-ink-400">{t("interfaces.internal.noFocal")}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* external                                                             */
/* ------------------------------------------------------------------ */

function EntityCard({ item }: { item: EntityInterfaceView }) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const cadenceWord = useCadenceWord();
  const name = bi(locale, item.entity.nameEn, item.entity.nameAr);
  const short = bi(locale, item.entity.shortNameEn, item.entity.shortNameAr);
  const provides = bi(locale, item.providesEn, item.providesAr);
  const receives = bi(locale, item.receivesEn, item.receivesAr);
  const legal = bi(locale, item.legalBasisEn, item.legalBasisAr);
  const kind = ENTITY_KINDS.has(item.entity.kind) ? item.entity.kind : "other";
  const ref: ItemRef = { type: "entity_interface", id: item.id, titleEn: item.entity.nameEn, titleAr: item.entity.nameAr, href: "/operating-model#om-interfaces" };
  return (
    <article className="card card-hover flex flex-col gap-3 p-4" data-testid="entity-card">
      <header className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-gulf-100 text-gulf-600" aria-hidden>
          {kind === "international" ? <Globe2 className="size-4.5" /> : <Building2 className="size-4.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] font-medium leading-snug text-ink-900" style={{ fontFamily: displayFont(locale) }}>
            {name}
          </h4>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            {short && short !== name ? <Chip tone="sand" className="tnum">{short}</Chip> : null}
            <Chip tone="ghost" className="px-0 text-[10px]">{t(`interfaces.external.kind.${kind}` as never)}</Chip>
            {item.cadence ? <Chip tone="gulf">{cadenceWord(item.cadence)}</Chip> : null}
          </p>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-sand-50 px-3 py-2.5">
          <SubLabel className="mb-1 flex items-center gap-1 text-maroon-700">
            <ArrowRight className="size-3 flip-rtl" aria-hidden /> {t("interfaces.external.provides")}
          </SubLabel>
          <p className="text-xs leading-relaxed text-ink-900">{provides || <span className="text-ink-400">{t("interfaces.external.noFocal")}</span>}</p>
        </div>
        <div className="rounded-lg bg-sand-50 px-3 py-2.5">
          <SubLabel className="mb-1 flex items-center gap-1 text-gulf-600">
            <ArrowRight className="size-3 rotate-180 flip-rtl" aria-hidden /> {t("interfaces.external.receives")}
          </SubLabel>
          <p className="text-xs leading-relaxed text-ink-900">{receives || <span className="text-ink-400">{t("interfaces.external.noFocal")}</span>}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Focal person={item.focalNpc} label={t("interfaces.external.focalNpc")} item={ref} />
        <div className="min-w-0">
          <SubLabel className="mb-1">{t("interfaces.external.focalEntity")}</SubLabel>
          {item.focalEntityName ? <NamePlaceholder name={item.focalEntityName} /> : <span className="text-xs text-ink-400">{t("interfaces.external.noFocal")}</span>}
        </div>
      </div>
      {legal ? (
        <p className="text-xs leading-relaxed text-ink-600">
          <span className="font-semibold text-ink-900">{t("interfaces.external.legalBasis")}: </span>
          {legal}
        </p>
      ) : null}
      <div>
        <SubLabel className="mb-1">{t("interfaces.external.processes")}</SubLabel>
        {item.processes.length ? (
          <div className="flex flex-wrap gap-1">
            {item.processes.map((p) => (
              <Link
                key={p.id}
                href={processHref(p.code) as never}
                className="inline-flex items-center gap-1 rounded-md bg-maroon-100 px-2 py-0.5 text-[11px] font-medium leading-4 text-maroon-900 transition-colors hover:bg-maroon-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
                title={bi(locale, p.nameEn, p.nameAr)}
              >
                <span className="tnum">{p.code}</span>
                <span className="max-w-40 truncate">{bi(locale, p.nameEn, p.nameAr)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-xs text-ink-400">{t("interfaces.external.noProcesses")}</span>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* the matrix                                                           */
/* ------------------------------------------------------------------ */

function Matrix({
  units,
  matrix,
  selected,
  hovered,
  pair,
  onHover,
  onSelect,
  onPair,
}: {
  units: UnitRef[];
  matrix: InterfaceMatrixCell[];
  selected: string | null;
  hovered: string | null;
  pair: { from: string; to: string } | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onPair: (p: { from: string; to: string } | null) => void;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const fmt = useFmt();
  const cellOf = React.useMemo(() => new Map(matrix.map((c) => [`${c.fromUnitId}>${c.toUnitId}`, c])), [matrix]);
  const focus = hovered ?? selected;
  const template = `112px repeat(${units.length}, 34px)`;
  return (
    <div className="overflow-auto rounded-xl border border-sand-300 bg-white" style={{ overscrollBehaviorX: "contain" }} data-testid="interface-matrix-scroll">
      <div role="table" aria-label={t("interfaces.internal.matrixAria")} className="min-w-max text-xs" data-testid="interface-matrix">
        <div role="rowgroup">
          <div role="row" className="grid" style={{ gridTemplateColumns: template }}>
            <div role="columnheader" className="sticky start-0 top-0 z-30 flex items-end border-b border-e border-sand-300 bg-sand-50 px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-600 rtl:tracking-normal">
              {t("interfaces.internal.matrixCorner")}
            </div>
            {units.map((u) => (
              <div
                key={u.id}
                role="columnheader"
                aria-label={bi(locale, u.nameEn, u.nameAr)}
                className={cn("sticky top-0 z-20 flex h-14 items-end justify-center border-b border-sand-300 bg-sand-50 pb-1.5", focus === u.id && "bg-maroon-50")}
              >
                <button
                  type="button"
                  onClick={() => onSelect(selected === u.id ? null : u.id)}
                  onMouseEnter={() => onHover(u.id)}
                  onMouseLeave={() => onHover(null)}
                  title={bi(locale, u.nameEn, u.nameAr)}
                  aria-pressed={selected === u.id}
                  className={cn(
                    "cursor-pointer rounded px-0.5 text-[10px] font-semibold tnum focus-visible:outline-2 focus-visible:outline-gold-500",
                    focus === u.id ? "text-maroon-900" : "text-ink-600 hover:text-maroon-700"
                  )}
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  {u.code}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {units.map((from) => (
            <div key={from.id} role="row" className="grid" style={{ gridTemplateColumns: template }}>
              <div
                role="rowheader"
                className={cn("sticky start-0 z-10 flex items-center border-b border-e border-sand-200 bg-white px-2 py-1", focus === from.id && "bg-maroon-50")}
              >
                <button
                  type="button"
                  onClick={() => onSelect(selected === from.id ? null : from.id)}
                  onMouseEnter={() => onHover(from.id)}
                  onMouseLeave={() => onHover(null)}
                  title={bi(locale, from.nameEn, from.nameAr)}
                  aria-pressed={selected === from.id}
                  className={cn(
                    "cursor-pointer truncate rounded px-0.5 text-start text-[11px] font-semibold tnum focus-visible:outline-2 focus-visible:outline-gold-500",
                    focus === from.id ? "text-maroon-900" : "text-ink-900 hover:text-maroon-700"
                  )}
                >
                  {from.code}
                </button>
              </div>
              {units.map((to) => {
                const cell = cellOf.get(`${from.id}>${to.id}`);
                const count = cell?.count ?? 0;
                const lit = focus && (focus === from.id || focus === to.id);
                const isPair = pair?.from === from.id && pair?.to === to.id;
                const label = t("interfaces.internal.cellAria", { from: from.code, to: to.code, count });
                const kinds = cell ? FLOW_KINDS.filter((k) => cell.kinds[k] > 0).map((k) => `${t(`interfaces.internal.flow.${k}` as never)} ${fmt.n(cell.kinds[k], 0)}`) : [];
                const body = (
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={isPair}
                    disabled={!count}
                    onClick={() => onPair(isPair ? null : { from: from.id, to: to.id })}
                    className={cn(
                      "flex h-7 w-full items-center justify-center text-[11px] font-semibold tnum transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500",
                      count ? "cursor-pointer text-maroon-900" : "cursor-default text-ink-200",
                      isPair && "ring-2 ring-inset ring-gold-500"
                    )}
                    style={{
                      backgroundColor: count
                        ? `color-mix(in srgb, var(--color-maroon-700) ${Math.min(60, 12 + count * 14)}%, white)`
                        : from.id === to.id
                          ? "var(--color-sand-100)"
                          : "transparent",
                      color: count >= 3 ? "#ffffff" : undefined,
                    }}
                    data-testid="interface-matrix-cell"
                    data-count={count}
                  >
                    {count ? fmt.n(count, 0) : ""}
                  </button>
                );
                return (
                  <div key={to.id} role="cell" className={cn("border-b border-sand-200", lit && "bg-maroon-50/60")}>
                    {count ? (
                      <Tip
                        content={
                          <span className="block">
                            <span className="block font-semibold">{t("interfaces.internal.cellHint", { from: bi(locale, from.nameEn, from.nameAr), to: bi(locale, to.nameEn, to.nameAr) })}</span>
                            <span className="block text-ink-600">{kinds.join(", ")}</span>
                          </span>
                        }
                      >
                        {body}
                      </Tip>
                    ) : (
                      body
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the propose dialog                                                   */
/* ------------------------------------------------------------------ */

function ProposeDialog({ iface, onClose, onSent }: { iface: UnitInterfaceView; onClose: () => void; onSent: () => void }) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const valid = text.trim().length >= 5;
  async function send() {
    setBusy(true);
    const res = await omFetch<{ id: string; notified: number }>("/api/v1/operating-model/interfaces", {
      method: "POST",
      body: { kind: "change_request", interfaceId: iface.id, text: text.trim() },
    });
    setBusy(false);
    if (res.ok) {
      toast(t("interfaces.propose.sent"), "success");
      onSent();
      onClose();
    } else {
      toast(res.status === 403 ? t("actions.forbidden") : t("interfaces.propose.failed"), "error");
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("interfaces.propose.title")} data-testid="propose-dialog">
        <p className="mb-1 text-xs font-semibold text-maroon-700">
          {t("interfaces.propose.on", { from: bi(locale, iface.fromUnit.nameEn, iface.fromUnit.nameAr), to: bi(locale, iface.toUnit.nameEn, iface.toUnit.nameAr) })}
        </p>
        <p className="mb-3 text-xs text-ink-600">{t("interfaces.propose.hint")}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void send();
          }}
        >
          <Label htmlFor="propose-text">{t("interfaces.propose.text")}</Label>
          <Textarea
            id="propose-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("interfaces.propose.placeholder")}
            maxLength={2000}
            autoFocus
            data-testid="propose-text"
          />
          {text.length > 0 && !valid ? <p className="mt-1 text-xs text-danger">{t("interfaces.propose.tooShort")}</p> : null}
          <div className="mt-4 flex items-center gap-2">
            <Button type="submit" disabled={!valid} loading={busy} data-testid="propose-send">
              <Send /> {t("interfaces.propose.send")}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("actions.cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* the edit dialog                                                      */
/* ------------------------------------------------------------------ */

type Draft = {
  id?: string;
  fromUnitId: string;
  toUnitId: string;
  flowKind: FlowKind;
  descriptionEn: string;
  descriptionAr: string;
  triggerEn: string;
  triggerAr: string;
  cadence: string;
  serviceLevel: string;
  processId: string;
  status: "active" | "retired";
};

function draftOf(i: UnitInterfaceView | null, units: UnitRef[]): Draft {
  return {
    id: i?.id,
    fromUnitId: i?.fromUnit.id ?? units[0]?.id ?? "",
    toUnitId: i?.toUnit.id ?? units[1]?.id ?? "",
    flowKind: i?.flowKind ?? "data",
    descriptionEn: i?.descriptionEn ?? "",
    descriptionAr: i?.descriptionAr ?? "",
    triggerEn: i?.triggerEn ?? "",
    triggerAr: i?.triggerAr ?? "",
    cadence: i?.cadence ?? "",
    serviceLevel: i?.serviceLevel ?? "",
    processId: i?.process?.id ?? "",
    status: i?.status === "retired" ? "retired" : "active",
  };
}

function EditDialog({
  initial,
  units,
  processes,
  onClose,
  onSaved,
}: {
  initial: Draft;
  units: UnitRef[];
  processes: ProcessRef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const { toast } = useToast();
  const [d, setD] = React.useState<Draft>(initial);
  const [busy, setBusy] = React.useState(false);
  const same = d.fromUnitId === d.toUnitId;
  const valid = d.fromUnitId && d.toUnitId && !same;
  async function save() {
    setBusy(true);
    const body = {
      kind: "internal",
      ...(d.id ? { id: d.id } : {}),
      fromUnitId: d.fromUnitId,
      toUnitId: d.toUnitId,
      flowKind: d.flowKind,
      descriptionEn: d.descriptionEn.trim() || null,
      descriptionAr: d.descriptionAr.trim() || null,
      triggerEn: d.triggerEn.trim() || null,
      triggerAr: d.triggerAr.trim() || null,
      cadence: d.cadence.trim() || null,
      serviceLevel: d.serviceLevel.trim() || null,
      processId: d.processId || null,
      status: d.status,
    };
    const res = await omFetch("/api/v1/operating-model/interfaces", { method: d.id ? "PATCH" : "POST", body });
    setBusy(false);
    if (res.ok) {
      toast(t("interfaces.edit.saved"), "success");
      onSaved();
      onClose();
    } else {
      toast(res.status === 403 ? t("actions.forbidden") : t("actions.failed"), "error");
    }
  }
  const unitOption = (u: UnitRef) => (
    <option key={u.id} value={u.id}>
      {u.code} {bi(locale, u.nameEn, u.nameAr)}
    </option>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={d.id ? t("interfaces.edit.editTitle") : t("interfaces.edit.addTitle")} className="max-h-[88vh] w-[min(680px,94vw)] overflow-y-auto" data-testid="interface-dialog">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void save();
          }}
        >
          <div>
            <Label htmlFor="if-from">{t("interfaces.edit.fromUnit")}</Label>
            <NativeSelect id="if-from" value={d.fromUnitId} onChange={(e) => setD({ ...d, fromUnitId: e.target.value })}>
              {units.map(unitOption)}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="if-to">{t("interfaces.edit.toUnit")}</Label>
            <NativeSelect id="if-to" value={d.toUnitId} onChange={(e) => setD({ ...d, toUnitId: e.target.value })}>
              {units.map(unitOption)}
            </NativeSelect>
            {same ? <p className="mt-1 text-xs text-danger">{t("interfaces.edit.sameUnit")}</p> : null}
          </div>
          <div>
            <Label htmlFor="if-kind">{t("interfaces.edit.flowKind")}</Label>
            <NativeSelect id="if-kind" value={d.flowKind} onChange={(e) => setD({ ...d, flowKind: e.target.value as FlowKind })}>
              {FLOW_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`interfaces.internal.flow.${k}` as never)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="if-status">{t("interfaces.edit.status")}</Label>
            <NativeSelect id="if-status" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as "active" | "retired" })}>
              <option value="active">{t("interfaces.internal.status.active")}</option>
              <option value="retired">{t("interfaces.internal.status.retired")}</option>
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="if-desc-en">{t("interfaces.edit.descriptionEn")}</Label>
            <Textarea id="if-desc-en" dir="ltr" className="min-h-20" maxLength={1000} value={d.descriptionEn} onChange={(e) => setD({ ...d, descriptionEn: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="if-desc-ar">{t("interfaces.edit.descriptionAr")}</Label>
            <Textarea id="if-desc-ar" dir="rtl" className="min-h-20" maxLength={1000} value={d.descriptionAr} onChange={(e) => setD({ ...d, descriptionAr: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="if-trig-en">{t("interfaces.edit.triggerEn")}</Label>
            <Input id="if-trig-en" dir="ltr" maxLength={300} value={d.triggerEn} onChange={(e) => setD({ ...d, triggerEn: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="if-trig-ar">{t("interfaces.edit.triggerAr")}</Label>
            <Input id="if-trig-ar" dir="rtl" maxLength={300} value={d.triggerAr} onChange={(e) => setD({ ...d, triggerAr: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="if-cadence">{t("interfaces.edit.cadence")}</Label>
            <Input id="if-cadence" maxLength={60} value={d.cadence} onChange={(e) => setD({ ...d, cadence: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="if-sl">{t("interfaces.edit.serviceLevel")}</Label>
            <Input id="if-sl" maxLength={200} value={d.serviceLevel} onChange={(e) => setD({ ...d, serviceLevel: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="if-process">{t("interfaces.edit.process")}</Label>
            <NativeSelect id="if-process" value={d.processId} onChange={(e) => setD({ ...d, processId: e.target.value })}>
              <option value="">{t("interfaces.edit.noProcess")}</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} {bi(locale, p.nameEn, p.nameAr)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="mt-1 flex items-center gap-2 sm:col-span-2">
            <Button type="submit" disabled={!valid} loading={busy} data-testid="interface-save">
              {t("interfaces.edit.save")}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("actions.cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* one interface in the list                                            */
/* ------------------------------------------------------------------ */

function InterfaceCard({
  item,
  canEdit,
  onPropose,
  onEdit,
}: {
  item: UnitInterfaceView;
  canEdit: boolean;
  onPropose: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const cadenceWord = useCadenceWord();
  const serviceLevelWord = useServiceLevelWord();
  const from = bi(locale, item.fromUnit.nameEn, item.fromUnit.nameAr);
  const to = bi(locale, item.toUnit.nameEn, item.toUnit.nameAr);
  const description = bi(locale, item.descriptionEn, item.descriptionAr);
  const trigger = bi(locale, item.triggerEn, item.triggerAr);
  const ref: ItemRef = {
    type: "unit_interface",
    id: item.id,
    titleEn: `${item.fromUnit.code} to ${item.toUnit.code}: ${item.descriptionEn ?? item.flowKind}`,
    titleAr: `${item.fromUnit.nameAr} إلى ${item.toUnit.nameAr}: ${item.descriptionAr ?? item.flowKind}`,
    href: "/operating-model#om-interfaces",
  };
  const status = item.status === "retired" ? "retired" : item.status === "draft" ? "draft" : "active";
  return (
    <article className="card flex flex-col gap-3 p-4" data-testid="interface-card" data-from={item.fromUnit.code} data-to={item.toUnit.code}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
          <span title={from}>
            <span className="text-[10px] font-semibold text-ink-400 tnum">{item.fromUnit.code}</span> {from}
          </span>
          <ArrowRight className="size-4 shrink-0 text-maroon-700 flip-rtl" aria-hidden />
          <span title={to}>
            <span className="text-[10px] font-semibold text-ink-400 tnum">{item.toUnit.code}</span> {to}
          </span>
        </span>
        <span className="ms-auto flex flex-wrap items-center gap-1.5">
          <Chip tone={FLOW_TONE[item.flowKind]} data-testid="flow-chip">{t(`interfaces.internal.flow.${item.flowKind}` as never)}</Chip>
          <Chip tone={status === "active" ? "ok" : status === "draft" ? "warn" : "sand"}>{t(`interfaces.internal.status.${status}` as never)}</Chip>
        </span>
      </header>
      {description ? <p className="text-sm leading-relaxed text-ink-900">{description}</p> : null}
      <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        {trigger ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400 rtl:tracking-normal">{t("interfaces.internal.trigger")}</dt>
            <dd className="mt-0.5 text-ink-900">{trigger}</dd>
          </div>
        ) : null}
        {item.cadence ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400 rtl:tracking-normal">{t("interfaces.internal.cadence")}</dt>
            <dd className="mt-0.5 text-ink-900">{cadenceWord(item.cadence)}</dd>
          </div>
        ) : null}
        {item.serviceLevel ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400 rtl:tracking-normal">{t("interfaces.internal.serviceLevel")}</dt>
            <dd className="mt-0.5 text-ink-900">{serviceLevelWord(item.serviceLevel)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400 rtl:tracking-normal">{t("interfaces.internal.process")}</dt>
          <dd className="mt-0.5">
            {item.process ? (
              <Link href={processHref(item.process.code) as never} className="link-draw font-medium text-maroon-700" title={bi(locale, item.process.nameEn, item.process.nameAr)}>
                <span className="tnum">{item.process.code}</span> {bi(locale, item.process.nameEn, item.process.nameAr)}
              </Link>
            ) : (
              <span className="text-ink-400">{t("interfaces.internal.noProcess")}</span>
            )}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-sand-100 pt-3">
        <Focal person={item.focalFrom} label={t("interfaces.internal.focalFrom")} item={ref} />
        <Focal person={item.focalTo} label={t("interfaces.internal.focalTo")} item={ref} />
        <span className="ms-auto flex items-center gap-1.5">
          {item.canPropose ? (
            <Button size="sm" variant="secondary" onClick={onPropose} data-testid="interface-propose">
              <Send /> {t("interfaces.internal.propose")}
            </Button>
          ) : null}
          {canEdit ? (
            <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t("interfaces.internal.editAria", { from, to })} data-testid="interface-edit">
              <Pencil /> {t("actions.edit")}
            </Button>
          ) : null}
        </span>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* change requests                                                      */
/* ------------------------------------------------------------------ */

function ChangeRequests({ requests, canEdit, onChanged }: { requests: InterfaceChangeRequestView[]; canEdit: boolean; onChanged: () => void }) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const fmt = useFmt();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  async function resolve(id: string, status: "approved" | "declined") {
    setBusy(id);
    const res = await omFetch("/api/v1/operating-model/interfaces", { method: "PATCH", body: { kind: "resolve", id, status } });
    setBusy(null);
    if (res.ok) {
      toast(status === "approved" ? t("interfaces.requests.approved") : t("interfaces.requests.declined"), "success");
      onChanged();
    } else {
      toast(res.status === 403 ? t("actions.forbidden") : t("actions.failed"), "error");
    }
  }
  return (
    <div className="card p-4 sm:p-5" data-testid="change-requests">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-base text-ink-900" style={{ fontFamily: displayFont(locale) }}>
            {t("interfaces.requests.title")}
          </h4>
          <p className="text-xs text-ink-600">{canEdit ? t("interfaces.requests.hint") : t("interfaces.requests.mineHint")}</p>
        </div>
        <Chip tone="sand" className="tnum">{t("interfaces.requests.count", { count: requests.length })}</Chip>
      </div>
      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-sand-300 bg-sand-50 px-3 py-4 text-center text-xs text-ink-600">{t("interfaces.requests.emptyHint")}</p>
      ) : (
        <ol className="space-y-2">
          {requests.map((r) => {
            const status = r.status === "approved" ? "approved" : r.status === "declined" ? "declined" : "open";
            return (
              <li key={r.id} className="rounded-lg border border-sand-200 px-3 py-2.5" data-testid="change-request" data-status={status}>
                <div className="flex flex-wrap items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-900">{r.text}</p>
                  <Chip tone={status === "approved" ? "ok" : status === "declined" ? "danger" : "warn"}>{t(`interfaces.requests.status.${status}` as never)}</Chip>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-600">
                  {r.fromUnit && r.toUnit ? (
                    <span className="tnum">
                      {r.fromUnit.code} <ArrowRight className="inline size-3 flip-rtl" aria-hidden /> {r.toUnit.code}
                    </span>
                  ) : null}
                  <span>{t("interfaces.requests.by", { name: r.requestedBy ? bi(locale, r.requestedBy.nameEn, r.requestedBy.nameAr) : t("interfaces.requests.unknown"), date: fmt.d(r.createdAt) })}</span>
                </p>
                {canEdit && status === "open" ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Button size="sm" onClick={() => void resolve(r.id, "approved")} loading={busy === r.id} data-testid="request-approve">
                      <Check /> {t("interfaces.requests.approve")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void resolve(r.id, "declined")} disabled={busy === r.id} data-testid="request-decline">
                      <X /> {t("interfaces.requests.decline")}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the section                                                          */
/* ------------------------------------------------------------------ */

export function Interfaces({
  interfaces,
  allUnits,
  processes,
  canEdit,
  n,
}: {
  interfaces: InterfacesView;
  allUnits: UnitRef[];
  processes: ProcessRef[];
  canEdit: boolean;
  n: number;
}) {
  const t = useTranslations("operatingModel");
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [pair, setPair] = React.useState<{ from: string; to: string } | null>(null);
  const [proposing, setProposing] = React.useState<UnitInterfaceView | null>(null);
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const unitsById = React.useMemo(() => new Map(interfaces.units.map((u) => [u.id, u])), [interfaces.units]);
  const shown = React.useMemo(() => {
    let list = interfaces.internal;
    if (pair) list = list.filter((i) => i.fromUnit.id === pair.from && i.toUnit.id === pair.to);
    else if (selected) list = list.filter((i) => i.fromUnit.id === selected || i.toUnit.id === selected);
    return list;
  }, [interfaces.internal, pair, selected]);

  const select = (id: string | null) => {
    setSelected(id);
    setPair(null);
  };
  const refresh = () => router.refresh();

  const filterLabel = pair
    ? t("interfaces.internal.showingPair", {
        from: unitsById.get(pair.from)?.code ?? "",
        to: unitsById.get(pair.to)?.code ?? "",
      })
    : selected
      ? t("interfaces.internal.showing", { unit: bi(locale, unitsById.get(selected)?.nameEn, unitsById.get(selected)?.nameAr) })
      : null;

  return (
    <SectionBand id="om-interfaces" n={n} eyebrow={t("section.n", { n })} title={t("interfaces.title")} hint={t("interfaces.hint")} testId="om-interfaces">
      {/* external */}
      <div className="mb-10" data-testid="external-interfaces">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-lg text-ink-900" style={{ fontFamily: displayFont(locale) }}>
              {t("interfaces.external.title")}
            </h3>
            <p className="text-xs text-ink-600">{t("interfaces.external.hint")}</p>
          </div>
          <Chip tone="sand" className="tnum">{t("interfaces.external.count", { count: interfaces.external.length })}</Chip>
        </div>
        {interfaces.external.length === 0 ? (
          <EmptyState icon={<Globe2 />} title={t("interfaces.external.empty")} hint={t("interfaces.external.emptyHint")} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {interfaces.external.map((e) => (
              <EntityCard key={e.id} item={e} />
            ))}
          </div>
        )}
      </div>

      {/* internal */}
      <div data-testid="internal-interfaces">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-lg text-ink-900" style={{ fontFamily: displayFont(locale) }}>
              {t("interfaces.internal.title")}
            </h3>
            <p className="max-w-3xl text-xs text-ink-600">{t("interfaces.internal.hint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="sand" className="tnum">{t("interfaces.internal.count", { count: interfaces.internal.length })}</Chip>
            {canEdit ? (
              <Button size="sm" variant="secondary" onClick={() => setEditing(draftOf(null, allUnits))} data-testid="interface-add">
                <Plus /> {t("interfaces.internal.add")}
              </Button>
            ) : null}
          </div>
        </div>

        {interfaces.internal.length === 0 ? (
          <EmptyState icon={<Building2 />} title={t("interfaces.internal.empty")} hint={t("interfaces.internal.emptyHint")} />
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.9fr)] lg:items-start">
              <Matrix
                units={interfaces.units}
                matrix={interfaces.matrix}
                selected={selected}
                hovered={hovered}
                pair={pair}
                onHover={setHovered}
                onSelect={select}
                onPair={(p) => {
                  setPair(p);
                  if (p) setSelected(null);
                }}
              />
              <div className="card p-3">
                <ChordDiagram units={interfaces.units} chord={interfaces.chord} selected={selected} hovered={hovered} onHover={setHovered} onSelect={select} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5" data-testid="flow-legend">
              <span className="text-[11px] font-semibold text-ink-600">{t("interfaces.internal.legend")}</span>
              {FLOW_KINDS.map((k) => (
                <Chip key={k} tone={FLOW_TONE[k]}>
                  {t(`interfaces.internal.flow.${k}` as never)}
                </Chip>
              ))}
            </div>

            {/* the list */}
            <div ref={listRef} className="mt-8 scroll-mt-28" data-testid="interface-list">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h4 className="text-base text-ink-900" style={{ fontFamily: displayFont(locale) }}>
                  {t("interfaces.internal.listTitle")}
                </h4>
                <label className="flex items-center gap-2 text-xs text-ink-600">
                  <span>{t("interfaces.internal.filterUnit")}</span>
                  <NativeSelect className="h-8 w-56 cursor-pointer text-xs" value={pair ? "" : selected ?? ""} onChange={(e) => select(e.target.value || null)} data-testid="interface-filter-unit">
                    <option value="">{t("interfaces.internal.allUnits")}</option>
                    {interfaces.units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} {bi(locale, u.nameEn, u.nameAr)}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                {filterLabel ? (
                  <span className="flex items-center gap-2 text-xs text-ink-600" role="status" aria-live="polite">
                    <span className="font-medium text-maroon-900">{filterLabel}</span>
                    <button type="button" onClick={() => select(null)} className="cursor-pointer font-medium text-maroon-700 underline-offset-4 hover:underline">
                      {t("interfaces.internal.clear")}
                    </button>
                  </span>
                ) : null}
                <Chip tone="sand" className="ms-auto tnum">{t("interfaces.internal.count", { count: shown.length })}</Chip>
              </div>
              {shown.length === 0 ? (
                <EmptyState title={t("interfaces.internal.empty")} hint={t("interfaces.internal.emptyHint")} />
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {shown.map((i) => (
                    <InterfaceCard key={i.id} item={i} canEdit={canEdit} onPropose={() => setProposing(i)} onEdit={() => setEditing(draftOf(i, allUnits))} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-8">
          <ChangeRequests requests={interfaces.changeRequests} canEdit={canEdit} onChanged={refresh} />
        </div>
      </div>

      {proposing ? <ProposeDialog iface={proposing} onClose={() => setProposing(null)} onSent={refresh} /> : null}
      {editing ? <EditDialog initial={editing} units={allUnits} processes={processes} onClose={() => setEditing(null)} onSaved={refresh} /> : null}
    </SectionBand>
  );
}
