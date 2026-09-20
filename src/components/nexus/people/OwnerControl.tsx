"use client";
// CR08 9.1: OwnerControl. Monogram, name, unit, the role as an eyebrow; hover
// (200ms intent) or tap opens the person card popover (radix Popover, focus
// managed, Escape closes, logical placement so RTL mirrors). The compact
// variant (monogram + name) is for cards, panels and drawers. Joint leads
// show the primary and a "+N" that expands to the others.
import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Avatar } from "@/components/ui/primitives";
import { bi, cn } from "@/lib/utils";
import { AskQuestionDialog } from "./AskQuestionDialog";
import { ComposeMessageDialog } from "./ComposeMessageDialog";
import { PersonCard } from "./PersonCard";
import { TeamsPlaceholderDialog } from "./TeamsPlaceholderDialog";
import type { ItemRef, OwnerRef, OwnerRole, PickedPerson } from "./types";

export type { ItemRef, OwnerRef, OwnerRole } from "./types";

/* ------------------------------------------------------------------ */
/* the popover shared by both variants                                  */
/* ------------------------------------------------------------------ */

export function PersonPopover({
  person,
  item,
  align = "end",
  side = "bottom",
  children,
}: {
  person: OwnerRef;
  item?: ItemRef | null;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  children: React.ReactElement;
}) {
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const openedBy = React.useRef<"hover" | "click">("click");
  const openTimer = React.useRef<number | null>(null);
  const closeTimer = React.useRef<number | null>(null);
  const [compose, setCompose] = React.useState<PickedPerson | null>(null);
  const [ask, setAsk] = React.useState<{ person: PickedPerson; expertId: string } | null>(null);
  const [teams, setTeams] = React.useState(false);
  /** CR08 9.1: the backup owner and the delegate are reachable with the same
      actions, so the card can step into them and step back */
  const [viewingId, setViewingId] = React.useState(person.id);
  React.useEffect(() => {
    if (!open) setViewingId(person.id);
  }, [open, person.id]);

  const clearTimers = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };
  React.useEffect(() => clearTimers, []);

  const scheduleOpen = () => {
    if (open) {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      return;
    }
    clearTimers();
    openTimer.current = window.setTimeout(() => {
      openedBy.current = "hover";
      setOpen(true);
    }, 200);
  };
  const scheduleClose = () => {
    clearTimers();
    if (openedBy.current !== "hover") return; // a tapped or keyboard card stays until dismissed
    closeTimer.current = window.setTimeout(() => setOpen(false), 260);
  };

  const trigger = React.cloneElement(children, {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") scheduleOpen();
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") scheduleClose();
    },
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimers();
      openedBy.current = "click";
      setOpen((o) => !o);
    },
    "aria-haspopup": "dialog",
    "aria-expanded": open,
  } as Record<string, unknown>);

  const closeAnd = (fn: () => void) => {
    clearTimers();
    setOpen(false);
    fn();
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={(o) => { clearTimers(); setOpen(o); }}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side={side}
            align={align}
            sideOffset={8}
            collisionPadding={12}
            onOpenAutoFocus={(e) => {
              if (openedBy.current === "hover") e.preventDefault();
            }}
            onPointerEnter={() => {
              if (closeTimer.current) window.clearTimeout(closeTimer.current);
            }}
            onPointerLeave={scheduleClose}
            dir={locale === "ar" ? "rtl" : "ltr"}
            /* CR08: above the full-height drawers (z-60) and the dialogs
               they open (z-75), because a person card is opened from inside
               them and would otherwise be painted underneath, invisibly */
            className="z-[80] w-80 max-w-[calc(100vw-24px)] outline-none"
            aria-label={bi(locale, person.nameEn, person.nameAr)}
            data-testid="person-card-popover"
          >
            <motion.div
              initial={reduced ? false : { opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-sand-300 bg-white shadow-[var(--shadow-pop)]"
            >
              <PersonCard
                personId={viewingId}
                item={item}
                onMessage={(p) => closeAnd(() => setCompose(p))}
                onAsk={(p, expertId) => closeAnd(() => (expertId ? setAsk({ person: p, expertId }) : null))}
                onTeams={() => closeAnd(() => setTeams(true))}
                onFocusPerson={(id) => {
                  // stepping into someone is a commitment: the card stays
                  // until it is dismissed, even when hover opened it
                  openedBy.current = "click";
                  clearTimers();
                  setViewingId(id);
                }}
                onBack={viewingId === person.id ? undefined : () => setViewingId(person.id)}
              />
            </motion.div>
            <Popover.Arrow className="fill-white stroke-sand-300" width={14} height={7} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <ComposeMessageDialog open={Boolean(compose)} onOpenChange={(o) => !o && setCompose(null)} to={compose} item={item} />
      {ask ? (
        <AskQuestionDialog open onOpenChange={(o) => !o && setAsk(null)} person={ask.person} expertId={ask.expertId} item={item} />
      ) : null}
      <TeamsPlaceholderDialog open={teams} onOpenChange={setTeams} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* OwnerControl                                                         */
/* ------------------------------------------------------------------ */

const NAME_BUTTON =
  "group inline-flex min-w-0 items-center gap-2.5 rounded-lg text-start transition-colors hover:bg-sand-100/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 cursor-pointer";

export function OwnerControl({
  owner,
  role,
  extra = 0,
  others,
  item,
  size = "md",
  align = "end",
  className,
}: {
  owner: OwnerRef | null;
  role: OwnerRole;
  /** joint leads beyond the primary; shown as "+N" */
  extra?: number;
  /** the other leads, when known; "+N" expands to them */
  others?: OwnerRef[];
  item?: ItemRef | null;
  size?: "sm" | "md";
  align?: "start" | "end";
  className?: string;
}) {
  const t = useTranslations("people");
  const locale = useLocale();
  const [expanded, setExpanded] = React.useState(false);
  const more = others?.length ?? extra;
  const avatar = size === "sm" ? 28 : 36;

  const eyebrow = (
    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
      {t(`roles.${role}` as never)}
    </span>
  );

  if (!owner) {
    return (
      <div className={cn("inline-flex items-center gap-2.5", className)} data-testid="owner-control" data-role={role} data-empty>
        <span
          className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-ink-200 text-ink-200")}
          style={{ width: avatar, height: avatar }}
          aria-hidden
        >
          <span className="text-xs">?</span>
        </span>
        <span className="min-w-0">
          {eyebrow}
          <span className={cn("block text-ink-400", size === "sm" ? "text-xs" : "text-sm")}>{t("unassigned")}</span>
        </span>
      </div>
    );
  }

  const unit = bi(locale, owner.unitEn ?? "", owner.unitAr ?? "");
  return (
    <div className={cn("inline-flex max-w-full flex-col items-start gap-1.5", className)} data-testid="owner-control" data-role={role} data-size={size}>
      <div className="flex max-w-full items-center gap-2">
        <PersonPopover person={owner} item={item} align={align}>
          <button
            type="button"
            className={cn(NAME_BUTTON, size === "sm" ? "-m-1 p-1" : "-m-1.5 p-1.5")}
            aria-label={t("openCard", { name: bi(locale, owner.nameEn, owner.nameAr) })}
            data-testid="owner-control-trigger"
          >
            <Avatar name={owner.nameEn} color={owner.avatarColor} size={avatar} className="ring-2 ring-white transition-transform group-hover:scale-[1.04]" />
            <span className="min-w-0">
              {eyebrow}
              <span className={cn("block truncate font-medium text-ink-900 group-hover:text-maroon-900", size === "sm" ? "text-[13px] leading-tight" : "text-sm leading-tight")}>
                {bi(locale, owner.nameEn, owner.nameAr)}
              </span>
              {unit ? (
                <span className={cn("block truncate text-ink-600", size === "sm" ? "text-[11px]" : "text-xs")}>{unit}</span>
              ) : null}
            </span>
          </button>
        </PersonPopover>
        {more > 0 ? (
          <button
            type="button"
            onClick={() => others?.length && setExpanded((x) => !x)}
            className={cn(
              "inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-sand-300 bg-sand-50 px-1.5 text-[11px] font-semibold text-ink-600 tnum focus-visible:outline-2 focus-visible:outline-gold-500",
              others?.length ? "cursor-pointer hover:border-maroon-300 hover:text-maroon-700" : "cursor-default"
            )}
            aria-label={t("moreLeadsLabel", { count: more })}
            aria-expanded={others?.length ? expanded : undefined}
            title={t("moreLeadsLabel", { count: more })}
            data-testid="owner-control-more"
          >
            <span dir="ltr">{t("moreLeads", { count: more })}</span>
          </button>
        ) : null}
      </div>
      {expanded && others?.length ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 ps-1" data-testid="owner-control-others">
          {others.map((o) => (
            <OwnerControlCompact key={o.id} owner={o} item={item} size="sm" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Monogram + name only, the same popover. For cards, panels and drawers. */
export function OwnerControlCompact({
  owner,
  item,
  size = "sm",
  align = "start",
  className,
}: {
  owner: OwnerRef;
  item?: ItemRef | null;
  size?: "sm" | "md";
  align?: "start" | "end";
  className?: string;
}) {
  const t = useTranslations("people");
  const locale = useLocale();
  return (
    <PersonPopover person={owner} item={item} align={align}>
      <button
        type="button"
        className={cn(NAME_BUTTON, "-m-1 p-1", className)}
        aria-label={t("openCard", { name: bi(locale, owner.nameEn, owner.nameAr) })}
        data-testid="owner-control-compact"
      >
        <Avatar name={owner.nameEn} color={owner.avatarColor} size={size === "sm" ? 22 : 28} />
        <span className={cn("truncate text-ink-900 group-hover:text-maroon-900", size === "sm" ? "text-xs" : "text-sm")}>
          {bi(locale, owner.nameEn, owner.nameAr)}
        </span>
      </button>
    </PersonPopover>
  );
}
