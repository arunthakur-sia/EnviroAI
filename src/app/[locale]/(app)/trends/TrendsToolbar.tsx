"use client";
// Filter row + "Scan now" + paste-a-link for the Trends and Signals page.
// State lives in the URL like the Vault toolbar.
import * as React from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NativeSelect, Button, Input, Textarea, Label } from "@/components/ui/primitives";
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

const OUTCOMES = [
  "eco_growth",
  "fiscal_sust",
  "workforce",
  "cohesive_society",
  "quality_life",
  "env_sust",
  "gov_excellence",
];
const TYPES = ["policy", "market", "technology", "social", "environment", "geopolitical", "index", "research"];

export function TrendsToolbar({ canScan, canAdd }: { canScan: boolean; canAdd: boolean }) {
  const t = useTranslations("trends");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { toast } = useToast();
  const [scanning, setScanning] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [text, setText] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  async function scanNow() {
    setScanning(true);
    try {
      const res = await fetch("/api/v1/scan/run", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(json.data.queued ? t("scanQueued") : t("scanDone", { count: json.data.added ?? 0 }), "success");
      router.refresh();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setScanning(false);
    }
  }

  async function addManual() {
    if (!url.trim() && text.trim().length < 40) return;
    setAdding(true);
    try {
      const res = await fetch("/api/v1/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim() || undefined,
          text: text.trim().length >= 40 ? text.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(t("manualAdded", { count: json.data.added.length }), "success");
      setUrl("");
      setText("");
      setDialogOpen(false);
      router.refresh();
    } catch (e: any) {
      toast(e?.message === "fetch_failed" ? t("fetchFailed") : tc("error"), "error");
    } finally {
      setAdding(false);
    }
  }

  const select = (key: string, options: string[], i18nPrefix: string, placeholder: string) => (
    <NativeSelect
      value={sp.get(key) ?? ""}
      onChange={(e) => setParam(key, e.target.value || null)}
      className={cn("w-auto min-w-28", sp.get(key) && "border-maroon-300 text-maroon-900")}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {t(`${i18nPrefix}.${o}` as never)}
        </option>
      ))}
    </NativeSelect>
  );

  const activeFilters = ["outcome", "type", "impact", "horizon", "source", "triage", "days", "riskId", "rankingId"].filter(
    (k) => sp.get(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {select("outcome", OUTCOMES, "outcomes", t("filterOutcome"))}
      {select("type", TYPES, "types", t("filterType"))}
      {select("impact", ["high", "medium", "low"], "impact", t("filterImpact"))}
      {select("horizon", ["near", "mid", "long"], "horizon", t("filterHorizon"))}
      {select("source", ["web_search", "rss", "manual"], "sourceKinds", t("filterSource"))}
      {select("triage", ["new", "accepted", "dismissed", "converted"], "triage", t("filterTriage"))}
      <NativeSelect
        value={sp.get("days") ?? ""}
        onChange={(e) => setParam("days", e.target.value || null)}
        className={cn("w-auto", sp.get("days") && "border-maroon-300")}
        aria-label={t("filterDays")}
      >
        <option value="">{t("filterDays")}</option>
        <option value="7">{t("days7")}</option>
        <option value="30">{t("days30")}</option>
        <option value="90">{t("days90")}</option>
      </NativeSelect>

      {activeFilters.length ? (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname as never, { scroll: false })}>
          <X /> {t("clearFilters")}
        </Button>
      ) : null}

      <span className="ms-auto flex items-center gap-2">
        {canAdd ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Link2 /> {t("pasteLink")}
              </Button>
            </DialogTrigger>
            <DialogContent title={t("manualTitle")}>
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="manual-url">{t("manualUrl")}</Label>
                  <Input
                    id="manual-url"
                    dir="ltr"
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="manual-text">{t("manualText")}</Label>
                  <Textarea
                    id="manual-text"
                    rows={5}
                    placeholder={t("manualTextPlaceholder")}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="ghost">{tc("cancel")}</Button>
                  </DialogClose>
                  <Button loading={adding} onClick={addManual} disabled={!url.trim() && text.trim().length < 40}>
                    {t("extractSignals")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
        {canScan ? (
          <Button onClick={scanNow} loading={scanning}>
            <RefreshCw /> {t("scanNow")}
          </Button>
        ) : null}
      </span>
    </div>
  );
}
