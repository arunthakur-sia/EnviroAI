import { redirect } from "next/navigation";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { can, visiblePortals } from "@/server/auth/permissions";
import { db, schema } from "@/server/db/client";
import { getAiSettings } from "@/server/settings";
import { anthropicKeyPresent, aiRefused } from "@/server/ai/client";
import { AppShell, type RailPrefs, type ShellUser } from "@/components/nexus/AppShell";

/** CR08 2.2: the rail state stored in users.prefs_json.rail. */
function railPrefsOf(prefsJson: string | null): RailPrefs {
  try {
    const prefs = prefsJson ? (JSON.parse(prefsJson) as { rail?: Partial<RailPrefs> }) : {};
    const rail = prefs.rail ?? {};
    return {
      expanded: rail.expanded !== false,
      collapsed: Array.isArray(rail.collapsed)
        ? rail.collapsed.filter((k): k is string => typeof k === "string")
        : [],
    };
  } catch {
    return { expanded: true, collapsed: [] };
  }
}

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

  const [aiSettings, stateRows, levelRows, unreadRows, kowRows, inboxRows] = await Promise.all([
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
    // CR08 8: a live Knowledge of the Week lights the Knowledge Hub group
    db
      .select({ id: schema.knowledgeOfWeek.id })
      .from(schema.knowledgeOfWeek)
      .where(eq(schema.knowledgeOfWeek.status, "active"))
      .limit(1),
    // CR08 9.2: threads with messages newer than the participant's last read
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.threadParticipants)
      .innerJoin(
        schema.messageThreads,
        eq(schema.messageThreads.id, schema.threadParticipants.threadId)
      )
      .where(
        and(
          eq(schema.threadParticipants.userId, user.id),
          eq(schema.messageThreads.status, "open"),
          or(
            isNull(schema.threadParticipants.lastReadAt),
            gt(schema.messageThreads.lastMessageAt, schema.threadParticipants.lastReadAt)
          )
        )
      ),
  ]);

  const points = stateRows[0]?.totalPoints ?? 0;
  const current = levelRows.filter((l) => l.minPoints <= points).pop();
  const next = levelRows.find((l) => l.minPoints > points);
  const levelProgress = next
    ? (points - (current?.minPoints ?? 0)) / (next.minPoints - (current?.minPoints ?? 0))
    : 1;

  const portals = visiblePortals(user);
  const shellUser: ShellUser = {
    id: user.id,
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    email: user.email,
    avatarColor: user.avatarColor,
    departmentCode: user.department?.code ?? null,
    canSettings:
      portals.includes("settings") &&
      (can(user, "manage", "settings") || can(user, "read", "analytics")),
    canUpload: can(user, "create", "vault"),
    levelProgress: Math.min(1, Math.max(0, levelProgress)),
    levelName:
      (locale === "ar" ? current?.nameAr : current?.nameEn) ?? "",
    levelDescriptor:
      (locale === "ar" ? current?.descriptorAr : current?.descriptorEn) ?? "",
    points,
    quietMode: user.quietMode === 1,
    clearance: user.clearanceLevel,
    /* CR05 6.1: the rail carries only visible portals */
    portals,
    /* CR05 6.4: the read-only preview banner */
    previewLabel: user.previewing?.label ?? null,
    rail: railPrefsOf(user.prefsJson),
    knowledgeOfWeekLive: kowRows.length > 0,
    inboxUnread: inboxRows[0]?.c ?? 0,
  };

  // a key that is present but refused counts as mock mode: the chip has to say
  // so, or every answer comes from the deterministic writer with nothing on
  // screen to explain why
  const aiMock = aiSettings.mockMode || !anthropicKeyPresent() || aiRefused();

  return (
    <AppShell user={shellUser} aiMock={aiMock} unreadCount={unreadRows[0]?.c ?? 0}>
      {children}
    </AppShell>
  );
}
