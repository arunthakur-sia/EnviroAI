"use client";
// CR05 4.8: Settings > Indices. The register, data refresh, manual
// observation entry and correction, forecast assumption defaults, and
// forecast recompute now. CR08 4.3: the group manager and the three-step
// Add index wizard (IndicesGroupManager.tsx, IndicesAddWizard.tsx).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, RefreshCw, Calculator } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import {
  Button,
  Input,
  NativeSelect,
  Chip,
  Label,
  Skeleton,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { IndicesGroupManager } from "./IndicesGroupManager";
import { IndicesAddWizard } from "./IndicesAddWizard";

type IndexRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  publisher: string | null;
  category: string;
  scale: string;
  higherIsBetter: number;
  latestYear: number | null;
  isActive: number;
  sourceNotes: string | null;
  sdgGoal: number | null;
  forecastEnabled: number;
};

type AssumptionRow = {
  id: string;
  indexId: string | null;
  key: string;
  value: number;
  min: number;
  max: number;
  step: number;
  labelEn: string;
  labelAr: string;
  editableBy: string;
};

const REGISTER_COLS = "grid-cols-[minmax(200px,2.2fr)_minmax(120px,1.2fr)_minmax(90px,0.9fr)_minmax(110px,1fr)_minmax(80px,0.7fr)_minmax(90px,0.8fr)]";

