import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getAiSettings, getFlags } from "@/server/settings";
import { analyticsSummary } from "@/server/services/analytics";
import { allIntegrations } from "@/server/integrations";
import { termsByDimension } from "@/server/services/taxonomy";
import { Reveal } from "@/components/motion";
import { SettingsTabs } from "./SettingsTabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const canManage = can(user, "manage", "settings");
  const canAnalytics = can(user, "read", "analytics");
  if (!canManage && !canAnalytics) redirect(`/${locale}/home`);
  const t = await getTranslations("settings");

  const [users, roles, departments, aiSettings, flags, rules, analytics, terms, classifications, bounties] =
    await Promise.all([
      canManage
        ? db
            .select({
              id: schema.users.id,
              email: schema.users.email,
              nameEn: schema.users.nameEn,
              nameAr: schema.users.nameAr,
              roleId: schema.users.roleId,
              departmentId: schema.users.departmentId,
              clearanceLevel: schema.users.clearanceLevel,
              avatarColor: schema.users.avatarColor,
              lastLoginAt: schema.users.lastLoginAt,
            })
            .from(schema.users)
        : Promise.resolve([]),
      db
        .select({
          id: schema.roles.id,
          nameEn: schema.roles.nameEn,
          nameAr: schema.roles.nameAr,
          permissionsJson: schema.roles.permissionsJson,
          portalsJson: schema.roles.portalsJson,
          defaultClearance: schema.roles.defaultClearance,
          defaultDepartmentScope: schema.roles.defaultDepartmentScope,
          isSystem: schema.roles.isSystem,
          memberCount: sql<number>`(select count(*) from users u where u.role_id = ${schema.roles.id})`,
        })
        .from(schema.roles),
      db.select().from(schema.departments),
      getAiSettings(),
      getFlags(),
      db.select().from(schema.gameRules).orderBy(schema.gameRules.eventType),
      canAnalytics ? analyticsSummary() : Promise.resolve(null),
      termsByDimension(),
      db.select().from(schema.classificationLevels).orderBy(schema.classificationLevels.level),
      db.select().from(schema.bounties).orderBy(schema.bounties.createdAt),
    ]);

  return (
    <Reveal>
      <h1 className="text-2xl">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      <SettingsTabs
        canManage={canManage}
        canAnalytics={canAnalytics}
        users={users}
        roles={roles}
        departments={departments.map((d) => ({
          id: d.id,
          code: d.code,
          nameEn: d.nameEn,
          nameAr: d.nameAr,
          headUserId: d.headUserId,
        }))}
        aiSettings={aiSettings}
        flags={flags}
        rules={rules.map((r) => ({
          id: r.id,
          eventType: r.eventType,
          points: r.points,
          isActive: r.isActive === 1,
        }))}
        analytics={analytics}
        taxonomy={Object.fromEntries(
          Object.entries(terms).map(([dim, list]) => [dim, list.length])
        )}
        classifications={classifications.map((c) => ({
          level: c.level,
          nameEn: c.nameEn,
          nameAr: c.nameAr,
          color: c.color,
        }))}
        bounties={bounties.map((b) => ({
          id: b.id,
          titleEn: b.titleEn,
          titleAr: b.titleAr,
          points: b.points,
          status: b.status,
          source: b.source,
        }))}
        integrations={allIntegrations()}
      />
    </Reveal>
  );
}
