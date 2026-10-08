"use client";
// CR07 3.4: the unit panel. It opens beneath the chart, in the language of the
// outcome panel: a mist-100 surface, section eyebrows, and everything the
// structure knows about one unit. CR08 1: the header stays, the sections sit
// behind a tab strip defined as one array (UnitPanelTabs.tsx) so a later
// module can append a tab, the panel registers itself with the Ask EnviroAI
// launcher, and a unit head can file a change request that reaches every
// Super Admin, with a status chip on each of their own requests.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChevronRight, Link as LinkIcon, MessageSquarePlus, Send, Users, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, Button, Chip, Label, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import type { UnitPanelData } from "@/server/services/organisation";
import { UNIT_PANEL_TABS, unitItemRef } from "./UnitPanelTabs";

function otherLang(locale: string, en: string, ar: string): string {
  return locale === "ar" ? en : ar;
}

const STATUS_TONE: Record<string, "warn" | "ok" | "mist"> = {
  open: "warn",
  resolved: "ok",
  declined: "mist",
};

/* ------------------------------------------------------------------ */
/* the change request form (CR08 1.2)                                   */
/* ------------------------------------------------------------------ */

function RequestChange({ data, onSent }: { data: UnitPanelData; onSent: () => void }) {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const uid = React.useId();
  const [open, setOpen] = React.useState(false);
  const [what, setWhat] = React.useState("");
  const [why, setWhy] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function send() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/organisation/editor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "requests.create", unitId: data.unit.id, what: what.trim(), why: why.trim() || undefined }),
      });
      if (!res.ok) {
        toast(t("request.failed"), "error");
        return;
      }
      toast(t("request.sent"), "success");
      setWhat("");
      setWhy("");
      setOpen(false);
      onSent();
    } catch {
      toast(t("request.failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4" data-testid="org-request-change">
      <div className="flex flex-wrap items-center gap-2">
        {data.canRequestChange ? (
          <Button
            size="sm"
            variant={open ? "ghost" : "secondary"}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={`${uid}-form`}
            data-testid="org-request-open"
          >
            <MessageSquarePlus /> {t("request.button")}
          </Button>
        ) : null}
        {data.myRequests.length ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400 rtl:tracking-normal">{t("request.mine")}</span>
        ) : null}
        {data.myRequests.slice(0, 4).map((r) => (
          <span
            key={r.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-ink-900 shadow-[var(--shadow-paper)]"
            title={r.what}
            data-testid="org-request-chip"
          >
            <span className="max-w-56 truncate">{r.what}</span>
            <Chip tone={STATUS_TONE[r.status] ?? "mist"}>{t(`request.status.${r.status}` as never)}</Chip>
            <span className="text-ink-400 tnum">{formatDate(r.createdAt, locale, { style: "short" })}</span>
          </span>
        ))}
      </div>
      {open ? (
        <div id={`${uid}-form`} className="mt-3 rounded-xl border border-mist-300 bg-white p-4 shadow-[var(--shadow-paper)]">
          <p className="text-sm font-medium text-ink-900">{t("request.title")}</p>
          <p className="mt-0.5 text-xs text-ink-600">{t("request.hint")}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <Label htmlFor={`${uid}-what`}>{t("request.what")}</Label>
              <Textarea
                id={`${uid}-what`}
                value={what}
                onChange={(e) => setWhat(e.target.value)}
                placeholder={t("request.whatPlaceholder")}
                className="min-h-20"
                data-testid="org-request-what"
              />
            </div>
            <div>
              <Label htmlFor={`${uid}-why`}>{t("request.why")}</Label>
              <Textarea
                id={`${uid}-why`}
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder={t("request.whyPlaceholder")}
                className="min-h-20"
                data-testid="org-request-why"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" loading={busy} disabled={what.trim().length < 3} onClick={send} data-testid="org-request-send">
              <Send /> {t("request.send")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The panel                                                            */
/* ------------------------------------------------------------------ */

export function UnitPanel({
  data,
  onClose,
  onSelectUnit,
}: {
  data: UnitPanelData;
  onClose: () => void;
  onSelectUnit: (code: string) => void;
}) {
  const t = useTranslations("organisation");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const { toast } = useToast();
  const baseId = React.useId();
  const unit = data.unit;
  const name = bi(locale, unit.nameEn, unit.nameAr);
  const alt = otherLang(locale, unit.nameEn, unit.nameAr);
  const publishedHead = bi(locale, unit.headNameEn ?? "", unit.headNameAr ?? "");
  const publishedTitle = bi(locale, unit.headTitleEn ?? "", unit.headTitleAr ?? "");
  const headName = data.head ? bi(locale, data.head.nameEn, data.head.nameAr) : publishedHead;
  const headTitle = data.head ? bi(locale, data.head.positionEn ?? "", data.head.positionAr ?? "") || publishedTitle : publishedTitle;

  const tabs = React.useMemo(() => UNIT_PANEL_TABS.filter((tab) => !tab.hidden?.(data)), [data]);
  const [tab, setTab] = React.useState(tabs[0]?.key ?? "overview");
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const active = tabs.find((x) => x.key === tab) ?? tabs[0];

  // a new unit starts on its first tab; a server refresh of the same unit
  // (the launcher, a sent request) keeps the reader's tab
  const firstKey = tabs[0]?.key ?? "overview";
  React.useEffect(() => {
    setTab(firstKey);
  }, [unit.id, firstKey]);

  function onTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const forward = e.key === "ArrowRight" ? (isRtl ? -1 : 1) : isRtl ? 1 : -1;
    const next = (index + forward + tabs.length) % tabs.length;
    setTab(tabs[next].key);
    tabRefs.current[next]?.focus();
  }

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?unit=${encodeURIComponent(unit.code)}`;
    void navigator.clipboard?.writeText(url);
    toast(t("panel.linkCopied"), "success");
  }

  return (
    <div className="rounded-2xl bg-mist-100" data-testid="org-unit-panel">
      {/* CR08 2.3: the Ask EnviroAI launcher knows which unit is open */}
      <AskContextItem
        item={{
          kind: "unit",
          id: unit.id,
          code: unit.code,
          titleEn: unit.nameEn,
          titleAr: unit.nameAr,
          href: `/organisation?unit=${encodeURIComponent(unit.code)}`,
        }}
      />
      <div className="px-4 py-5 sm:px-7 sm:py-6">
        {/* 1. header */}
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-2xl flex-1">
            {data.breadcrumb.length ? (
              <nav aria-label={t("panel.breadcrumb")} className="mb-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-ink-600">
                {data.breadcrumb.map((crumb, i) => (
                  <React.Fragment key={crumb.id}>
                    {i > 0 ? <ChevronRight className="size-3 shrink-0 text-ink-400 flip-rtl" aria-hidden /> : null}
                    <button
                      type="button"
                      onClick={() => onSelectUnit(crumb.code)}
                      className="link-draw cursor-pointer rounded text-ink-600 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
                    >
                      {bi(locale, crumb.nameEn, crumb.nameAr)}
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            ) : null}
            <h2 style={{ fontSize: 28, lineHeight: 1.2 }}>{name}</h2>
            <p className="mt-0.5 text-sm text-ink-400">{alt}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Chip tone="aqua">{bi(locale, data.levelNameEn, data.levelNameAr)}</Chip>
              <Chip tone="mist">
                <Users className="size-3" aria-hidden />
                {t("panel.headcount", { count: unit.headcountTotal })}
              </Chip>
              {unit.policyCount > 0 ? <Chip tone="navy">{t("policyChip", { count: unit.policyCount })}</Chip> : null}
              {!unit.isActive ? <Chip tone="ghost">{t("panel.inactive")}</Chip> : null}
            </div>
          </div>
          <div className="flex items-start gap-3">
            {/* CR08 9.1: the head who holds an account carries the person card;
                the head published on enviroai.demo with no account keeps the plain
                block beneath, because there is nobody to open a card for */}
            {data.head ? (
              <div className="rounded-xl bg-white px-3 py-2 shadow-[var(--shadow-paper)]" data-testid="unit-head-owner">
                <OwnerControl owner={data.head} role="unit_head" size="md" align="end" item={unitItemRef(unit)} />
                {/* ps-[46px]: the position lines up with the name, past the 36px monogram and its gap */}
                {headTitle ? <span className="mt-0.5 block max-w-64 truncate ps-[46px] text-xs text-ink-600">{headTitle}</span> : null}
              </div>
            ) : headName ? (
              <div className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 shadow-[var(--shadow-paper)]">
                <Avatar name={headName} color="navy" size={36} />
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-600 rtl:tracking-normal">{t("panel.head")}</span>
                  <span className="block truncate text-sm font-medium text-ink-900">{headName}</span>
                  {headTitle ? <span className="block truncate text-xs text-ink-600">{headTitle}</span> : null}
                </span>
              </div>
            ) : (
              <span className="rounded-xl bg-white px-3 py-2 text-xs text-ink-600 shadow-[var(--shadow-paper)]">{t("headVacant")}</span>
            )}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={copyLink}
                aria-label={t("panel.copyLink")}
                className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
              >
                <LinkIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("panel.close")}
                data-testid="org-panel-close"
                className="cursor-pointer rounded-lg p-1.5 text-ink-600 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* CR08 1.2: the head's change request and its status */}
        {data.canRequestChange || data.myRequests.length ? (
          <RequestChange data={data} onSent={() => router.refresh()} />
        ) : null}

        {/* 2. the tab strip, one array */}
        <div
          role="tablist"
          aria-label={t("panel.tabsAria")}
          className="mt-6 inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg bg-white p-0.5 shadow-[var(--shadow-paper)]"
          data-testid="org-panel-tabs"
        >
          {tabs.map((def, i) => {
            const isActive = def.key === active?.key;
            const count = def.count ? def.count(data) : null;
            return (
              <button
                key={def.key}
                type="button"
                role="tab"
                id={`${baseId}-tab-${def.key}`}
                aria-selected={isActive}
                aria-controls={`${baseId}-panel-${def.key}`}
                tabIndex={isActive ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                onClick={() => setTab(def.key)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                data-testid="org-panel-tab"
                data-tab={def.key}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500 [&_svg]:size-3.5",
                  isActive ? "bg-navy-100 font-medium text-navy-900" : "text-ink-600 hover:text-navy-900"
                )}
              >
                <span aria-hidden>{def.icon}</span>
                {t(`panel.tabs.${def.labelKey}` as never)}
                {count !== null && count > 0 ? <span className="text-[10px] text-ink-400 tnum">{count}</span> : null}
              </button>
            );
          })}
        </div>

        {/* every panel is in the document (hidden when not active) so the
            server HTML is complete and each tab keeps its own state */}
        {tabs.map((def) => (
          <div
            key={def.key}
            role="tabpanel"
            id={`${baseId}-panel-${def.key}`}
            aria-labelledby={`${baseId}-tab-${def.key}`}
            tabIndex={-1}
            hidden={def.key !== active?.key}
            className="mt-4"
          >
            {def.render({ data, onSelectUnit })}
          </div>
        ))}
      </div>
    </div>
  );
}
