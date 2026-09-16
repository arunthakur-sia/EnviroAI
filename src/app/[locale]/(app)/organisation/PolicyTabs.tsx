"use client";
// CR07 3.5: Policies and Procedures. Four tabs in every unit panel, each a
// short shelf of the real Book component with the version, the effective date
// and the visibility beside it, a designed empty state that offers Add to the
// people who may add, and the head's visibility control: one click per item or
// in bulk. The visibility PATCH goes to /api/v1/organisation/policies.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AlarmClock, FileStack, Plus } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button, Chip, EmptyState } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { Book, type ShelfDoc } from "@/components/nexus/Shelf";
import type { PolicyTab, UnitPolicy } from "@/server/services/organisation";

/* the four tabs, in order; kept local so the client never imports the service */
const TABS = ["policy_internal", "procedure", "form_template", "service"] as const;
const SCOPES = ["all_staff", "unit_only", "restricted"] as const;

/** Book cloth per tab: the Shelf palette has no policy cloths of its own. */
const CLOTH_FOR: Record<PolicyTab, string> = {
  policy_internal: "policy",
  procedure: "guideline",
  form_template: "circular",
  service: "report",
};

const SCOPE_TONE: Record<string, "gulf" | "sand" | "warn"> = {
  all_staff: "gulf",
  unit_only: "sand",
  restricted: "warn",
};

