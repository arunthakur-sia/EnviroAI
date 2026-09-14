"use client";
// Settings: Users, Roles, Taxonomy and classification, Gamification, AI,
// Bounties, Integrations, Audit, Analytics.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Download, Plug, Plus, Copy } from "lucide-react";
import { bi } from "@/lib/utils";
import {
  Button,
  Input,
  NativeSelect,
  Chip,
  Avatar,
  Label,
  Skeleton,
} from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger, Switch, Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { MODULES, ACTIONS, PORTALS } from "@/server/db/json";
import { defaultPortalsForRole } from "@/server/auth/permissions";
import { UserAccessDialog } from "./UserAccessDialog";
import { AccessSettingsTab } from "./AccessSettingsTab";
import { AnalyticsTab, type AnalyticsData } from "./AnalyticsTab";
import { TrendsSettingsTab } from "./TrendsSettingsTab";
import { LessonsSettingsTab } from "./LessonsSettingsTab";
import { EntitiesSettingsTab } from "./EntitiesSettingsTab";
import { IndicesSettingsTab } from "./IndicesSettingsTab";

type UserRow = {
  id: string;
  email: string;
  nameEn: string;
  nameAr: string;
  roleId: string;
  departmentId: string | null;
  clearanceLevel: number;
  avatarColor: string;
  lastLoginAt: string | null;
};

type RoleRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  permissionsJson: string;
  portalsJson: string | null;
  defaultClearance: number;
  defaultDepartmentScope: string;
  isSystem: number;
  memberCount: number;
};

