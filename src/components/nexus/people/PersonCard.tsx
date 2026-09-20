"use client";
// CR08 9.1: the person card inside the OwnerControl popover. Lazily fetches
// GET /api/v1/people/[id]/card (cached for a minute per person and item) and
// renders position, unit breadcrumb, expertise, availability, the HR backup
// owner, the delegate, and the five actions.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Copy, HelpCircle, Mail, MessageSquare, MessagesSquare, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, Button, Chip, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { bi, cn } from "@/lib/utils";
import { absoluteItemLink, type ItemRef, type PersonCardData, type PickedPerson } from "./types";

const cardCache = new Map<string, { at: number; data: PersonCardData }>();
const TTL = 60_000;

export function personCardKey(id: string, item?: ItemRef | null) {
  return `${id}:${item?.type ?? ""}:${item?.id ?? ""}`;
}

export async function fetchPersonCard(id: string, item?: ItemRef | null): Promise<PersonCardData> {
  const key = personCardKey(id, item);
  const hit = cardCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const qs = item ? `?itemType=${encodeURIComponent(item.type)}&itemId=${encodeURIComponent(item.id)}` : "";
  const res = await fetch(`/api/v1/people/${encodeURIComponent(id)}/card${qs}`);
  if (!res.ok) throw new Error(`card ${res.status}`);
  const json = await res.json();
  if (!json.data) throw new Error("card empty");
  cardCache.set(key, { at: Date.now(), data: json.data });
  return json.data as PersonCardData;
}

export function toPicked(card: PersonCardData): PickedPerson {
  return {
    id: card.id,
    nameEn: card.nameEn,
    nameAr: card.nameAr,
    avatarColor: card.avatarColor,
    positionEn: card.positionEn,
    positionAr: card.positionAr,
    unitEn: card.unit?.nameEn ?? null,
    unitAr: card.unit?.nameAr ?? null,
  };
}

const AVAIL_DOT: Record<string, string> = {
  available: "bg-ok",
  limited: "bg-warn",
  unavailable: "bg-danger",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
      {children}
    </p>
  );
}

