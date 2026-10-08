"use client";
// CR08 7.2: Settings > Gamification. Everything the old inline tab had (the
// global switch, every rule with its points and active switch) plus the
// leaderboard controls: an "on boards" switch per rule (admin-duty actions
// count for the person, not the boards), the roles excluded from the People
// board, the quiet-mode rule and a Refresh now. Self-loading through
// /api/v1/gamification/rules, /api/v1/settings and /api/v1/leaderboard/settings.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { bi, cn } from "@/lib/utils";
import { Button, Chip, Input, SectionTitle, Skeleton } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

type RuleCategory = "contributors" | "guardians" | "learners" | "unit" | null;

type Rule = {
  id: string;
  eventType: string;
  points: number;
  isActive: boolean;
  excludedFromBoards: boolean;
  category: RuleCategory;
};

type BoardSettings = {
  excludeRoles: string[];
  quietModeHidesBoard: boolean;
  roles: { id: string; nameEn: string; nameAr: string }[];
};

const RULE_COLS = "grid-cols-[minmax(0,1fr)_5.5rem_3rem_3.5rem] sm:grid-cols-[minmax(0,1fr)_7rem_5.5rem_4rem_5rem]";

const CATEGORY_TONE: Record<string, "navy" | "teal" | "aqua" | "mist" | "ghost"> = {
  contributors: "navy",
  guardians: "teal",
  learners: "aqua",
  unit: "mist",
};

