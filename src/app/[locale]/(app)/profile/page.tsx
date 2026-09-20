import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getExpertProfile, profileCompletion } from "@/server/services/experts";
import { newId, nowIso } from "@/lib/ids";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { Avatar, Chip, SectionTitle, ProgressRing } from "@/components/ui/primitives";
import { Tip } from "@/components/ui/overlays";
import { formatNumber } from "@/lib/format";
import { Flame, Medal } from "lucide-react";
import { ProfileForm } from "./ProfileForm";
import { SuggestedDomains } from "./SuggestedDomains";
import { getKnowledgeOfWeekAward } from "@/server/services/knowledge-of-week";
import { KnowledgeOfWeekAward } from "@/components/nexus/kow/KnowledgeOfWeekAward";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("profile");

  // ensure the expert profile exists (created automatically at first visit)
  let [expert] = await db
    .select()
    .from(schema.experts)
    .where(eq(schema.experts.userId, user.id))
    .limit(1);
  if (!expert) {
    const id = newId();
    await db.insert(schema.experts).values({
      id,
      userId: user.id,
      type: "npc_employee",
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      avatarColor: user.avatarColor,
      positionEn: user.positionEn,
      positionAr: user.positionAr,
      organisationEn: "National Planning Council",
      organisationAr: "المجلس الوطني للتخطيط",
      availability: "available",
      clearanceLevel: user.clearanceLevel,
      ownerUserId: user.id,
      isVerified: 1,
      visibilityClassification: 2,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    [expert] = await db.select().from(schema.experts).where(eq(schema.experts.id, id)).limit(1);
  }

  const profile = await getExpertProfile(user, expert.id);
  const domains = profile?.domains ?? [];
  const accepted = domains.filter((d) => d.accepted === 1);
  const suggested = domains.filter((d) => d.accepted === 0 && d.source === "ai_suggested");
  const completion = profileCompletion(expert, accepted.length);

  const [state] = await db
    .select()
    .from(schema.userGameState)
    .where(eq(schema.userGameState.userId, user.id))
    .limit(1);
  const levels = await db.select().from(schema.levels).orderBy(schema.levels.order);
  const totalPoints = state?.totalPoints ?? 0;
  const level = levels.filter((l) => l.minPoints <= totalPoints).pop();
  // CR08 7.1: the descriptor shows only on hover and here on the profile
  const nextLevel = levels.find((l) => l.minPoints > totalPoints) ?? null;
  const descriptor = level ? bi(locale, level.descriptorEn, level.descriptorAr) : "";
  const showLevel = user.quietMode !== 1 && Boolean(level);
  // CR08 8: the permanent Knowledge of the Week award, an honour rather than a
  // score. It has its own chip with the count of weeks and the latest date, so
  // the plain badge of the same name is dropped from My badges: the same
  // honour twice, one line apart, reads as a duplicate.
  const kowAward = await getKnowledgeOfWeekAward(user.id);
  const tk = await getTranslations("kow");
  const badges = (profile?.badges ?? []).filter((b) => !(kowAward.weeks > 0 && b.code === "knowledge_of_week"));

  let languages: string[] = [];
  try {
    languages = JSON.parse(expert.languagesJson ?? "[]");
  } catch { /* skip */ }

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <ProgressRing value={completion} size={90} stroke={5} color="var(--color-gold-500)">
          <Avatar name={user.nameEn} color={user.avatarColor} size={72} />
        </ProgressRing>
        <div>
          <h1 className="text-2xl">{bi(locale, user.nameEn, user.nameAr)}</h1>
          <p className="mt-0.5 text-sm text-ink-600">
            {bi(locale, user.positionEn ?? "", user.positionAr ?? "")}
            {user.department ? (
              <> · {bi(locale, user.department.nameEn, user.department.nameAr)}</>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Chip tone="gold">{t("completion", { pct: Math.round(completion * 100) })}</Chip>
            {showLevel && level ? (
              descriptor ? (
                <Tip content={t("levelTip", { level: bi(locale, level.nameEn, level.nameAr), descriptor })}>
                  <span
                    className="inline-flex cursor-default"
                    tabIndex={0}
                    aria-label={t("levelTip", { level: bi(locale, level.nameEn, level.nameAr), descriptor })}
                    data-testid="profile-level-chip"
                  >
                    <Chip tone="maroon" className="tnum">
                      {bi(locale, level.nameEn, level.nameAr)}
                    </Chip>
                  </span>
                </Tip>
              ) : (
                <Chip tone="maroon" className="tnum" data-testid="profile-level-chip">
                  {bi(locale, level.nameEn, level.nameAr)}
                </Chip>
              )
            ) : null}
            {user.quietMode !== 1 && state ? (
              <>
                <span className="text-ink-600 tnum">
                  {t("points", { count: state.totalPoints })}
                </span>
                {state.dailyStreak > 1 ? (
                  <span className="flex items-center gap-1 text-warn tnum">
                    <Flame className="size-3.5" /> {t("streak", { count: state.dailyStreak })}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {suggested.length ? (
        <SuggestedDomains
          suggestions={suggested.map((s) => ({
            id: s.id,
            nameEn: s.nameEn,
            nameAr: s.nameAr,
          }))}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProfileForm
          initial={{
            bioEn: expert.bioEn ?? "",
            bioAr: expert.bioAr ?? "",
            positionEn: user.positionEn ?? "",
            positionAr: user.positionAr ?? "",
            availability: expert.availability,
            languages,
            yearsExperience: expert.yearsExperience,
            localePref: user.localePref as "en" | "ar",
            numeralsPref: user.numeralsPref as "western" | "eastern",
            quietMode: user.quietMode === 1,
          }}
        />

        <aside className="space-y-6">
          {showLevel && level ? (
            <div className="card p-4" data-testid="profile-level-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
                {t("levelEyebrow")}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-maroon-900 tnum">
                {bi(locale, level.nameEn, level.nameAr)}
              </p>
              {descriptor ? (
                <p className="mt-0.5 text-sm text-ink-600" data-testid="profile-level-descriptor">
                  {descriptor}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-ink-400 tnum">
                {nextLevel
                  ? t("nextLevel", {
                      points: formatNumber(nextLevel.minPoints - totalPoints, locale, {
                        numerals: user.numeralsPref,
                        decimals: 0,
                      }),
                      level: bi(locale, nextLevel.nameEn, nextLevel.nameAr),
                    })
                  : t("topLevel")}
              </p>
            </div>
          ) : null}
          {accepted.length ? (
            <div>
              <SectionTitle>{t("myDomains")}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {accepted.map((d) => (
                  <Chip key={d.id} tone="maroon">
                    {bi(locale, d.nameEn, d.nameAr)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          {kowAward.weeks ? (
            <div data-testid="profile-kow-award">
              <SectionTitle>{tk("awardsSection")}</SectionTitle>
              <KnowledgeOfWeekAward
                weeks={kowAward.weeks}
                latestWeekStart={kowAward.latestWeekStart}
                numerals={user.numeralsPref}
              />
            </div>
          ) : null}
          {user.quietMode !== 1 && badges.length ? (
            <div>
              <SectionTitle>{t("myBadges")}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <Chip key={b.code} tone="gold">
                    <Medal className="size-3" /> {bi(locale, b.nameEn, b.nameAr)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </Reveal>
  );
}
