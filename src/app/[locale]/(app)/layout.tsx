import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { db, schema } from "@/server/db/client";
import { getAiSettings } from "@/server/settings";
import { anthropicKeyPresent } from "@/server/ai/client";
import { AppShell, type ShellUser } from "@/components/nexus/AppShell";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const [aiSettings, stateRows, levelRows, unreadRows] = await Promise.all([
    getAiSettings(),
    db
      .select()
      .from(schema.userGameState)
      .where(eq(schema.userGameState.userId, user.id))
      .limit(1),
    db.select().from(schema.levels).orderBy(schema.levels.order),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, user.id),
          isNull(schema.notifications.readAt)
        )
      ),
  ]);

  const points = stateRows[0]?.totalPoints ?? 0;
  const current = levelRows.filter((l) => l.minPoints <= points).pop();
  const next = levelRows.find((l) => l.minPoints > points);
  const levelProgress = next
    ? (points - (current?.minPoints ?? 0)) / (next.minPoints - (current?.minPoints ?? 0))
    : 1;

  const shellUser: ShellUser = {
    id: user.id,
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    email: user.email,
    avatarColor: user.avatarColor,
    departmentCode: user.department?.code ?? null,
    canSettings: can(user, "manage", "settings") || can(user, "read", "analytics"),
    canUpload: can(user, "create", "vault"),
    levelProgress: Math.min(1, Math.max(0, levelProgress)),
    levelName:
      (locale === "ar" ? current?.nameAr : current?.nameEn) ?? "",
    points,
    quietMode: user.quietMode === 1,
    clearance: user.clearanceLevel,
  };

  const aiMock = aiSettings.mockMode || !anthropicKeyPresent();

  return (
    <AppShell user={shellUser} aiMock={aiMock} unreadCount={unreadRows[0]?.c ?? 0}>
      {children}
    </AppShell>
  );
}
