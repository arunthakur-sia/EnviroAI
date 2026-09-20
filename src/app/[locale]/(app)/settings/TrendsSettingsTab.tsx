"use client";
// Settings > Trends and Signals: briefs editor, feeds editor, schedule,
// run history, web search toggle, scan token budget. Self-fetching tab.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  Button,
  Input,
  Label,
  Chip,
  Skeleton,
  NativeSelect,
} from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

type Brief = {
  id: string;
  nameEn: string;
  nameAr: string;
  queryEn: string;
  queryAr: string | null;
  isActive: number;
  lastRunAt: string | null;
};
type Feed = {
  id: string;
  name: string;
  url: string;
  kind: string;
  isActive: number;
  lastFetchedAt: string | null;
  lastError: string | null;
};
type Run = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  trigger: string;
  briefsRun: number;
  candidates: number;
  acceptedNew: number;
  duplicates: number;
  errorsJson: string | null;
  tokensIn: number;
  tokensOut: number;
};

export function TrendsSettingsTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [briefs, setBriefs] = React.useState<Brief[]>([]);
  const [feeds, setFeeds] = React.useState<Feed[]>([]);
  const [runs, setRuns] = React.useState<Run[]>([]);
  const [trends, setTrends] = React.useState({
    intervalHours: 6,
    webSearchOn: true,
    scanTokenBudget: 500000,
  });
  const [newBrief, setNewBrief] = React.useState({ nameEn: "", nameAr: "", queryEn: "", queryAr: "" });
  const [newFeed, setNewFeed] = React.useState({ name: "", url: "", kind: "rss" });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [adminRes, settingsRes] = await Promise.all([
        fetch("/api/v1/scan/admin"),
        fetch("/api/v1/settings"),
      ]);
      const admin = await adminRes.json();
      const settings = await settingsRes.json();
      if (adminRes.ok) {
        setBriefs(admin.data.briefs);
        setFeeds(admin.data.feeds);
        setRuns(admin.data.runs);
      }
      if (settingsRes.ok && settings.data.trends) setTrends(settings.data.trends);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  async function saveTrends(next: typeof trends) {
    setTrends(next);
    const res = await fetch("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trends: next }),
    });
    if (res.ok) toast(t("saved"), "success");
    else toast(tc("error"), "error");
  }

  async function post(body: unknown) {
    const res = await fetch("/api/v1/scan/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast(t("saved"), "success");
      load();
    } else toast(tc("error"), "error");
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* schedule + toggles */}
      <div className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
        <div>
          <Label htmlFor="trends-interval">{t("trendsTab.interval")}</Label>
          <Input
            id="trends-interval"
            type="number"
            min={1}
            max={168}
            value={trends.intervalHours}
            onChange={(e) =>
              setTrends({ ...trends, intervalHours: Number(e.target.value) || 6 })
            }
            onBlur={() => saveTrends(trends)}
            className="tnum"
          />
        </div>
        <div>
          <Label htmlFor="trends-budget">{t("trendsTab.tokenBudget")}</Label>
          <Input
            id="trends-budget"
            type="number"
            min={10000}
            step={10000}
            value={trends.scanTokenBudget}
            onChange={(e) =>
              setTrends({ ...trends, scanTokenBudget: Number(e.target.value) || 500000 })
            }
            onBlur={() => saveTrends(trends)}
            className="tnum"
          />
        </div>
        <div className="flex items-end gap-3 pb-1.5">
          <Switch
            id="trends-websearch"
            checked={trends.webSearchOn}
            onCheckedChange={(v) => saveTrends({ ...trends, webSearchOn: v })}
          />
          <Label htmlFor="trends-websearch" className="mb-0">
            {t("trendsTab.webSearch")}
          </Label>
        </div>
      </div>

      {/* briefs */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
          {t("trendsTab.briefs")}
        </p>
        <div className="card divide-y divide-sand-100">
          {briefs.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Switch
                checked={b.isActive === 1}
                onCheckedChange={(v) =>
                  post({
                    kind: "brief",
                    id: b.id,
                    brief: {
                      nameEn: b.nameEn,
                      nameAr: b.nameAr,
                      queryEn: b.queryEn,
                      queryAr: b.queryAr ?? "",
                      isActive: v,
                    },
                  })
                }
                aria-label={b.nameEn}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink-900">
                  {bi(locale, b.nameEn, b.nameAr)}
                </span>
                <span className="block truncate text-xs text-ink-400">{b.queryEn}</span>
              </span>
              {b.lastRunAt ? (
                <span className="shrink-0 text-[11px] text-ink-400 tnum">
                  {formatDate(b.lastRunAt, locale)}
                </span>
              ) : null}
            </div>
          ))}
          <div className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-5">
            <Input
              placeholder={t("trendsTab.briefNameEn")}
              value={newBrief.nameEn}
              onChange={(e) => setNewBrief({ ...newBrief, nameEn: e.target.value })}
            />
            <Input
              placeholder={t("trendsTab.briefNameAr")}
              dir="rtl"
              value={newBrief.nameAr}
              onChange={(e) => setNewBrief({ ...newBrief, nameAr: e.target.value })}
            />
            <Input
              placeholder={t("trendsTab.briefQueryEn")}
              value={newBrief.queryEn}
              onChange={(e) => setNewBrief({ ...newBrief, queryEn: e.target.value })}
            />
            <Input
              placeholder={t("trendsTab.briefQueryAr")}
              dir="rtl"
              value={newBrief.queryAr}
              onChange={(e) => setNewBrief({ ...newBrief, queryAr: e.target.value })}
            />
            <Button
              variant="secondary"
              disabled={!newBrief.nameEn || !newBrief.nameAr || !newBrief.queryEn}
              onClick={() => {
                post({ kind: "brief", brief: { ...newBrief, isActive: true } });
                setNewBrief({ nameEn: "", nameAr: "", queryEn: "", queryAr: "" });
              }}
            >
              <Plus /> {t("trendsTab.addBrief")}
            </Button>
          </div>
        </div>
      </div>

      {/* feeds */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
          {t("trendsTab.feeds")}
        </p>
        <div className="card divide-y divide-sand-100">
          {feeds.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Switch
                checked={f.isActive === 1}
                onCheckedChange={(v) =>
                  post({
                    kind: "feed",
                    id: f.id,
                    feed: { name: f.name, url: f.url, kind: f.kind, isActive: v },
                  })
                }
                aria-label={f.name}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink-900">{f.name}</span>
                <span className="block truncate text-xs text-ink-400" dir="ltr">
                  {f.url}
                </span>
              </span>
              {f.lastError ? <Chip tone="danger">{t("trendsTab.feedError")}</Chip> : null}
              {f.lastFetchedAt ? (
                <span className="shrink-0 text-[11px] text-ink-400 tnum">
                  {formatDate(f.lastFetchedAt, locale)}
                </span>
              ) : null}
            </div>
          ))}
          <div className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-4">
            <Input
              placeholder={t("trendsTab.feedName")}
              value={newFeed.name}
              onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
            />
            <Input
              placeholder="https://…/rss"
              dir="ltr"
              value={newFeed.url}
              onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
            />
            <NativeSelect
              value={newFeed.kind}
              onChange={(e) => setNewFeed({ ...newFeed, kind: e.target.value })}
              aria-label={t("trendsTab.feedKind")}
            >
              <option value="rss">RSS</option>
              <option value="atom">Atom</option>
              <option value="google_news">Google News</option>
            </NativeSelect>
            <Button
              variant="secondary"
              disabled={!newFeed.name || !newFeed.url.startsWith("http")}
              onClick={() => {
                post({ kind: "feed", feed: { ...newFeed, isActive: true } });
                setNewFeed({ name: "", url: "", kind: "rss" });
              }}
            >
              <Plus /> {t("trendsTab.addFeed")}
            </Button>
          </div>
        </div>
      </div>

      {/* run history */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
          {t("trendsTab.runs")}
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-sand-50 text-xs font-semibold text-ink-600">
                <th className="px-4 py-2.5 text-start">{t("trendsTab.runStarted")}</th>
                <th className="px-4 py-2.5 text-start">{t("trendsTab.runStatus")}</th>
                <th className="px-4 py-2.5 text-end">{t("trendsTab.runCandidates")}</th>
                <th className="px-4 py-2.5 text-end">{t("trendsTab.runAdded")}</th>
                <th className="px-4 py-2.5 text-end">{t("trendsTab.runDuplicates")}</th>
                <th className="px-4 py-2.5 text-end">{t("trendsTab.runTokens")}</th>
                <th className="px-4 py-2.5 text-start">{t("trendsTab.runErrors")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-ink-400">
                    {t("trendsTab.noRuns")}
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="border-t border-sand-100">
                    <td className="px-4 py-2.5 tnum">{formatDate(r.startedAt, locale)}</td>
                    <td className="px-4 py-2.5">
                      <Chip tone={r.status === "done" ? "ok" : r.status === "failed" ? "danger" : "warn"}>
                        {t(`trendsTab.status.${r.status}` as never)}
                      </Chip>
                    </td>
                    <td className="px-4 py-2.5 text-end tnum">{r.candidates}</td>
                    <td className="px-4 py-2.5 text-end font-semibold text-maroon-900 tnum">
                      {r.acceptedNew}
                    </td>
                    <td className="px-4 py-2.5 text-end tnum">{r.duplicates}</td>
                    <td className="px-4 py-2.5 text-end tnum">
                      {(r.tokensIn + r.tokensOut).toLocaleString()}
                    </td>
                    <td className="max-w-56 truncate px-4 py-2.5 text-xs text-ink-400">
                      {(() => {
                        try {
                          const errs = JSON.parse(r.errorsJson ?? "[]") as string[];
                          return errs.length ? errs[0] : "";
                        } catch {
                          return "";
                        }
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
