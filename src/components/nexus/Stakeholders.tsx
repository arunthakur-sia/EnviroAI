"use client";
// CR05 3.2: the Stakeholders section on project and initiative pages and at
// the end of the node drawer. Rows in the fixed order sponsor, owner, manager,
// team, experts involved, external partners; a person holding two roles
// appears twice with distinct chips. Inline add with person search.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Mail, Plus, UserRound, X } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Avatar, Chip, Button, Input, NativeSelect } from "@/components/ui/primitives";
import type { StakeholderRow } from "@/server/services/strategy";

const ROLE_TONES: Record<string, "maroon" | "gulf" | "gold" | "sand" | "ghost"> = {
  sponsor: "maroon",
  owner: "gulf",
  manager: "gold",
  team: "sand",
  expert: "gulf",
  external_partner: "ghost",
};

type SearchHit = {
  kind: "user" | "expert";
  id: string;
  nameEn: string;
  nameAr: string;
  subtitleEn: string;
  subtitleAr: string;
};

export function StakeholdersSection({
  nodeId,
  rows: initialRows,
  canEdit,
  compact = false,
}: {
  nodeId: string;
  rows: StakeholderRow[];
  canEdit: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("strategy.stakeholders");
  const locale = useLocale();
  const [rows, setRows] = React.useState(initialRows);
  const [adding, setAdding] = React.useState(false);
  const [role, setRole] = React.useState("team");
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [picked, setPicked] = React.useState<SearchHit | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setRows(initialRows), [initialRows]);

  React.useEffect(() => {
    if (picked || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const h = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/strategy/stakeholders?q=${encodeURIComponent(query.trim())}`
        );
        const json = await res.json();
        setHits(json.data ?? []);
      } catch {
        setHits([]);
      }
    }, 250);
    return () => clearTimeout(h);
  }, [query, picked]);

  async function add() {
    if (!picked || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/strategy/stakeholders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nodeId,
          role,
          personKind: picked.kind === "expert" ? "expert" : "employee",
          userId: picked.kind === "user" ? picked.id : undefined,
          expertId: picked.kind === "expert" ? picked.id : undefined,
          roleNoteEn: note || undefined,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setRows((r) => [...r, json.data]);
        setPicked(null);
        setQuery("");
        setNote("");
        setAdding(false);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!rows.length && !canEdit) return null;

  return (
    <section data-testid="stakeholders-section" className={compact ? "" : "mt-8"}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={compact ? "text-sm font-semibold" : "text-lg"}>{t("title")}</h2>
        {canEdit ? (
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-1 rounded-lg border border-sand-300 bg-white px-2 py-1 text-xs font-medium text-ink-600 hover:border-maroon-300 hover:text-maroon-700 cursor-pointer"
            data-testid="stakeholder-add-toggle"
          >
            {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {adding ? t("cancel") : t("add")}
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="card mb-4 flex flex-col gap-2.5 p-3.5" data-testid="stakeholder-add-form">
          <div className="flex flex-wrap gap-2.5">
            <NativeSelect
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-44"
              aria-label={t("role")}
            >
              {["sponsor", "owner", "manager", "team", "expert", "external_partner"].map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}` as never)}
                </option>
              ))}
            </NativeSelect>
            <div className="relative min-w-56 flex-1">
              <Input
                value={picked ? bi(locale, picked.nameEn, picked.nameAr) : query}
                onChange={(e) => {
                  setPicked(null);
                  setQuery(e.target.value);
                }}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
              />
              {hits.length ? (
                <div className="absolute top-11 z-30 w-full overflow-hidden rounded-xl border border-sand-300 bg-white shadow-[var(--shadow-pop)]">
                  {hits.slice(0, 6).map((h) => (
                    <button
                      key={`${h.kind}:${h.id}`}
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-maroon-100/50 cursor-pointer"
                      onClick={() => {
                        setPicked(h);
                        setHits([]);
                      }}
                    >
                      <UserRound className="size-4 text-ink-400" />
                      <span className="truncate">{bi(locale, h.nameEn, h.nameAr)}</span>
                      <span className="ms-auto shrink-0 text-xs text-ink-600">
                        {bi(locale, h.subtitleEn, h.subtitleAr)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            aria-label={t("notePlaceholder")}
          />
          <div>
            <Button size="sm" onClick={add} loading={busy} disabled={!picked}>
              {t("confirm")}
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-sand-100">
        {rows.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5" data-testid="stakeholder-row">
            <Avatar name={s.nameEn || s.nameAr} color={s.avatarColor} size={compact ? 30 : 36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {bi(locale, s.nameEn, s.nameAr)}
                <span className="ms-2 inline-block text-xs font-normal text-ink-400" dir="auto">
                  {locale === "ar" ? s.nameEn : s.nameAr}
                </span>
              </p>
              <p className="truncate text-xs text-ink-600">
                {bi(locale, s.organisationEn ?? "", s.organisationAr ?? "")}
                {s.roleNoteEn || s.roleNoteAr ? (
                  <span className="text-ink-400"> · {bi(locale, s.roleNoteEn ?? "", s.roleNoteAr ?? "")}</span>
                ) : null}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5">
              {s.domain ? (
                <Chip tone="gulf" className="hidden sm:inline-flex">
                  {bi(locale, s.domain.nameEn, s.domain.nameAr)}
                </Chip>
              ) : null}
              <Chip tone={ROLE_TONES[s.role] ?? "sand"} data-testid="stakeholder-role-chip">
                {t(`roles.${s.role}` as never)}
              </Chip>
              {s.email ? (
                <a
                  href={`mailto:${s.email}`}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-sand-100 hover:text-maroon-700"
                  aria-label={t("email", { name: s.nameEn })}
                >
                  <Mail className="size-4" />
                </a>
              ) : null}
              {s.expertId ? (
                <Link
                  href={`/experts/${s.expertId}` as never}
                  className={cn(
                    "rounded-lg border border-sand-300 px-2 py-1 text-[11px] font-medium text-ink-600 hover:border-maroon-300 hover:text-maroon-700"
                  )}
                >
                  {t("profile")}
                </Link>
              ) : null}
            </span>
          </li>
        ))}
        {!rows.length ? (
          <li className="py-3 text-sm text-ink-600">{t("empty")}</li>
        ) : null}
      </ul>
    </section>
  );
}
