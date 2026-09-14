"use client";
// CR05 6.3: Settings > Access: allowed sign-in domains and the invite-only
// onboarding (single or CSV; the invitation link is shown here and logged
// because no mail server exists locally).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Plus, Trash2 } from "lucide-react";
import { bi } from "@/lib/utils";
import {
  Button,
  Chip,
  Input,
  Label,
  NativeSelect,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type InviteRow = {
  id: string;
  email: string;
  nameEn: string | null;
  status: string;
  expiresAt: string;
  link: string | null;
};

export function AccessSettingsTab({
  roles,
  departments,
}: {
  roles: { id: string; nameEn: string; nameAr: string }[];
  departments: { id: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("settings.access");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [domains, setDomains] = React.useState<string[] | null>(null);
  const [newDomain, setNewDomain] = React.useState("");
  const [invites, setInvites] = React.useState<InviteRow[] | null>(null);
  const [form, setForm] = React.useState({
    email: "",
    nameEn: "",
    roleId: roles.find((r) => r.nameEn === "Reader")?.id ?? roles[0]?.id ?? "",
    departmentId: "",
    clearance: "2",
  });
  const [csv, setCsv] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [lastLinks, setLastLinks] = React.useState<{ email: string; link: string }[]>([]);

  const load = React.useCallback(async () => {
    const [settingsRes, invitesRes] = await Promise.all([
      fetch("/api/v1/settings"),
      fetch("/api/v1/invites"),
    ]);
    const s = await settingsRes.json().catch(() => null);
    const inv = await invitesRes.json().catch(() => null);
    setDomains(
      Array.isArray(s?.data?.allowedDomains) ? s.data.allowedDomains : ["npc.qa"]
    );
    setInvites(inv?.data ?? []);
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function saveDomains(next: string[]) {
    const res = await fetch("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allowedDomains: next }),
    });
    if (res.ok) {
      setDomains(next);
      toast(t("domainsSaved"), "success");
    } else toast(tc("error"), "error");
  }

  async function sendInvites(rows: { email: string; nameEn: string; roleId: string; departmentId?: string | null; clearanceLevel?: number }[]) {
    setBusy("invite");
    try {
      const res = await fetch("/api/v1/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invites: rows }),
      });
      const j = await res.json();
      if (res.ok) {
        setLastLinks(j.data.created ?? []);
        if (j.data.rejected?.length) {
          toast(t("someRejected", { count: j.data.rejected.length }), "error");
        } else {
          toast(t("invitesCreated", { count: j.data.created.length }), "success");
        }
        void load();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  if (!domains || !invites) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="access-settings">
      {/* allowed domains */}
      <div className="card p-4" data-testid="allowed-domains">
        <p className="mb-1 text-sm font-semibold text-ink-900">{t("domainsTitle")}</p>
        <p className="mb-3 text-xs text-ink-600">{t("domainsHint")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {domains.map((d) => (
            <Chip key={d} tone="sand" className="gap-1.5">
              <span dir="ltr">{d}</span>
              {domains.length > 1 ? (
                <button
                  onClick={() => saveDomains(domains.filter((x) => x !== d))}
                  className="text-ink-400 hover:text-danger cursor-pointer"
                  aria-label={t("removeDomain", { domain: d })}
                >
                  <Trash2 className="size-3" />
                </button>
              ) : null}
            </Chip>
          ))}
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
            placeholder="gov.qa"
            dir="ltr"
            className="h-8 w-36 text-xs"
            aria-label={t("addDomain")}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(newDomain)}
            onClick={() => {
              if (!domains.includes(newDomain)) void saveDomains([...domains, newDomain]);
              setNewDomain("");
            }}
          >
            <Plus /> {t("addDomain")}
          </Button>
        </div>
      </div>

      {/* single invite */}
      <div className="card p-4" data-testid="invite-single">
        <p className="mb-3 text-sm font-semibold text-ink-900">{t("inviteTitle")}</p>
        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <Label>{t("inviteEmail")}</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              dir="ltr"
              placeholder="name@npc.qa"
              className="w-56"
            />
          </div>
          <div>
            <Label>{t("inviteName")}</Label>
            <Input
              value={form.nameEn}
              onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              className="w-44"
            />
          </div>
          <div>
            <Label>{t("inviteRole")}</Label>
            <NativeSelect
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              className="w-40"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {bi(locale, r.nameEn, r.nameAr)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>{t("inviteDepartment")}</Label>
            <NativeSelect
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
              className="w-48"
            >
              <option value="">-</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {bi(locale, d.nameEn, d.nameAr)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>{t("inviteClearance")}</Label>
            <NativeSelect
              value={form.clearance}
              onChange={(e) => setForm((f) => ({ ...f, clearance: e.target.value }))}
              className="w-32"
            >
              {[1, 2, 3, 4].map((l) => (
                <option key={l} value={l}>
                  {tc(`classification.${l}` as never)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            size="sm"
            loading={busy === "invite"}
            disabled={!/.+@.+\..+/.test(form.email) || form.nameEn.length < 2}
            onClick={() =>
              sendInvites([
                {
                  email: form.email,
                  nameEn: form.nameEn,
                  roleId: form.roleId,
                  departmentId: form.departmentId || null,
                  clearanceLevel: Number(form.clearance),
                },
              ])
            }
            data-testid="invite-send"
          >
            {t("inviteCta")}
          </Button>
        </div>
        <div className="mt-3">
          <Label>{t("csvTitle")}</Label>
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={2}
            dir="ltr"
            placeholder={t("csvPlaceholder")}
          />
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            loading={busy === "invite"}
            disabled={!csv.trim()}
            onClick={() => {
              const rows = csv
                .split("\n")
                .map((line) => line.split(",").map((c) => c.trim()))
                .filter((c) => c[0]?.includes("@"))
                .map((c) => ({
                  email: c[0],
                  nameEn: c[1] || c[0].split("@")[0],
                  roleId:
                    roles.find((r) => r.nameEn.toLowerCase() === (c[2] ?? "").toLowerCase())?.id ??
                    form.roleId,
                  departmentId: null,
                  clearanceLevel: Number(c[3]) >= 1 && Number(c[3]) <= 4 ? Number(c[3]) : 2,
                }));
              if (rows.length) void sendInvites(rows);
            }}
          >
            {t("csvCta")}
          </Button>
        </div>
        {lastLinks.length ? (
          <div className="mt-3 rounded-lg bg-gold-100 p-3" data-testid="invite-links">
            <p className="mb-1.5 text-xs font-semibold text-maroon-900">{t("linksTitle")}</p>
            <ul className="flex flex-col gap-1 text-xs">
              {lastLinks.map((l) => (
                <li key={l.email} className="flex items-center gap-2">
                  <span dir="ltr">{l.email}</span>
                  <code className="truncate text-[10px] text-ink-600" dir="ltr">
                    {l.link}
                  </code>
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(`${window.location.origin}/${locale}${l.link}`);
                      toast(t("linkCopied"), "success");
                    }}
                    className="text-maroon-700 cursor-pointer"
                    aria-label={tc("copy")}
                  >
                    <Copy className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* invitation list */}
      <div className="card overflow-x-auto" data-testid="invite-list">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-sand-50 text-xs font-semibold text-ink-600">
              <th className="px-4 py-2.5 text-start">{t("inviteEmail")}</th>
              <th className="px-4 py-2.5 text-start">{t("inviteName")}</th>
              <th className="px-4 py-2.5 text-start">{t("status")}</th>
              <th className="px-4 py-2.5 text-start">{t("expires")}</th>
              <th className="px-4 py-2.5 text-end">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => (
              <tr key={i.id} className="border-t border-sand-100">
                <td className="px-4 py-2 text-xs" dir="ltr">{i.email}</td>
                <td className="px-4 py-2 text-xs">{i.nameEn ?? "-"}</td>
                <td className="px-4 py-2">
                  <Chip
                    tone={
                      i.status === "accepted"
                        ? "ok"
                        : i.status === "pending"
                          ? "sand"
                          : "ghost"
                    }
                  >
                    {t(`inviteStatus.${i.status}` as never)}
                  </Chip>
                </td>
                <td className="px-4 py-2 text-xs text-ink-600 tnum">{i.expiresAt.slice(0, 10)}</td>
                <td className="px-4 py-2 text-end">
                  {i.link ? (
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(`${window.location.origin}/${locale}${i.link}`);
                        toast(t("linkCopied"), "success");
                      }}
                      className="me-2 text-xs font-medium text-maroon-700 cursor-pointer"
                    >
                      {t("copyLink")}
                    </button>
                  ) : null}
                  {i.status === "pending" ? (
                    <button
                      onClick={async () => {
                        await fetch(`/api/v1/invites?id=${i.id}`, { method: "DELETE" });
                        void load();
                      }}
                      className="text-xs font-medium text-danger cursor-pointer"
                    >
                      {t("revoke")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!invites.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-600">
                  {t("noInvites")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-400">{t("selfRegistrationNote")}</p>
    </div>
  );
}