export function PolicyTabs({
  unitCode,
  policies,
  canEdit,
  canAddPolicy,
}: {
  unitCode: string;
  policies: Record<PolicyTab, UnitPolicy[]>;
  canEdit: boolean;
  canAddPolicy: boolean;
}) {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<PolicyTab>("policy_internal");
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set());
  const [busy, setBusy] = React.useState(false);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = React.useId();

  const tabLabel: Record<PolicyTab, string> = {
    policy_internal: t("policies.tabs.policy_internal"),
    procedure: t("policies.tabs.procedure"),
    form_template: t("policies.tabs.form_template"),
    service: t("policies.tabs.service"),
  };
  const emptyLabel: Record<PolicyTab, string> = {
    policy_internal: t("policies.empty.policy_internal"),
    procedure: t("policies.empty.procedure"),
    form_template: t("policies.empty.form_template"),
    service: t("policies.empty.service"),
  };
  const publishedLabel: Record<PolicyTab, string> = {
    policy_internal: t("policies.published.policy_internal"),
    procedure: t("policies.published.procedure"),
    form_template: t("policies.published.form_template"),
    service: t("policies.published.service"),
  };
  const addLabel: Record<PolicyTab, string> = {
    policy_internal: t("policies.add.policy_internal"),
    procedure: t("policies.add.procedure"),
    form_template: t("policies.add.form_template"),
    service: t("policies.add.service"),
  };
  const scopeLabel: Record<string, string> = {
    all_staff: t("policies.visibility.all_staff"),
    unit_only: t("policies.visibility.unit_only"),
    restricted: t("policies.visibility.restricted"),
  };

  const items = policies[tab] ?? [];
  const addHref = `/vault/upload?type=${tab}&unit=${encodeURIComponent(unitCode)}&policy=1`;

  function selectTab(next: PolicyTab) {
    setTab(next);
    setPicked(new Set());
  }

  function onTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const forward = e.key === "ArrowRight" ? (isRtl ? -1 : 1) : isRtl ? 1 : -1;
    const next = (index + forward + TABS.length) % TABS.length;
    selectTab(TABS[next]);
    tabRefs.current[next]?.focus();
  }

  async function patchVisibility(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/organisation/policies", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast(t("policies.updateFailed"), "error");
        return;
      }
      toast(t("policies.updated"), "success");
      setPicked(new Set());
      router.refresh();
    } catch {
      toast(t("policies.updateFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div data-testid="policy-tabs">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label={t("policies.tabsAria")}
          className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-white p-0.5 shadow-[var(--shadow-paper)]"
        >
          {TABS.map((key, i) => {
            const active = key === tab;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`${baseId}-tab-${key}`}
                aria-selected={active}
                aria-controls={`${baseId}-panel-${key}`}
                tabIndex={active ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                onClick={() => selectTab(key)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                data-testid="policy-tab"
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700",
                  active ? "bg-maroon-100 font-medium text-maroon-900" : "text-ink-600"
                )}
              >
                {tabLabel[key]}
                <span className="text-[10px] text-ink-400 tnum">
                  {(policies[key] ?? []).length}
                </span>
              </button>
            );
          })}
        </div>
        {canAddPolicy && items.length ? (
          <Link href={addHref} className="ms-auto">
            <Button size="sm" variant="secondary">
              <Plus /> {addLabel[tab]}
            </Button>
          </Link>
        ) : null}
      </div>

      {/* the bulk bar appears once anything is selected */}
      {canEdit && picked.size > 0 ? (
        <div
          data-testid="policy-bulk-bar"
          role="group"
          aria-label={t("policies.applyTo")}
          className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-maroon-300 bg-white px-3 py-2 shadow-[var(--shadow-paper)]"
        >
          <span className="text-xs font-medium text-maroon-900 tnum">
            {t("policies.selectedCount", { count: picked.size })}
          </span>
          <span className="text-xs text-ink-600">{t("policies.applyTo")}</span>
          <span className="inline-flex items-center gap-0.5 rounded-lg bg-sand-100 p-0.5">
            {SCOPES.map((scope) => (
              <button
                key={scope}
                type="button"
                disabled={busy}
                onClick={() =>
                  patchVisibility({ documentIds: [...picked], visibilityScope: scope })
                }
                className="cursor-pointer rounded-md px-2 py-0.5 text-[11px] text-ink-600 transition-colors hover:bg-white hover:text-maroon-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700 disabled:opacity-50"
              >
                {scopeLabel[scope]}
              </button>
            ))}
          </span>
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="link-draw ms-auto cursor-pointer text-xs text-ink-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700"
          >
            {t("policies.clearSelection")}
          </button>
        </div>
      ) : null}

      <div
        role="tabpanel"
        id={`${baseId}-panel-${tab}`}
        aria-labelledby={`${baseId}-tab-${tab}`}
        tabIndex={-1}
      >
        {items.length === 0 ? (
          <div data-testid="policy-empty">
            <EmptyState
              icon={<FileStack />}
              title={canAddPolicy ? emptyLabel[tab] : publishedLabel[tab]}
              hint={canAddPolicy ? t("policies.emptyHint") : undefined}
              className="py-8"
              action={
                canAddPolicy ? (
                  <Link href={addHref}>
                    <Button size="sm">
                      <Plus /> {addLabel[tab]}
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {items.map((item, i) => {
              const title = bi(locale, item.titleEn, item.titleAr);
              const alt = locale === "ar" ? item.titleEn : item.titleAr;
              const doc: ShelfDoc = {
                id: item.id,
                titleEn: item.titleEn,
                titleAr: item.titleAr,
                summaryEn: item.summaryEn,
                summaryAr: item.summaryAr,
                typeCode: CLOTH_FOR[item.tab],
                classification: item.classificationLevel,
                status: item.status,
                pageCount: null,
                updatedAt: item.updatedAt,
              };
              return (
                <div
                  key={item.id}
                  data-testid="policy-item"
                  className="card flex items-start gap-3 p-3"
                >
                  {canEdit ? (
                    <input
                      type="checkbox"
                      checked={picked.has(item.id)}
                      onChange={() => togglePick(item.id)}
                      aria-label={t("policies.select", { title })}
                      className="mt-1 size-4 shrink-0 cursor-pointer rounded border-sand-300"
                      style={{ accentColor: "var(--color-maroon-700)" }}
                    />
                  ) : null}
                  {/* a short book on its own plank, the Vault link on the spine */}
                  <span className="flex shrink-0 flex-col items-center">
                    <Book doc={doc} index={i} height={104} />
                    <span
                      aria-hidden
                      className="mt-1 block h-1.5 w-12 rounded-[2px]"
                      style={{
                        background:
                          "linear-gradient(180deg, #ffffff 0 1px, var(--color-plank) 1px 55%, var(--color-plank-edge) 100%)",
                      }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/vault/${item.id}`}
                      className="link-draw block text-sm font-medium leading-snug text-ink-900 hover:text-maroon-700"
                    >
                      {title}
                    </Link>
                    <p className="line-clamp-1 text-[11px] text-ink-400">{alt}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {item.versionLabel ? (
                        <Chip tone="sand">
                          {t("policies.version", { version: item.versionLabel })}
                        </Chip>
                      ) : null}
                      {item.effectiveFrom ? (
                        <span className="text-[11px] text-ink-600 tnum">
                          {t("policies.effective", {
                            date: formatDate(item.effectiveFrom, locale, { style: "medium" }),
                          })}
                        </span>
                      ) : null}
                      <Chip tone={SCOPE_TONE[item.visibilityScope] ?? "sand"}>
                        {scopeLabel[item.visibilityScope] ?? item.visibilityScope}
                      </Chip>
                      {item.reviewDue ? (
                        <Chip tone="warn">
                          <AlarmClock className="size-3" aria-hidden />
                          {t("policies.reviewDue")}
                        </Chip>
                      ) : null}
                      {item.status === "verified" ? (
                        <Chip tone="ok">{tc("verified")}</Chip>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div
                        data-testid="visibility-control"
                        role="group"
                        aria-label={t("policies.visibility.label")}
                        className="mt-2 inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-sand-100 p-0.5"
                      >
                        {SCOPES.map((scope) => {
                          const active = item.visibilityScope === scope;
                          return (
                            <button
                              key={scope}
                              type="button"
                              disabled={busy}
                              aria-pressed={active}
                              onClick={() =>
                                patchVisibility({ documentId: item.id, visibilityScope: scope })
                              }
                              className={cn(
                                "cursor-pointer rounded-md px-2 py-0.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-700 disabled:opacity-50",
                                active
                                  ? "bg-white font-medium text-maroon-900 shadow-sm"
                                  : "text-ink-600 hover:text-maroon-900"
                              )}
                            >
                              {scopeLabel[scope]}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