export function GamificationSettingsTab() {
  const t = useTranslations("settings");
  const tg = useTranslations("settings.gamificationTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const uid = React.useId();

  const [rules, setRules] = React.useState<Rule[] | null>(null);
  const [globalOn, setGlobalOn] = React.useState(true);
  const [board, setBoard] = React.useState<BoardSettings | null>(null);
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setError(false);
    try {
      const [rulesRes, settingsRes, boardRes] = await Promise.all([
        fetch("/api/v1/gamification/rules"),
        fetch("/api/v1/settings"),
        fetch("/api/v1/leaderboard/settings"),
      ]);
      const rulesJson = await rulesRes.json();
      const settingsJson = await settingsRes.json();
      const boardJson = await boardRes.json();
      if (!rulesRes.ok || !settingsRes.ok || !boardRes.ok) {
        setError(true);
        return;
      }
      setRules((rulesJson.data ?? []) as Rule[]);
      setGlobalOn(settingsJson.data?.flags?.gamification !== false);
      setBoard({
        excludeRoles: boardJson.data?.excludeRoles ?? [],
        quietModeHidesBoard: boardJson.data?.quietModeHidesBoard !== false,
        roles: boardJson.data?.roles ?? [],
      });
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function patchRule(id: string, body: Partial<Pick<Rule, "points" | "isActive" | "excludedFromBoards">>) {
    setRules((prev) => prev?.map((r) => (r.id === id ? { ...r, ...body } : r)) ?? prev);
    const res = await fetch("/api/v1/gamification/rules", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) toast(t("ruleSaved"), "success");
    else toast(tc("error"), "error");
  }

  async function toggleGlobal(v: boolean) {
    setGlobalOn(v);
    const res = await fetch("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ flags: { gamification: v } }),
    });
    if (!res.ok) toast(tc("error"), "error");
  }

  async function saveBoard(patch: Partial<Pick<BoardSettings, "excludeRoles" | "quietModeHidesBoard">>) {
    if (!board) return;
    const next = { ...board, ...patch };
    setBoard(next);
    setBusy("board");
    try {
      const res = await fetch("/api/v1/leaderboard/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          excludeRoles: next.excludeRoles,
          quietModeHidesBoard: next.quietModeHidesBoard,
        }),
      });
      if (res.ok) toast(tg("settingsSaved"), "success");
      else toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  function toggleRole(name: string) {
    if (!board) return;
    const has = board.excludeRoles.includes(name);
    void saveBoard({
      excludeRoles: has ? board.excludeRoles.filter((r) => r !== name) : [...board.excludeRoles, name],
    });
  }

  async function refreshBoards() {
    setBusy("refresh");
    try {
      const res = await fetch("/api/v1/leaderboard/refresh", { method: "POST" });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        setLastRefresh(j?.data?.rows ?? 0);
        toast(tg("boardsRefreshed", { rows: j?.data?.rows ?? 0 }), "success");
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className="card p-5">
        <p className="text-sm text-ink-600">{tg("loadError")}</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={load}>
          {tg("retry")}
        </Button>
      </div>
    );
  }

  if (!rules || !board) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const head = "text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal";

  return (
    <div className="flex flex-col gap-6" data-testid="gamification-settings">
      {/* 1. the engine switch */}
      <label className="card flex items-center justify-between gap-3 p-4">
        <span>
          <span className="block text-sm font-medium text-ink-900">{t("gamificationGlobal")}</span>
          <span className="block text-xs text-ink-600">{t("gamificationGlobalHint")}</span>
        </span>
        <Switch checked={globalOn} onCheckedChange={toggleGlobal} data-testid="gamification-global" />
      </label>

      {/* 2. the leaderboard */}
      <section data-testid="gamification-boards">
        <SectionTitle
          aside={
            <span className="flex items-center gap-2">
              {lastRefresh !== null ? (
                <span className="text-xs text-ink-400 tnum">{tg("boardsRefreshed", { rows: lastRefresh })}</span>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "refresh"}
                onClick={refreshBoards}
                data-testid="gamification-refresh-boards"
              >
                <RefreshCw /> {tg("refreshBoards")}
              </Button>
            </span>
          }
        >
          {tg("boardsTitle")}
        </SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{tg("boardsHint")}</p>
        <div className="card flex flex-col gap-4 p-4">
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink-900">{tg("excludeRolesTitle")}</legend>
            <p className="mb-2 text-xs text-ink-600">{tg("excludeRolesHint")}</p>
            <ul className="flex flex-wrap gap-2" data-testid="gamification-role-exclusions">
              {board.roles.map((role) => {
                const on = board.excludeRoles.includes(role.nameEn);
                return (
                  <li key={role.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                        on
                          ? "border-navy-700 bg-navy-100 text-navy-900"
                          : "border-mist-300 bg-white text-ink-600 hover:border-navy-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleRole(role.nameEn)}
                        className="size-3.5 cursor-pointer accent-navy-700"
                        disabled={busy === "board"}
                        data-testid={`exclude-role-${role.nameEn.toLowerCase().replace(/\s+/g, "-")}`}
                      />
                      {bi(locale, role.nameEn, role.nameAr)}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <label className="flex items-center justify-between gap-3 border-t border-mist-100 pt-4">
            <span>
              <span className="block text-sm font-medium text-ink-900">{tg("quietHides")}</span>
              <span className="block text-xs text-ink-600">{tg("quietHidesHint")}</span>
            </span>
            <Switch
              checked={board.quietModeHidesBoard}
              onCheckedChange={(v) => saveBoard({ quietModeHidesBoard: v })}
              data-testid="gamification-quiet-hides"
            />
          </label>
        </div>
      </section>

      {/* 3. the rules */}
      <section data-testid="gamification-rules">
        <SectionTitle
          aside={<span className="text-xs text-ink-400 tnum">{tg("rulesCount", { count: rules.length })}</span>}
        >
          {tg("rulesTitle")}
        </SectionTitle>
        <p className="mb-3 text-sm text-ink-600">{tg("rulesHint")}</p>
        <div className="card overflow-hidden" role="table" aria-label={tg("rulesTitle")}>
          <div role="row" className={cn("grid items-center gap-3 border-b border-mist-200 px-4 py-2", RULE_COLS)}>
            <span role="columnheader" className={head}>{tg("colRule")}</span>
            <span role="columnheader" className={cn(head, "hidden sm:block")}>{tg("colCategory")}</span>
            <span role="columnheader" className={cn(head, "text-end")}>{tg("colPoints")}</span>
            <span role="columnheader" className={cn(head, "text-center")}>{tg("colActive")}</span>
            <span role="columnheader" className={cn(head, "text-center")}>{tg("colBoards")}</span>
          </div>
          <div role="rowgroup" className="max-h-[560px] divide-y divide-mist-100 overflow-y-auto">
            {rules.map((r) => (
              <div
                key={r.id}
                role="row"
                className={cn("grid items-center gap-3 px-4 py-2", RULE_COLS)}
                data-testid="gamification-rule"
                data-rule={r.eventType}
              >
                <span role="cell" className="min-w-0">
                  <span className="block truncate text-sm text-ink-900" dir="ltr">
                    {r.eventType}
                  </span>
                  <span className="block sm:hidden">
                    <Chip tone={CATEGORY_TONE[r.category ?? ""] ?? "ghost"}>
                      {tg(`categories.${r.category ?? "none"}` as never)}
                    </Chip>
                  </span>
                </span>
                <span role="cell" className="hidden sm:block">
                  <Chip tone={CATEGORY_TONE[r.category ?? ""] ?? "ghost"}>
                    {tg(`categories.${r.category ?? "none"}` as never)}
                  </Chip>
                </span>
                <span role="cell" className="flex justify-end">
                  <Input
                    id={`${uid}-${r.id}-points`}
                    type="number"
                    min={0}
                    max={1000}
                    defaultValue={r.points}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v !== r.points) void patchRule(r.id, { points: v });
                    }}
                    className="h-8 w-20 text-end text-xs tnum"
                    dir="ltr"
                    aria-label={tg("pointsAria", { rule: r.eventType })}
                  />
                </span>
                <span role="cell" className="flex justify-center">
                  <Switch
                    checked={r.isActive}
                    onCheckedChange={(v) => patchRule(r.id, { isActive: v })}
                    aria-label={tg("activeAria", { rule: r.eventType })}
                  />
                </span>
                <span role="cell" className="flex justify-center">
                  <Switch
                    checked={!r.excludedFromBoards}
                    onCheckedChange={(v) => patchRule(r.id, { excludedFromBoards: !v })}
                    aria-label={tg("boardsAria", { rule: r.eventType })}
                    data-testid={`rule-boards-${r.eventType}`}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">{tg("boardsFootnote")}</p>
      </section>
    </div>
  );
}
