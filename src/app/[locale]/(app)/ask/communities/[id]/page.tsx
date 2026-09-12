import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { listQuestions } from "@/server/services/ask";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { EmptyState, Avatar, SectionTitle } from "@/components/ui/primitives";
import { QuestionRow } from "../../QuestionRow";

export const dynamic = "force-dynamic";

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("askPage");
  const tc = await getTranslations("common");

  const [community] = await db
    .select()
    .from(schema.communities)
    .where(eq(schema.communities.id, id))
    .limit(1);
  if (!community) return <EmptyState title={tc("notFound")} className="mt-12" />;

  const members = await db
    .select({
      role: schema.communityMembers.role,
      nameEn: schema.users.nameEn,
      nameAr: schema.users.nameAr,
      color: schema.users.avatarColor,
    })
    .from(schema.communityMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.communityMembers.userId))
    .where(eq(schema.communityMembers.communityId, id))
    .limit(20);

  const questions = await listQuestions(user, { communityId: id, limit: 30 });

  return (
    <Reveal>
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl">{bi(locale, community.nameEn, community.nameAr)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          {bi(locale, community.descriptionEn ?? "", community.descriptionAr ?? "")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <SectionTitle>{t("communityFeed")}</SectionTitle>
          {questions.length ? (
            <div className="card divide-y divide-sand-100">
              {questions.map((q) => (
                <QuestionRow key={q.id} q={q} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("communityEmpty")} hint={t("communityEmptyHint")} />
          )}
        </div>
        <aside>
          <SectionTitle>{t("members")}</SectionTitle>
          <div className="card divide-y divide-sand-100">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                <Avatar name={m.nameEn} color={m.color} size={26} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                  {bi(locale, m.nameEn, m.nameAr)}
                </span>
                {m.role === "lead" ? (
                  <span className="text-[10px] font-semibold uppercase text-gold-500">
                    {t("lead")}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Reveal>
  );
}