export function PersonCard({
  personId,
  item,
  onMessage,
  onAsk,
  onTeams,
  onFocusPerson,
  onBack,
  className,
}: {
  personId: string;
  item?: ItemRef | null;
  onMessage: (person: PickedPerson) => void;
  onAsk: (person: PickedPerson, expertId: string | null) => void;
  onTeams: () => void;
  /** CR08 9.1: the backup owner and the delegate carry the same actions, so
      their name swaps the card to their own without leaving the popover */
  onFocusPerson?: (personId: string) => void;
  /** shown while the card is showing someone the viewer stepped into */
  onBack?: () => void;
  className?: string;
}) {
  const t = useTranslations("people.card");
  const locale = useLocale();
  const { toast } = useToast();
  const [card, setCard] = React.useState<PersonCardData | null>(null);
  const [error, setError] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setError(false);
    // stepping into the backup owner or the delegate changes the person: drop
    // the card in hand so the skeleton shows instead of the previous person's
    // facts under the new name
    setCard((c) => (c && c.id === personId ? c : null));
    fetchPersonCard(personId, item)
      .then((data) => {
        if (alive) setCard(data);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [personId, item?.type, item?.id, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  async function copyLink() {
    const target = item ? absoluteItemLink(locale, item.href) : card?.links.profile ? absoluteItemLink(locale, card.links.profile) : card?.email ?? "";
    try {
      await navigator.clipboard.writeText(target);
      toast(t("linkCopied"), "success");
    } catch {
      toast(t("copyFailed"), "error");
    }
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-start gap-2 p-4", className)} role="alert" data-testid="person-card-error">
        <p className="text-sm text-ink-600">{t("error")}</p>
        <Button size="sm" variant="secondary" onClick={() => setTick((x) => x + 1)}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!card) {
    return (
      <div className={cn("flex flex-col gap-3 p-4", className)} aria-busy aria-label={t("loading")} data-testid="person-card-loading">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    );
  }

  const name = bi(locale, card.nameEn, card.nameAr);
  const position = bi(locale, card.positionEn ?? "", card.positionAr ?? "");
  const emailSubject = item ? `About: ${bi(locale, item.titleEn, item.titleAr)}` : "";
  const mailto = `${card.links.email}${emailSubject ? `?subject=${encodeURIComponent(emailSubject)}` : ""}`;
  const askHref = `/ask/c/new?q=${encodeURIComponent(
    item
      ? `${locale === "ar" ? "بشأن" : "About"} ${bi(locale, item.titleEn, item.titleAr)}: ${locale === "ar" ? "ما دور" : "what is the role of"} ${name}?`
      : `${locale === "ar" ? "من هو" : "Who is"} ${name}?`
  )}`;

  return (
    <div className={cn("flex flex-col gap-3.5 p-4", className)} data-testid="person-card">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="-mb-1.5 -mt-1 inline-flex w-fit items-center gap-1 rounded-md text-[11px] font-medium text-maroon-700 hover:text-maroon-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
          data-testid="person-card-back"
        >
          <ChevronLeft className="size-3 flip-rtl" aria-hidden /> {t("back")}
        </button>
      ) : null}
      <div className="flex items-start gap-3">
        <Avatar name={card.nameEn} color={card.avatarColor} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] font-medium leading-tight text-ink-900">{name}</p>
          {position ? <p className="mt-0.5 text-xs text-ink-600">{position}</p> : null}
          {card.breadcrumb.length ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[11px] text-ink-400" data-testid="person-card-unit">
              {card.breadcrumb.map((c, i) => (
                <React.Fragment key={c.id}>
                  {i ? <ChevronRight className="size-3 flip-rtl" aria-hidden /> : null}
                  {i === card.breadcrumb.length - 1 && card.links.unit ? (
                    <Link href={card.links.unit as never} className="link-draw text-ink-600 hover:text-maroon-700">
                      {bi(locale, c.nameEn, c.nameAr)}
                    </Link>
                  ) : (
                    <span>{bi(locale, c.nameEn, c.nameAr)}</span>
                  )}
                </React.Fragment>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <Eyebrow>{t("expertise")}</Eyebrow>
        {card.expertise.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {card.expertise.slice(0, 6).map((d) => (
              <Chip key={d.id} tone="maroon">
                {bi(locale, d.nameEn, d.nameAr)}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-ink-400">{t("noExpertise")}</p>
        )}
      </div>

      {card.availability ? (
        <div className="flex items-center gap-2 text-xs text-ink-600">
          <span className={cn("size-2 rounded-full", AVAIL_DOT[card.availability] ?? "bg-ink-200")} aria-hidden />
          <span>
            <span className="text-ink-400">{t("availability")}: </span>
            {t(`availabilityValues.${card.availability}` as never)}
          </span>
        </div>
      ) : null}

      {card.backupOwner ? (
        <div className="rounded-lg border border-sand-200 bg-sand-50 px-3 py-2" data-testid="person-card-backup">
          <Eyebrow>
            {t("backupOwner")}
            {card.backupOwner.forItem ? <span className="ms-1 normal-case tracking-normal text-ink-400">({t("backupForItem")})</span> : null}
          </Eyebrow>
          <div className="mt-1.5 flex items-center gap-2">
            {onFocusPerson ? (
              <button
                type="button"
                onClick={() => onFocusPerson(card.backupOwner!.id)}
                className="group flex min-w-0 flex-1 items-center gap-2 rounded-md text-start cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
                aria-label={t("openCardOf", { name: bi(locale, card.backupOwner.nameEn, card.backupOwner.nameAr) })}
                data-testid="person-card-backup-open"
              >
                <Avatar name={card.backupOwner.nameEn} color={card.backupOwner.avatarColor} size={24} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-900 group-hover:text-maroon-900">
                  {bi(locale, card.backupOwner.nameEn, card.backupOwner.nameAr)}
                </span>
              </button>
            ) : (
              <>
                <Avatar name={card.backupOwner.nameEn} color={card.backupOwner.avatarColor} size={24} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                  {bi(locale, card.backupOwner.nameEn, card.backupOwner.nameAr)}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() =>
                onMessage({
                  id: card.backupOwner!.id,
                  nameEn: card.backupOwner!.nameEn,
                  nameAr: card.backupOwner!.nameAr,
                  avatarColor: card.backupOwner!.avatarColor,
                })
              }
              className="rounded-md p-1 text-ink-400 hover:bg-white hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500 cursor-pointer"
              aria-label={`${t("actions.message")}: ${bi(locale, card.backupOwner.nameEn, card.backupOwner.nameAr)}`}
            >
              <MessageSquare className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {card.delegate ? (
        <div className="rounded-lg border border-gold-300 bg-gold-100/50 px-3 py-2" data-testid="person-card-delegate">
          <Eyebrow>{t("delegate")}</Eyebrow>
          <div className="mt-1.5 flex items-center gap-2">
            {onFocusPerson ? (
              <button
                type="button"
                onClick={() => onFocusPerson(card.delegate!.id)}
                className="rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
                aria-label={t("openCardOf", { name: bi(locale, card.delegate.nameEn, card.delegate.nameAr) })}
                data-testid="person-card-delegate-open"
              >
                <Avatar name={card.delegate.nameEn} color={card.delegate.avatarColor} size={24} />
              </button>
            ) : (
              <Avatar name={card.delegate.nameEn} color={card.delegate.avatarColor} size={24} />
            )}
            <span className="min-w-0 flex-1">
              {onFocusPerson ? (
                <button
                  type="button"
                  onClick={() => onFocusPerson(card.delegate!.id)}
                  className="block max-w-full truncate rounded-md text-start text-sm text-ink-900 hover:text-maroon-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold-500"
                >
                  {bi(locale, card.delegate.nameEn, card.delegate.nameAr)}
                </button>
              ) : (
                <span className="block truncate text-sm text-ink-900">{bi(locale, card.delegate.nameEn, card.delegate.nameAr)}</span>
              )}
              <span className="block text-[11px] text-ink-600 tnum">
                {card.delegate.from && card.delegate.to
                  ? t("delegateRange", { from: formatDate(card.delegate.from, locale, { style: "medium" }), to: formatDate(card.delegate.to, locale, { style: "medium" }) })
                  : card.delegate.from
                    ? t("delegateFrom", { from: formatDate(card.delegate.from, locale, { style: "medium" }) })
                    : card.delegate.to
                      ? t("delegateUntil", { to: formatDate(card.delegate.to, locale, { style: "medium" }) })
                      : t("delegateOpen")}
              </span>
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5 border-t border-sand-100 pt-3" role="group">
        <Button size="sm" onClick={() => onMessage(toPicked(card))} data-testid="person-card-message">
          <MessageSquare /> {t("actions.message")}
        </Button>
        {card.expertId ? (
          <Button size="sm" variant="secondary" onClick={() => onAsk(toPicked(card), card.expertId)} data-testid="person-card-ask">
            <HelpCircle /> {t("actions.ask")}
          </Button>
        ) : (
          <Link
            href={askHref as never}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-sand-300 bg-white px-3 text-xs font-medium text-ink-900 hover:border-maroon-300 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500 [&_svg]:size-4"
            data-testid="person-card-ask"
          >
            <HelpCircle /> {t("actions.ask")}
          </Link>
        )}
        <a
          href={mailto}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-sand-300 bg-white px-3 text-xs font-medium text-ink-900 hover:border-maroon-300 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500 [&_svg]:size-4"
          data-testid="person-card-email"
        >
          <Mail /> {t("actions.email")}
        </a>
        <Button size="sm" variant="secondary" onClick={copyLink} data-testid="person-card-copy">
          <Copy /> {t("actions.copyLink")}
        </Button>
        <Button size="sm" variant="ghost" className="col-span-2 justify-start text-gulf-600 hover:text-gulf-600" onClick={onTeams} data-testid="person-card-teams">
          <MessagesSquare /> {t("actions.teams")}
        </Button>
        {card.links.profile ? (
          <Link
            href={card.links.profile as never}
            className="col-span-2 inline-flex items-center gap-1.5 px-1 text-[11px] text-ink-400 hover:text-maroon-700 focus-visible:outline-2 focus-visible:outline-gold-500"
            data-testid="person-card-profile"
          >
            <UserRound className="size-3" /> {t("profile")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