export function SettingsTabs(props: {
  canManage: boolean;
  canAnalytics: boolean;
  users: UserRow[];
  roles: RoleRow[];
  departments: { id: string; code: string; nameEn: string; nameAr: string; headUserId: string | null }[];
  aiSettings: {
    mockMode: boolean;
    modelDefault: string;
    modelBrief: string;
    modelFast: string;
    temperature: number;
    maxSources: number;
    allowSecretInAnswers: boolean;
  };
  flags: { gamification: boolean; gapRadar: boolean; signalScanner: boolean };
  rules: { id: string; eventType: string; points: number; isActive: boolean }[];
  analytics: AnalyticsData | null;
  taxonomy: Record<string, number>;
  classifications: { level: number; nameEn: string; nameAr: string; color: string }[];
  bounties: { id: string; titleEn: string; titleAr: string; points: number; status: string; source: string }[];
  integrations: { code: string; name: string; status: string; description: string }[];
}) {
  const t = useTranslations("settings");
  const { canManage, canAnalytics } = props;
  // CR05: deep-linkable tabs (?tab=entities and friends)
  const [initialTab] = React.useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("tab");
  });

  return (
    <Tabs
      defaultValue={initialTab ?? (canManage ? "users" : "analytics")}
      className="mt-6"
    >
      <TabsList className="flex-wrap">
        {canManage ? (
          <>
            <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>
            <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>
            <TabsTrigger value="taxonomy">{t("tabs.taxonomy")}</TabsTrigger>
            <TabsTrigger value="gamification">{t("tabs.gamification")}</TabsTrigger>
            <TabsTrigger value="ai">{t("tabs.ai")}</TabsTrigger>
            <TabsTrigger value="trends">{t("tabs.trends")}</TabsTrigger>
            <TabsTrigger value="lessons">{t("tabs.lessons")}</TabsTrigger>
            <TabsTrigger value="entities">{t("tabs.entities")}</TabsTrigger>
            <TabsTrigger value="indices">{t("tabs.indices")}</TabsTrigger>
            <TabsTrigger value="access">{t("tabs.access")}</TabsTrigger>
            <TabsTrigger value="bounties">{t("tabs.bounties")}</TabsTrigger>
            <TabsTrigger value="integrations">{t("tabs.integrations")}</TabsTrigger>
            <TabsTrigger value="audit">{t("tabs.audit")}</TabsTrigger>
          </>
        ) : null}
        {canAnalytics ? <TabsTrigger value="analytics">{t("tabs.analytics")}</TabsTrigger> : null}
      </TabsList>

      {canManage ? (
        <>
          <TabsContent value="users" className="mt-5">
            <UsersTab users={props.users} roles={props.roles} departments={props.departments} />
          </TabsContent>
          <TabsContent value="roles" className="mt-5">
            <RolesTab roles={props.roles} />
          </TabsContent>
          <TabsContent value="taxonomy" className="mt-5">
            <TaxonomyTab taxonomy={props.taxonomy} classifications={props.classifications} departments={props.departments} />
          </TabsContent>
          <TabsContent value="gamification" className="mt-5">
            <GamificationTab rules={props.rules} flags={props.flags} />
          </TabsContent>
          <TabsContent value="ai" className="mt-5">
            <AiTab settings={props.aiSettings} />
          </TabsContent>
          <TabsContent value="lessons" className="mt-5">
            <LessonsSettingsTab />
          </TabsContent>
          <TabsContent value="trends" className="mt-5">
            <TrendsSettingsTab />
          </TabsContent>
          <TabsContent value="entities" className="mt-5">
            <EntitiesSettingsTab />
          </TabsContent>
          <TabsContent value="indices" className="mt-5">
            <IndicesSettingsTab />
          </TabsContent>
          <TabsContent value="access" className="mt-5">
            <AccessSettingsTab roles={props.roles} departments={props.departments} />
          </TabsContent>
          <TabsContent value="bounties" className="mt-5">
            <BountiesTab bounties={props.bounties} />
          </TabsContent>
          <TabsContent value="integrations" className="mt-5">
            <IntegrationsTab integrations={props.integrations} />
          </TabsContent>
          <TabsContent value="audit" className="mt-5">
            <AuditTab />
          </TabsContent>
        </>
      ) : null}
      {canAnalytics ? (
        <TabsContent value="analytics" className="mt-5">
          <AnalyticsTab data={props.analytics} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

/* ---------------- Users ---------------- */

function UsersTab({
  users,
  roles,
  departments,
}: {
  users: UserRow[];
  roles: RoleRow[];
  departments: { id: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [q, setQ] = React.useState("");
  const [accessUser, setAccessUser] = React.useState<UserRow | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/v1/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) toast(t("userSaved"), "success");
    else {
      const json = await res.json();
      toast(json.error === "last_super_admin" ? t("lastSuperAdmin") : tc("error"), "error");
    }
  }

  const visible = users.filter(
    (u) =>
      !q ||
      u.nameEn.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchUsers")}
        className="mb-4 max-w-xs"
      />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-sand-50">
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("user")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("role")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("department")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("clearance")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("lastLogin")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-ink-600">{t("accessCol")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id} className="border-t border-sand-100">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={u.nameEn} color={u.avatarColor} size={28} />
                    <span>
                      <span className="block text-ink-900">{bi(locale, u.nameEn, u.nameAr)}</span>
                      <span className="block text-xs text-ink-400" dir="ltr">
                        {u.email}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2">
                  <NativeSelect
                    defaultValue={u.roleId}
                    onChange={(e) => patch(u.id, { roleId: e.target.value })}
                    className="h-8 w-auto text-xs"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {bi(locale, r.nameEn, r.nameAr)}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="px-4 py-2">
                  <NativeSelect
                    defaultValue={u.departmentId ?? ""}
                    onChange={(e) => patch(u.id, { departmentId: e.target.value || null })}
                    className="h-8 w-auto max-w-44 text-xs"
                  >
                    <option value="">-</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {bi(locale, d.nameEn, d.nameAr)}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="px-4 py-2">
                  <NativeSelect
                    defaultValue={String(u.clearanceLevel)}
                    onChange={(e) => patch(u.id, { clearanceLevel: Number(e.target.value) })}
                    className="h-8 w-auto text-xs"
                  >
                    {[1, 2, 3, 4].map((l) => (
                      <option key={l} value={l}>
                        {tc(`classification.${l}` as never)}
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="px-4 py-2 text-xs text-ink-400 tnum">
                  {u.lastLoginAt ? u.lastLoginAt.slice(0, 10) : "-"}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => setAccessUser(u)}
                    className="rounded-md border border-sand-300 px-2 py-1 text-[11px] font-medium text-ink-600 hover:border-maroon-300 hover:text-maroon-700 cursor-pointer"
                    data-testid="user-access-open"
                  >
                    {t("accessCol")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* CR05 6.2: the effective permission matrix with overrides */}
      <UserAccessDialog
        user={accessUser}
        roles={roles}
        departments={departments}
        onClose={() => setAccessUser(null)}
      />
    </div>
  );
}

/* ---------------- Roles ---------------- */

function RolesTab({ roles }: { roles: RoleRow[] }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<RoleRow | null>(null);
  const [matrix, setMatrix] = React.useState<Record<string, Record<string, boolean>>>({});
  const [nameEn, setNameEn] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [isNew, setIsNew] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  function openRole(role: RoleRow | null, duplicate = false) {
    if (role) {
      let parsed: Record<string, Record<string, boolean>> = {};
      try {
        parsed = JSON.parse(role.permissionsJson);
      } catch { /* skip */ }
      setMatrix(parsed);
      setNameEn(duplicate ? `${role.nameEn} copy` : role.nameEn);
      setNameAr(duplicate ? `${role.nameAr} نسخة` : role.nameAr);
      setEditing(duplicate ? null : role);
      setIsNew(duplicate);
    } else {
      setMatrix({});
      setNameEn("");
      setNameAr("");
      setEditing(null);
      setIsNew(true);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing?.id,
          nameEn,
          nameAr,
          permissions: matrix,
          defaultClearance: editing?.defaultClearance ?? 2,
          defaultDepartmentScope: editing?.defaultDepartmentScope ?? "all",
        }),
      });
      if (res.ok) {
        toast(t("roleSaved"), "success");
        setEditing(null);
        setIsNew(false);
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  const open = Boolean(editing) || isNew;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => openRole(null)}>
          <Plus /> {t("createRole")}
        </Button>
      </div>
      {/* CR05 6.4: portal visibility columns per role + Preview as */}
      <div className="card mb-5 overflow-x-auto" data-testid="role-portals">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="bg-sand-50">
              <th className="px-3 py-2 text-start font-semibold text-ink-600">{t("role")}</th>
              {PORTALS.map((p) => (
                <th key={p} className="px-1.5 py-2 text-center font-semibold text-ink-600">
                  {t(`portals.${p}` as never)}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const set = new Set<string>(
                (() => {
                  try {
                    const stored = JSON.parse(role.portalsJson ?? "null");
                    return Array.isArray(stored) ? stored : defaultPortalsForRole(role.nameEn);
                  } catch {
                    return defaultPortalsForRole(role.nameEn);
                  }
                })()
              );
              return (
                <tr key={role.id} className="border-t border-sand-100">
                  <td className="px-3 py-1.5 font-medium text-ink-900">
                    {bi(locale, role.nameEn, role.nameAr)}
                  </td>
                  {PORTALS.map((p) => (
                    <td key={p} className="px-1.5 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={set.has(p)}
                        onChange={async (e) => {
                          const next = new Set(set);
                          if (e.target.checked) next.add(p);
                          else next.delete(p);
                          const res = await fetch("/api/v1/roles", {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: role.id, portals: [...next] }),
                          });
                          if (res.ok) {
                            toast(t("roleSaved"), "success");
                            router.refresh();
                          } else toast(tc("error"), "error");
                        }}
                        className="size-3.5 accent-maroon-700"
                        aria-label={`${role.nameEn} ${p}`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-end">
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/v1/preview", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ action: "start", roleId: role.id }),
                        });
                        if (res.ok) window.location.href = window.location.pathname.replace(/\/settings.*/, "/home");
                        else toast(tc("error"), "error");
                      }}
                      className="rounded-md border border-sand-300 px-2 py-1 text-[11px] font-medium text-ink-600 hover:border-maroon-300 hover:text-maroon-700 cursor-pointer"
                      data-testid="preview-as-role"
                    >
                      {t("previewAs")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card divide-y divide-sand-100">
        {roles.map((role) => (
          <div key={role.id} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink-900">{bi(locale, role.nameEn, role.nameAr)}</span>
              <span className="block text-xs text-ink-400 tnum">
                {t("memberCount", { count: role.memberCount })}
              </span>
            </span>
            {role.isSystem ? <Chip tone="sand">{t("systemRole")}</Chip> : null}
            <Button variant="ghost" size="sm" onClick={() => openRole(role, true)}>
              <Copy /> {t("duplicate")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openRole(role)}>
              {tc("edit")}
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && (setEditing(null), setIsNew(false))}>
        <DialogContent title={editing ? t("editRole") : t("createRole")} className="max-h-[85vh] w-[min(760px,94vw)] overflow-y-auto">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <Label>{t("roleNameEn")}</Label>
              <Input value={nameEn} dir="ltr" onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div>
              <Label>{t("roleNameAr")}</Label>
              <Input value={nameAr} dir="rtl" onChange={(e) => setNameAr(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-sand-200">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="bg-sand-50">
                  <th className="px-3 py-2 text-start font-semibold text-ink-600">{t("module")}</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="px-2 py-2 text-center font-semibold text-ink-600">
                      {t(`actions.${a}` as never)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m} className="border-t border-sand-100">
                    <td className="px-3 py-1.5 font-medium text-ink-900">{t(`modules.${m}` as never)}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(matrix[m]?.[a])}
                          onChange={(e) =>
                            setMatrix((prev) => ({
                              ...prev,
                              [m]: { ...prev[m], [a]: e.target.checked },
                            }))
                          }
                          className="size-3.5 accent-maroon-700"
                          aria-label={`${m} ${a}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <Button loading={busy} onClick={save} disabled={!nameEn.trim()}>
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Taxonomy + classification + departments ---------------- */

function TaxonomyTab({
  taxonomy,
  classifications,
  departments,
}: {
  taxonomy: Record<string, number>;
  classifications: { level: number; nameEn: string; nameAr: string; color: string }[];
  departments: { code: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="card p-5">
        <p className="mb-3 text-sm font-medium text-ink-900">{t("taxonomyDims")}</p>
        <ul className="space-y-2 text-sm">
          {Object.entries(taxonomy).map(([dim, count]) => (
            <li key={dim} className="flex items-center justify-between text-ink-900">
              <span>{dim}</span>
              <span className="text-xs text-ink-400 tnum">{count}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-5">
        <p className="mb-3 text-sm font-medium text-ink-900">{t("classificationLevels")}</p>
        <ul className="space-y-2">
          {classifications.map((c) => (
            <li key={c.level} className="flex items-center gap-2 text-sm text-ink-900">
              <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
              {c.level}. {bi(locale, c.nameEn, c.nameAr)}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-ink-400">{t("classificationNote")}</p>
      </div>
      <div className="card p-5">
        <p className="mb-3 text-sm font-medium text-ink-900">{t("departmentsList")}</p>
        <ul className="space-y-1.5 text-sm">
          {departments.map((d) => (
            <li key={d.code} className="truncate text-ink-900">
              {bi(locale, d.nameEn, d.nameAr)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Gamification ---------------- */

function GamificationTab({
  rules,
  flags,
}: {
  rules: { id: string; eventType: string; points: number; isActive: boolean }[];
  flags: { gamification: boolean };
}) {
  const t = useTranslations("settings");
  const { toast } = useToast();
  const [globalOn, setGlobalOn] = React.useState(flags.gamification);

  async function patchRule(id: string, body: Record<string, unknown>) {
    await fetch("/api/v1/gamification/rules", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    toast(t("ruleSaved"), "success");
  }

  async function toggleGlobal(v: boolean) {
    setGlobalOn(v);
    await fetch("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ flags: { gamification: v } }),
    });
  }

  return (
    <div>
      <label className="card mb-4 flex items-center justify-between gap-3 p-4">
        <span>
          <span className="block text-sm font-medium text-ink-900">{t("gamificationGlobal")}</span>
          <span className="block text-xs text-ink-600">{t("gamificationGlobalHint")}</span>
        </span>
        <Switch checked={globalOn} onCheckedChange={toggleGlobal} />
      </label>
      <div className="card max-h-[480px] divide-y divide-sand-100 overflow-y-auto">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{r.eventType}</span>
            <Input
              type="number"
              defaultValue={r.points}
              onBlur={(e) => patchRule(r.id, { points: Number(e.target.value) })}
              className="h-8 w-20 text-end text-xs tnum"
              dir="ltr"
              aria-label={`${r.eventType} points`}
            />
            <Switch
              defaultChecked={r.isActive}
              onCheckedChange={(v) => patchRule(r.id, { isActive: v })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- AI ---------------- */

function AiTab({
  settings,
}: {
  settings: {
    mockMode: boolean;
    modelDefault: string;
    modelBrief: string;
    modelFast: string;
    temperature: number;
    maxSources: number;
    allowSecretInAnswers: boolean;
  };
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const [form, setForm] = React.useState(settings);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ai: form }),
      });
      if (res.ok) toast(t("aiSaved"), "success");
      else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex max-w-2xl flex-col gap-4 p-5">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-ink-900">{t("mockMode")}</span>
          <span className="block text-xs text-ink-600">{t("mockModeHint")}</span>
        </span>
        <Switch checked={form.mockMode} onCheckedChange={(v) => setForm({ ...form, mockMode: v })} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>{t("modelDefault")}</Label>
          <Input value={form.modelDefault} dir="ltr" onChange={(e) => setForm({ ...form, modelDefault: e.target.value })} />
        </div>
        <div>
          <Label>{t("modelBrief")}</Label>
          <Input value={form.modelBrief} dir="ltr" onChange={(e) => setForm({ ...form, modelBrief: e.target.value })} />
        </div>
        <div>
          <Label>{t("modelFast")}</Label>
          <Input value={form.modelFast} dir="ltr" onChange={(e) => setForm({ ...form, modelFast: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>
            {t("temperature")}: <span className="tnum">{form.temperature.toFixed(1)}</span>
          </Label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
            className="mt-2 w-full accent-maroon-700"
            aria-label={t("temperature")}
          />
        </div>
        <div>
          <Label>{t("maxSources")}</Label>
          <Input
            type="number"
            dir="ltr"
            value={form.maxSources}
            onChange={(e) => setForm({ ...form, maxSources: Number(e.target.value) })}
          />
        </div>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-ink-900">{t("allowSecret")}</span>
          <span className="block text-xs text-ink-600">{t("allowSecretHint")}</span>
        </span>
        <Switch
          checked={form.allowSecretInAnswers}
          onCheckedChange={(v) => setForm({ ...form, allowSecretInAnswers: v })}
        />
      </label>
      <div className="flex justify-end">
        <Button loading={busy} onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Bounties ---------------- */

function BountiesTab({
  bounties,
}: {
  bounties: { id: string; titleEn: string; titleAr: string; points: number; status: string; source: string }[];
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [points, setPoints] = React.useState(80);
  const [busy, setBusy] = React.useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/bounties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, points }),
      });
      if (res.ok) {
        toast(t("bountyAdded"), "success");
        setTitle("");
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-64 flex-1">
          <Label>{t("bountyTitle")}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>{t("bountyPoints")}</Label>
          <Input
            type="number"
            dir="ltr"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-24"
          />
        </div>
        <Button loading={busy} onClick={add} disabled={!title.trim()}>
          <Plus /> {t("postBounty")}
        </Button>
      </div>
      <div className="card divide-y divide-sand-100">
        {bounties.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink-900">{bi(locale, b.titleEn, b.titleAr)}</span>
            <Chip tone="gold" className="tnum">{b.points}</Chip>
            <Chip tone={b.status === "open" ? "ok" : "sand"}>{b.status}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Integrations ---------------- */

function IntegrationsTab({
  integrations,
}: {
  integrations: { code: string; name: string; status: string; description: string }[];
}) {
  const t = useTranslations("settings");
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {integrations.map((integration) => (
        <div key={integration.code} className="card flex flex-col gap-2 p-5">
          <div className="flex items-center gap-2.5">
            <Plug className="size-5 text-ink-400" />
            <p className="font-medium text-ink-900">{integration.name}</p>
            <Chip tone="sand" className="ms-auto">{t("notConfigured")}</Chip>
          </div>
          <p className="text-sm leading-relaxed text-ink-600">{integration.description}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input placeholder={t("endpointPlaceholder")} disabled dir="ltr" />
            <Input placeholder={t("keyPlaceholder")} disabled dir="ltr" type="password" />
          </div>
          <p className="text-[11px] text-ink-400">{t("integrationHint")}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Audit ---------------- */

function AuditTab() {
  const t = useTranslations("settings");
  const [rows, setRows] = React.useState<
    { id: string; action: string; resourceType: string | null; resourceId: string | null; createdAt: string; userNameEn: string | null; userEmail: string | null }[]
  >([]);
  const [action, setAction] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/audit?limit=200${action ? `&action=${action}` : ""}`);
      const json = await res.json();
      setRows(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [action]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <NativeSelect value={action} onChange={(e) => setAction(e.target.value)} className="w-auto">
          <option value="">{t("allActions")}</option>
          {["login", "view", "download", "create", "edit", "verify", "ask", "answer", "route", "brief"].map(
            (a) => (
              <option key={a} value={a}>
                {a}
              </option>
            )
          )}
        </NativeSelect>
        <a href={`/api/v1/audit?format=csv${action ? `&action=${action}` : ""}`} className="ms-auto">
          <Button variant="secondary" size="sm">
            <Download /> {t("exportCsv")}
          </Button>
        </a>
      </div>
      <div className="card max-h-[520px] overflow-auto">
        {loading ? (
          <div className="space-y-2 p-4" aria-busy>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-sand-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("timestamp")}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("user")}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("action")}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("resource")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-sand-100">
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs text-ink-400 tnum" dir="ltr">
                    {r.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-4 py-1.5 text-ink-900">{r.userNameEn ?? "-"}</td>
                  <td className="px-4 py-1.5">
                    <Chip tone="sand">{r.action}</Chip>
                  </td>
                  <td className="px-4 py-1.5 text-xs text-ink-600">
                    {r.resourceType ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
