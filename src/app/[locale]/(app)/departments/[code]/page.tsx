import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { toShelfDocs } from "@/server/services/documents";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { EmptyState, Avatar, SectionTitle, RagDot, Chip } from "@/components/ui/primitives";
import { Shelf } from "@/components/nexus/Shelf";

export const dynamic = "force-dynamic";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("departments");
  const tc = await getTranslations("common");

  const [dept] = await db
    .select()
    .from(schema.departments)
    .where(eq(schema.departments.code, code))
    .limit(1);
  if (!dept) return <EmptyState title={tc("notFound")} className="mt-12" />;

  const members = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.departmentId, dept.id));
  const head = members.find((m) => m.id === dept.headUserId) ?? null;

  // department shelf: documents owned by the department
  const docs = await db
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.departmentId, dept.id)))
    .orderBy(desc(schema.documents.createdAt))
    .limit(14);
  const visibleDocs = docs.filter(
    (d) => !d.deletedAt && d.classificationLevel <= user.clearanceLevel
  );
  const shelfDocs = await toShelfDocs(visibleDocs);

  // department nodes: strategy nodes owned by members
  const memberIds = members.map((m) => m.id);
  const nodes = memberIds.length
    ? await db
        .select()
        .from(schema.strategyNodes)
        .where(inArray(schema.strategyNodes.ownerUserId, memberIds))
        .limit(10)
    : [];

  // recent activity
  const activity = memberIds.length
    ? await db
        .select()
        .from(schema.auditLog)
        .where(inArray(schema.auditLog.userId, memberIds))
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(12)
    : [];
  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <Reveal>
      <div className="mb-8 max-w-3xl">
        <h1 className="text-2xl">{bi(locale, dept.nameEn, dept.nameAr)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          {bi(locale, dept.descriptionEn ?? "", dept.descriptionAr ?? "")}
        </p>
        {head ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-900">
            <Avatar name={head.nameEn} color={head.avatarColor} size={26} />
            {bi(locale, head.nameEn, head.nameAr)}
            <Chip tone="navy">{t("head")}</Chip>
          </p>
        ) : null}
      </div>

      {shelfDocs.length ? (
        <div className="mb-8">
          <SectionTitle>{t("shelf")}</SectionTitle>
          <Shelf docs={shelfDocs} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div>
          <SectionTitle>{t("members", { count: members.length })}</SectionTitle>
          <div className="card divide-y divide-mist-100">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <Avatar name={m.nameEn} color={m.avatarColor} size={28} />
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-900">{bi(locale, m.nameEn, m.nameAr)}</p>
                  <p className="truncate text-xs text-ink-400">
                    {bi(locale, m.positionEn ?? "", m.positionAr ?? "")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>{t("nodes")}</SectionTitle>
          {nodes.length ? (
            <div className="card divide-y divide-mist-100">
              {nodes.map((n) => (
                <Link
                  key={n.id}
                  href={`/strategy/${n.id}` as never}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-navy-50"
                >
                  <RagDot status={n.status} />
                  <span className="min-w-0 truncate text-ink-900">
                    {bi(locale, n.titleEn, n.titleAr)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-400">{t("noNodes")}</p>
          )}
        </div>

        <div>
          <SectionTitle>{t("activity")}</SectionTitle>
          {activity.length ? (
            <ol className="space-y-2.5">
              {activity.map((a) => {
                const member = a.userId ? memberMap.get(a.userId) : null;
                return (
                  <li key={a.id} className="flex items-center gap-2.5 text-sm">
                    {member ? (
                      <Avatar name={member.nameEn} color={member.avatarColor} size={22} />
                    ) : null}
                    <span className="min-w-0 truncate text-ink-600">
                      {member ? bi(locale, member.nameEn, member.nameAr) : "-"}{" "}
                      <span className="text-ink-400">{t(`actions.${a.action}` as never)}</span>
                    </span>
                    <span className="ms-auto shrink-0 text-[11px] text-ink-400">
                      {relativeTime(a.createdAt, locale)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-ink-400">{t("noActivity")}</p>
          )}
        </div>
      </div>
    </Reveal>
  );
}
