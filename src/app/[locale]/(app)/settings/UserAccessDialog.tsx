"use client";
// CR05 6.2: the user Access tab. The effective permission matrix with the
// source of each cell (role, grant, deny), portal toggles, override reasons
// and expiries, the audit trail, and the Super Admin's role/clearance/
// department/portal controls. Also "Preview as" this user (6.4).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Eye } from "lucide-react";
import { cn, bi } from "@/lib/utils";
import { Button, Chip, Input, Label, NativeSelect, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

type AccessData = {
  user: {
    id: string;
    nameEn: string;
    nameAr: string;
    email: string;
    roleId: string;
    roleName: string;
    clearanceLevel: number;
    departmentId: string | null;
    departmentScope: string;
  };
  matrix: { module: string; actions: { action: string; effective: boolean; source: string }[] }[];
  portals: { portal: string; effective: boolean; source: string }[];
  overrides: {
    permissionKey: string;
    effect: string;
    reason: string | null;
    setBy: string | null;
    setAt: string;
    expiresAt: string | null;
  }[];
  audit: { action: string; by: string | null; at: string; meta: string | null }[];
};

const SOURCE_TONE: Record<string, "sand" | "ok" | "danger" | "ghost"> = {
  role: "sand",
  grant: "ok",
  deny: "danger",
  none: "ghost",
};

export function UserAccessDialog({
  user,
  roles,
  departments,
  onClose,
}: {
  user: { id: string; nameEn: string; nameAr: string; email: string } | null;
  roles: { id: string; nameEn: string; nameAr: string }[];
  departments: { id: string; nameEn: string; nameAr: string }[];
  onClose: () => void;
}) {
  const t = useTranslations("settings.access");
  const ts = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = React.useState<AccessData | null>(null);
  const [reason, setReason] = React.useState("");
  const [expiry, setExpiry] = React.useState("");

  const load = React.useCallback(async () => {
    if (!user) return;
    setData(null);
    const res = await fetch(`/api/v1/users/${user.id}/access`);
    const j = await res.json();
    setData(j.data ?? null);
  }, [user]);
  React.useEffect(() => {
    void load();
  }, [load]);

  async function setOverride(permissionKey: string, effect: "grant" | "deny" | null) {
    if (!user) return;
    const res = await fetch(`/api/v1/users/${user.id}/access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        permissionKey,
        effect,
        reason: reason || undefined,
        expiresAt: expiry ? `${expiry}T23:59:59.000Z` : null,
      }),
    });
    if (res.ok) {
      toast(t("overrideSaved"), "success");
      void load();
    } else toast(tc("error"), "error");
  }

  async function patchUser(body: Record<string, unknown>) {
    if (!user) return;
    const res = await fetch(`/api/v1/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast(ts("userSaved"), "success");
      void load();
      router.refresh();
    } else toast(tc("error"), "error");
  }

  // cycle: role default -> grant -> deny -> back to default
  function nextEffect(source: string): "grant" | "deny" | null {
    if (source === "grant") return "deny";
    if (source === "deny") return null;
    return "grant";
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("title", { name: user?.nameEn ?? "" })}
        className="max-h-[88vh] w-[min(880px,96vw)] overflow-y-auto"
      >
        {!data ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-5" data-testid="user-access">
            {/* role / clearance / scope / preview */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="user-access-role">{ts("role")}</Label>
                <NativeSelect
                  id="user-access-role"
                  value={data.user.roleId}
                  onChange={(e) => patchUser({ roleId: e.target.value })}
                  className="w-44"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {bi(locale, r.nameEn, r.nameAr)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="user-access-clearance">{ts("clearance")}</Label>
                <NativeSelect
                  id="user-access-clearance"
                  value={String(data.user.clearanceLevel)}
                  onChange={(e) => patchUser({ clearanceLevel: Number(e.target.value) })}
                  className="w-36"
                >
                  {[1, 2, 3, 4].map((l) => (
                    <option key={l} value={l}>
                      {tc(`classification.${l}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="user-access-department">{ts("department")}</Label>
                <NativeSelect
                  id="user-access-department"
                  value={data.user.departmentId ?? ""}
                  onChange={(e) => patchUser({ departmentId: e.target.value || null })}
                  className="w-52"
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
                <Label htmlFor="user-access-scope">{t("scope")}</Label>
                <NativeSelect
                  id="user-access-scope"
                  value={data.user.departmentScope}
                  onChange={(e) => patchUser({ departmentScope: e.target.value })}
                  className="w-36"
                >
                  <option value="all">{t("scopeAll")}</option>
                  <option value="own">{t("scopeOwn")}</option>
                </NativeSelect>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="ms-auto"
                onClick={async () => {
                  const res = await fetch("/api/v1/preview", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ action: "start", userId: data.user.id }),
                  });
                  if (res.ok) window.location.href = window.location.pathname.replace(/\/settings.*/, "/home");
                  else toast(tc("error"), "error");
                }}
                data-testid="preview-as-user"
              >
                <Eye /> {ts("previewAs")}
              </Button>
            </div>

            {/* override context */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl bg-sand-50 p-3">
              <div className="min-w-56 flex-1">
                <Label htmlFor="user-access-reason">{t("reason")}</Label>
                <Input id="user-access-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} />
              </div>
              <div>
                <Label htmlFor="user-access-expiry">{t("expiry")}</Label>
                <Input id="user-access-expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} dir="ltr" className="w-40" />
              </div>
              <p className="w-full text-[11px] text-ink-600">{t("cycleHint")}</p>
            </div>

            {/* portals */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                {t("portals")}
              </p>
              <div className="flex flex-wrap gap-1.5" data-testid="user-portals">
                {data.portals.map((p) => (
                  <button
                    key={p.portal}
                    onClick={() => setOverride(`portal:${p.portal}`, nextEffect(p.source))}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer",
                      p.effective
                        ? "border-sand-300 bg-white text-ink-900"
                        : "border-dashed border-sand-300 bg-sand-50 text-ink-400 line-through"
                    )}
                    title={t(`sources.${p.source}` as never)}
                  >
                    {ts(`portals.${p.portal}` as never)}
                    <Chip tone={SOURCE_TONE[p.source] ?? "ghost"}>{t(`sources.${p.source}` as never)}</Chip>
                  </button>
                ))}
              </div>
            </div>

            {/* module matrix */}
            <div className="overflow-x-auto rounded-xl border border-sand-200" data-testid="access-matrix">
              <table className="w-full min-w-[680px] text-xs">
                <thead>
                  <tr className="bg-sand-50">
                    <th className="px-3 py-2 text-start font-semibold text-ink-600">{ts("module")}</th>
                    {data.matrix[0]?.actions.map((a) => (
                      <th key={a.action} className="px-2 py-2 text-center font-semibold text-ink-600">
                        {ts(`actions.${a.action}` as never)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.matrix.map((row) => (
                    <tr key={row.module} className="border-t border-sand-100">
                      <td className="px-3 py-1.5 font-medium text-ink-900">
                        {ts(`modules.${row.module}` as never)}
                      </td>
                      {row.actions.map((cell) => (
                        <td key={cell.action} className="px-2 py-1.5 text-center">
                          <button
                            onClick={() =>
                              setOverride(`${row.module}:${cell.action}`, nextEffect(cell.source))
                            }
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-md border text-[10px] font-semibold cursor-pointer",
                              cell.effective
                                ? cell.source === "grant"
                                  ? "border-ok bg-ok-light text-ok"
                                  : "border-sand-300 bg-white text-ink-900"
                                : cell.source === "deny"
                                  ? "border-danger bg-danger-light text-danger"
                                  : "border-sand-200 bg-sand-50 text-ink-200"
                            )}
                            title={`${row.module}:${cell.action} · ${t(`sources.${cell.source}` as never)}`}
                            aria-label={`${row.module} ${cell.action} ${cell.effective ? "on" : "off"} (${cell.source})`}
                          >
                            {cell.source === "grant" ? "+" : cell.source === "deny" ? "×" : cell.effective ? "✓" : ""}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* current overrides */}
            {data.overrides.length ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                  {t("overridesTitle")}
                </p>
                <ul className="flex flex-col gap-1 text-xs">
                  {data.overrides.map((o, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-sand-50 px-2.5 py-1.5">
                      <code className="tnum">{o.permissionKey}</code>
                      <Chip tone={o.effect === "grant" ? "ok" : "danger"}>{o.effect}</Chip>
                      {o.reason ? <span className="text-ink-600">{o.reason}</span> : null}
                      <span className="ms-auto text-ink-400 tnum">
                        {o.setBy ?? "-"} · {o.setAt.slice(0, 10)}
                        {o.expiresAt ? ` → ${o.expiresAt.slice(0, 10)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* audit trail */}
            <div data-testid="access-audit">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                {t("auditTitle")}
              </p>
              {data.audit.length ? (
                <ul className="flex flex-col gap-1 text-xs text-ink-600">
                  {data.audit.map((a, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="tnum text-ink-400">{a.at.slice(0, 16).replace("T", " ")}</span>
                      <span className="font-medium text-ink-900">{a.action}</span>
                      <span>{a.by ?? "-"}</span>
                      {a.meta ? <code className="truncate text-[10px] text-ink-400">{a.meta.slice(0, 80)}</code> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-600">{t("noAudit")}</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
