import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { Reveal, Stagger } from "@/components/motion";
import { bi } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("askPage");

  const communities = await db
    .select({
      id: schema.communities.id,
      nameEn: schema.communities.nameEn,
      nameAr: schema.communities.nameAr,
      descriptionEn: schema.communities.descriptionEn,
      descriptionAr: schema.communities.descriptionAr,
      leadUserId: schema.communities.leadUserId,
      members: sql<number>`(select count(*) from community_members cm where cm.community_id = ${schema.communities.id})`,
    })
    .from(schema.communities);

  const leadIds = communities.map((c) => c.leadUserId).filter(Boolean) as string[];
  const leads = leadIds.length
    ? await db
        .select({
          id: schema.users.id,
          nameEn: schema.users.nameEn,
          nameAr: schema.users.nameAr,
          color: schema.users.avatarColor,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, leadIds))
    : [];

  return (
    <Reveal>
      <h1 className="text-2xl">{t("communities")}</h1>
      <p className="mt-1 text-sm text-ink-600">{t("communitiesSubtitle")}</p>
      <Stagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" step={0.04}>
        {communities.map((c) => {
          const lead = leads.find((l) => l.id === c.leadUserId);
          return (
            <Link key={c.id} href={`/ask/communities/${c.id}` as never} className="card card-hover flex flex-col gap-2 p-5">
              <p className="font-medium text-ink-900">{bi(locale, c.nameEn, c.nameAr)}</p>
              <p className="line-clamp-2 text-sm leading-relaxed text-ink-600">
                {bi(locale, c.descriptionEn ?? "", c.descriptionAr ?? "")}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-ink-400">
                {lead ? (
                  <>
                    <Avatar name={lead.nameEn} color={lead.color} size={20} />
                    <span>{bi(locale, lead.nameEn, lead.nameAr)}</span>
                  </>
                ) : null}
                <span className="ms-auto tnum">{t("memberCount", { count: c.members })}</span>
              </div>
            </Link>
          );
        })}
      </Stagger>
    </Reveal>
  );
}
