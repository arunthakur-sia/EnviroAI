"use client";
// CR05 2.2: Settings > Entities. The register with create, edit, merge
// duplicates, and deactivate. Self-contained over /api/v1/entities.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Pencil, Merge, Power } from "lucide-react";
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

type EntityRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  shortNameEn: string | null;
  shortNameAr: string | null;
  kind: string;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  isActive: number;
  nameArMachine: number;
  mergedIntoId: string | null;
};

const KINDS = ["ministry", "agency", "authority", "company", "international", "other"] as const;

export function EntitiesSettingsTab() {
  const t = useTranslations("settings.entitiesTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<EntityRow[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<EntityRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [merging, setMerging] = React.useState<EntityRow | null>(null);
  const [mergeTarget, setMergeTarget] = React.useState("");
  const [form, setForm] = React.useState({
    nameEn: "",
    nameAr: "",
    shortNameEn: "",
    shortNameAr: "",
    kind: "other",
    website: "",
    contactName: "",
    contactEmail: "",
  });
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/entities?all=1");
      const j = await res.json();
      setRows(j.data ?? []);
    } catch {
      setRows([]);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (e: EntityRow) => {
    setEditing(e);
    setForm({
      nameEn: e.nameEn,
      nameAr: e.nameAr,
      shortNameEn: e.shortNameEn ?? "",
      shortNameAr: e.shortNameAr ?? "",
      kind: e.kind,
      website: e.website ?? "",
      contactName: e.contactName ?? "",
      contactEmail: e.contactEmail ?? "",
    });
  };
  const openCreate = () => {
    setCreating(true);
    setForm({
      nameEn: "",
      nameAr: "",
      shortNameEn: "",
      shortNameAr: "",
      kind: "ministry",
      website: "",
      contactName: "",
      contactEmail: "",
    });
  };

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/entities", {
        method: creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          creating ? form : { id: editing!.id, action: "update", ...form }
        ),
      });
      if (res.ok) {
        toast(t("saved"), "points");
        setCreating(false);
        setEditing(null);
        void load();
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(e: EntityRow) {
    await fetch("/api/v1/entities", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: e.id, action: e.isActive ? "deactivate" : "activate" }),
    });
    void load();
  }

  async function doMerge() {
    if (!merging || !mergeTarget) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/entities", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: merging.id, action: "merge", intoId: mergeTarget }),
      });
      if (res.ok) {
        toast(t("merged"), "points");
        setMerging(null);
        setMergeTarget("");
        void load();
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  const filtered = (rows ?? []).filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      e.nameEn.toLowerCase().includes(q) ||
      e.nameAr.includes(query) ||
      (e.shortNameEn ?? "").toLowerCase().includes(q)
    );
  });

  if (!rows) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const dialogOpen = creating || !!editing;

  return (
    <div data-testid="entities-settings">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="max-w-72"
          aria-label={t("searchPlaceholder")}
        />
        <span className="text-xs text-ink-600 tnum">{t("count", { count: filtered.length })}</span>
        <Button size="sm" className="ms-auto" onClick={openCreate} data-testid="entity-create">
          <Plus /> {t("add")}
        </Button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-sand-100 text-start text-[11px] uppercase tracking-wider text-ink-600">
              <th className="px-4 py-2.5 text-start">{t("name")}</th>
              <th className="px-4 py-2.5 text-start">{t("shortName")}</th>
              <th className="px-4 py-2.5 text-start">{t("kind")}</th>
              <th className="px-4 py-2.5 text-start">{t("contact")}</th>
              <th className="px-4 py-2.5 text-start">{t("status")}</th>
              <th className="px-4 py-2.5 text-end">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-sand-100 last:border-0" data-testid="entity-row">
                <td className="px-4 py-2.5">
                  <span className="block font-medium text-ink-900">{bi(locale, e.nameEn, e.nameAr)}</span>
                  <span className="block text-xs text-ink-600" dir="auto">
                    {locale === "ar" ? e.nameEn : e.nameAr}
                    {e.nameArMachine ? (
                      <Chip tone="warn" className="ms-2">{t("arReview")}</Chip>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-600">{bi(locale, e.shortNameEn ?? "", e.shortNameAr ?? "")}</td>
                <td className="px-4 py-2.5">
                  <Chip tone="sand">{t(`kinds.${e.kind}` as never)}</Chip>
                </td>
                <td className="px-4 py-2.5 text-xs text-ink-600">
                  {e.contactName ?? "-"}
                  {e.contactEmail ? <span className="block" dir="ltr">{e.contactEmail}</span> : null}
                </td>
                <td className="px-4 py-2.5">
                  {e.mergedIntoId ? (
                    <Chip tone="ghost">{t("mergedAway")}</Chip>
                  ) : e.isActive ? (
                    <Chip tone="ok">{t("active")}</Chip>
                  ) : (
                    <Chip tone="ghost">{t("inactive")}</Chip>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(e)}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-sand-100 hover:text-maroon-700 cursor-pointer"
                      aria-label={t("edit")}
                    >
                      <Pencil className="size-4" />
                    </button>
                    {!e.mergedIntoId ? (
                      <>
                        <button
                          onClick={() => setMerging(e)}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-sand-100 hover:text-maroon-700 cursor-pointer"
                          aria-label={t("merge")}
                        >
                          <Merge className="size-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(e)}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-sand-100 hover:text-maroon-700 cursor-pointer"
                          aria-label={e.isActive ? t("deactivate") : t("activate")}
                        >
                          <Power className="size-4" />
                        </button>
                      </>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && (setCreating(false), setEditing(null))}>
        <DialogContent title={creating ? t("add") : t("edit")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("nameEn")}</Label>
              <Input value={form.nameEn} onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label>{t("nameAr")}</Label>
              <Input value={form.nameAr} onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))} dir="rtl" />
            </div>
            <div>
              <Label>{t("shortEn")}</Label>
              <Input value={form.shortNameEn} onChange={(e) => setForm((f) => ({ ...f, shortNameEn: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label>{t("shortAr")}</Label>
              <Input value={form.shortNameAr} onChange={(e) => setForm((f) => ({ ...f, shortNameAr: e.target.value }))} dir="rtl" />
            </div>
            <div>
              <Label>{t("kind")}</Label>
              <NativeSelect value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}` as never)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>{t("website")}</Label>
              <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} dir="ltr" />
            </div>
            <div>
              <Label>{t("contactName")}</Label>
              <Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div>
              <Label>{t("contactEmail")}</Label>
              <Input value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} dir="ltr" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button loading={busy} onClick={submit} disabled={form.nameEn.trim().length < 2}>
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!merging} onOpenChange={(o) => !o && setMerging(null)}>
        <DialogContent title={t("mergeTitle", { name: merging?.nameEn ?? "" })}>
          <p className="mb-3 text-sm text-ink-600">{t("mergeHint")}</p>
          <NativeSelect value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
            <option value="">{t("pickTarget")}</option>
            {(rows ?? [])
              .filter((r) => r.id !== merging?.id && !r.mergedIntoId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {bi(locale, r.nameEn, r.nameAr)}
                </option>
              ))}
          </NativeSelect>
          <div className="mt-4 flex justify-end">
            <Button loading={busy} onClick={doMerge} disabled={!mergeTarget}>
              {t("mergeCta")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