export function IndicesSettingsTab() {
  const t = useTranslations("settings.indicesTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<IndexRow[] | null>(null);
  const [assumptions, setAssumptions] = React.useState<AssumptionRow[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [obsForm, setObsForm] = React.useState({
    indexCode: "",
    country: "SAU",
    year: String(new Date().getFullYear()),
    rank: "",
    score: "",
    sourceUrl: "",
  });

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/indices");
      const j = await res.json();
      setRows(j.data?.indices ?? []);
      setAssumptions(j.data?.assumptions ?? []);
      setObsForm((f) => ({ ...f, indexCode: f.indexCode || (j.data?.indices?.[0]?.code ?? "") }));
    } catch {
      setRows([]);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function act(key: string, url: string, body?: unknown, done?: string) {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        toast(done ?? t("done"), "points");
        return true;
      }
      toast(tc("error"), "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (!rows) {
    return (
      <div className="flex flex-col gap-2.5" aria-busy>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const head = (label: string) => (
    <div role="columnheader" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600 rtl:tracking-normal">
      {label}
    </div>
  );

  return (
    <div className="flex flex-col gap-6" data-testid="indices-settings">
      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "refresh"}
          onClick={() => act("refresh", "/api/v1/indices/refresh", undefined, t("refreshQueued"))}
          data-testid="settings-indices-refresh"
        >
          <RefreshCw /> {t("refresh")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "recompute"}
          onClick={() => act("recompute", "/api/v1/indices/recompute", undefined, t("recomputed"))}
          data-testid="settings-indices-recompute"
        >
          <Calculator /> {t("recompute")}
        </Button>
        <Button size="sm" className="ms-auto" onClick={() => setAdding(true)} data-testid="index-add">
          <Plus /> {t("addIndex")}
        </Button>
      </div>

      {/* CR08 4.3: the group manager */}
      <IndicesGroupManager />

      {/* the register */}
      <div className="card overflow-x-auto" data-testid="indices-register">
        <div role="table" aria-label={t("register")} className="min-w-[760px] text-sm">
          <div role="rowgroup">
            <div role="row" className={cn("grid border-b border-mist-100", REGISTER_COLS)}>
              {head(t("colIndex"))}
              {head(t("colPublisher"))}
              {head(t("colCategory"))}
              {head(t("colDirection"))}
              {head(t("colLatest"))}
              {head(t("colStatus"))}
            </div>
          </div>
          <div role="rowgroup">
            {rows.map((r) => (
              <div key={r.id} role="row" className={cn("grid items-center border-b border-mist-100 last:border-0", REGISTER_COLS)} data-testid="settings-index-row">
                <div role="cell" className="min-w-0 px-4 py-2.5">
                  <span className="block truncate font-medium text-ink-900">
                    {r.sdgGoal != null ? <span className="me-1.5 tnum text-ink-400">SDG {r.sdgGoal}</span> : null}
                    {bi(locale, r.nameEn, r.nameAr)}
                  </span>
                  <span className="block text-xs text-ink-400 tnum" dir="ltr">{r.code}</span>
                </div>
                <div role="cell" className="truncate px-4 py-2.5 text-xs text-ink-600">{r.publisher ?? "-"}</div>
                <div role="cell" className="px-4 py-2.5"><Chip tone="mist">{r.category}</Chip></div>
                <div role="cell" className="px-4 py-2.5 text-xs text-ink-600">
                  {r.higherIsBetter ? t("higherBetter") : t("lowerBetter")}
                </div>
                <div role="cell" className="px-4 py-2.5 tnum">{r.latestYear ?? "-"}</div>
                <div role="cell" className="flex items-center gap-1.5 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/v1/indices", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
                      });
                      void load();
                    }}
                    className="cursor-pointer focus-visible:outline-2 focus-visible:outline-aqua-500"
                    aria-label={r.isActive ? t("deactivate", { name: r.nameEn }) : t("activate", { name: r.nameEn })}
                    data-testid="settings-index-toggle"
                  >
                    {r.isActive ? <Chip tone="ok">{t("active")}</Chip> : <Chip tone="ghost">{t("inactive")}</Chip>}
                  </button>
                  {!r.forecastEnabled ? <Chip tone="ghost">{t("forecastOff")}</Chip> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* manual observation entry */}
      <div className="card p-4" data-testid="manual-observation">
        <p className="mb-3 text-sm font-semibold text-ink-900">{t("manualEntry")}</p>
        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <Label htmlFor="obs-index">{t("colIndex")}</Label>
            <NativeSelect
              id="obs-index"
              value={obsForm.indexCode}
              onChange={(e) => setObsForm((f) => ({ ...f, indexCode: e.target.value }))}
              className="w-56"
            >
              {rows.map((r) => (
                <option key={r.code} value={r.code}>
                  {bi(locale, r.nameEn, r.nameAr)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="obs-country">{t("country")}</Label>
            <Input
              id="obs-country"
              value={obsForm.country}
              onChange={(e) => setObsForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
              className="w-24"
              dir="ltr"
              maxLength={3}
            />
          </div>
          <div>
            <Label htmlFor="obs-year">{t("year")}</Label>
            <Input
              id="obs-year"
              value={obsForm.year}
              onChange={(e) => setObsForm((f) => ({ ...f, year: e.target.value }))}
              className="w-24"
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="obs-rank">{t("rank")}</Label>
            <Input
              id="obs-rank"
              value={obsForm.rank}
              onChange={(e) => setObsForm((f) => ({ ...f, rank: e.target.value }))}
              className="w-24"
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="obs-score">{t("score")}</Label>
            <Input
              id="obs-score"
              value={obsForm.score}
              onChange={(e) => setObsForm((f) => ({ ...f, score: e.target.value }))}
              className="w-28"
              dir="ltr"
            />
          </div>
          <div className="min-w-56 flex-1">
            <Label htmlFor="obs-source-url">{t("sourceUrl")}</Label>
            <Input
              id="obs-source-url"
              value={obsForm.sourceUrl}
              onChange={(e) => setObsForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              dir="ltr"
            />
          </div>
          <Button
            size="sm"
            loading={busy === "obs"}
            disabled={!obsForm.indexCode || (!obsForm.rank && !obsForm.score)}
            onClick={() =>
              act(
                "obs",
                "/api/v1/indices/observations",
                {
                  indexCode: obsForm.indexCode,
                  country: obsForm.country,
                  year: Number(obsForm.year),
                  rank: obsForm.rank ? Number(obsForm.rank) : null,
                  score: obsForm.score ? Number(obsForm.score) : null,
                  sourceUrl: obsForm.sourceUrl || undefined,
                },
                t("observationSaved")
              )
            }
            data-testid="manual-observation-save"
          >
            {tc("save")}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">{t("manualHint")}</p>
      </div>

      {/* assumption defaults */}
      <div className="card p-4" data-testid="assumption-defaults">
        <p className="mb-3 text-sm font-semibold text-ink-900">{t("assumptions")}</p>
        {assumptions.filter((a) => !a.indexId).length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {assumptions
              .filter((a) => !a.indexId)
              .map((a) => (
                <label key={a.id} className="block text-xs text-ink-600">
                  <span className="flex justify-between">
                    {bi(locale, a.labelEn, a.labelAr)}
                    <span className="tnum font-medium text-ink-900">{a.value}</span>
                  </span>
                  <input
                    type="range"
                    min={a.min}
                    max={a.max}
                    step={a.step}
                    defaultValue={a.value}
                    onMouseUp={async (e) => {
                      await fetch("/api/v1/settings", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          indexAssumption: { id: a.id, value: Number((e.target as HTMLInputElement).value) },
                        }),
                      });
                      toast(t("assumptionSaved"), "points");
                      void load();
                    }}
                    className="mt-1.5 w-full accent-navy-700"
                  />
                </label>
              ))}
          </div>
        ) : (
          <p className="text-xs text-ink-600">{t("noAssumptions")}</p>
        )}
        <p className="mt-2 text-[11px] text-ink-400">{t("assumptionsHint")}</p>
      </div>

      {/* CR08 4.3: the three-step Add index */}
      <IndicesAddWizard open={adding} onOpenChange={setAdding} onCreated={load} />
    </div>
  );
}
