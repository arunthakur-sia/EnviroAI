"use client";
// CR05 4.8: Settings > Indices. The register (add index), data refresh,
// manual observation entry and correction, forecast assumption defaults,
// peer group presets, and forecast recompute now.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, RefreshCw, Calculator } from "lucide-react";
import { bi } from "@/lib/utils";
import {
  Button,
  Input,
  NativeSelect,
  Chip,
  Label,
  Skeleton,
} from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

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

export function IndicesSettingsTab() {
  const t = useTranslations("settings.indicesTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<IndexRow[] | null>(null);
  const [assumptions, setAssumptions] = React.useState<AssumptionRow[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    code: "",
    nameEn: "",
    nameAr: "",
    publisher: "",
    category: "economy",
    higherIsBetter: true,
  });
  const [obsForm, setObsForm] = React.useState({
    indexCode: "",
    country: "QAT",
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
      setObsForm((f) => ({ ...f, indexCode: j.data?.indices?.[0]?.code ?? "" }));
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
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

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

      {/* the register */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-sand-100 text-[11px] uppercase tracking-wider text-ink-600">
              <th className="px-4 py-2.5 text-start">{t("colIndex")}</th>
              <th className="px-4 py-2.5 text-start">{t("colPublisher")}</th>
              <th className="px-4 py-2.5 text-start">{t("colCategory")}</th>
              <th className="px-4 py-2.5 text-start">{t("colDirection")}</th>
              <th className="px-4 py-2.5 text-start">{t("colLatest")}</th>
              <th className="px-4 py-2.5 text-start">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-sand-100 last:border-0" data-testid="settings-index-row">
                <td className="px-4 py-2.5">
                  <span className="block font-medium text-ink-900">{bi(locale, r.nameEn, r.nameAr)}</span>
                  <span className="block text-xs text-ink-400 tnum">{r.code}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-ink-600">{r.publisher ?? "-"}</td>
                <td className="px-4 py-2.5"><Chip tone="sand">{r.category}</Chip></td>
                <td className="px-4 py-2.5 text-xs text-ink-600">
                  {r.higherIsBetter ? t("higherBetter") : t("lowerBetter")}
                </td>
                <td className="px-4 py-2.5 tnum">{r.latestYear ?? "-"}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={async () => {
                      await fetch("/api/v1/indices", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
                      });
                      void load();
                    }}
                    className="cursor-pointer"
                  >
                    {r.isActive ? <Chip tone="ok">{t("active")}</Chip> : <Chip tone="ghost">{t("inactive")}</Chip>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* manual observation entry */}
      <div className="card p-4" data-testid="manual-observation">
        <p className="mb-3 text-sm font-semibold text-ink-900">{t("manualEntry")}</p>
        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <Label>{t("colIndex")}</Label>
            <NativeSelect
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
            <Label>{t("country")}</Label>
            <Input
              value={obsForm.country}
              onChange={(e) => setObsForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
              className="w-24"
              dir="ltr"
              maxLength={3}
            />
          </div>
          <div>
            <Label>{t("year")}</Label>
            <Input
              value={obsForm.year}
              onChange={(e) => setObsForm((f) => ({ ...f, year: e.target.value }))}
              className="w-24"
              dir="ltr"
            />
          </div>
          <div>
            <Label>{t("rank")}</Label>
            <Input
              value={obsForm.rank}
              onChange={(e) => setObsForm((f) => ({ ...f, rank: e.target.value }))}
              className="w-24"
              dir="ltr"
            />
          </div>
          <div>
            <Label>{t("score")}</Label>
            <Input
              value={obsForm.score}
              onChange={(e) => setObsForm((f) => ({ ...f, score: e.target.value }))}
              className="w-28"
              dir="ltr"
            />
          </div>
          <div className="min-w-56 flex-1">
            <Label>{t("sourceUrl")}</Label>
            <Input
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
                    className="mt-1.5 w-full accent-maroon-700"
                  />
                </label>
              ))}
          </div>
        ) : (
          <p className="text-xs text-ink-600">{t("noAssumptions")}</p>
        )}
        <p className="mt-2 text-[11px] text-ink-400">{t("assumptionsHint")}</p>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title={t("addIndex")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("code")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
                dir="ltr"
                placeholder="gci"
              />
            </div>
            <div>
              <Label>{t("colCategory")}</Label>
              <NativeSelect
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {["economy", "governance", "society", "environment", "technology", "human"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>{t("nameEn")}</Label>
              <Input value={form.nameEn} onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label>{t("nameAr")}</Label>
              <Input value={form.nameAr} onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))} dir="rtl" />
            </div>
            <div>
              <Label>{t("colPublisher")}</Label>
              <Input value={form.publisher} onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))} />
            </div>
            <div>
              <Label>{t("colDirection")}</Label>
              <NativeSelect
                value={form.higherIsBetter ? "1" : "0"}
                onChange={(e) => setForm((f) => ({ ...f, higherIsBetter: e.target.value === "1" }))}
              >
                <option value="1">{t("higherBetter")}</option>
                <option value="0">{t("lowerBetter")}</option>
              </NativeSelect>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              loading={busy === "add"}
              disabled={form.code.length < 2 || form.nameEn.length < 2 || !form.nameAr}
              onClick={async () => {
                const ok = await act("add", "/api/v1/indices", form, t("indexAdded"));
                if (ok) {
                  setAdding(false);
                  void load();
                }
              }}
            >
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
