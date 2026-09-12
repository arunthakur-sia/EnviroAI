import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { toShelfDocs } from "@/server/services/documents";
import { canReadResource } from "@/server/auth/permissions";
import { bi } from "@/lib/utils";
import { Reveal } from "@/components/motion";
import { Shelf } from "@/components/nexus/Shelf";
import { EmptyState, Avatar } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("collections");
  const tc = await getTranslations("common");

  const [collection] = await db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.id, id))
    .limit(1);
  if (!collection) return <EmptyState title={tc("notFound")} className="mt-12" />;

  const items = await db
    .select()
    .from(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.collectionId, id),
        eq(schema.collectionItems.resourceType, "document")
      )
    )
    .orderBy(schema.collectionItems.sort);

  const docIds = items.map((i) => i.resourceId);
  const docs = docIds.length
    ? await db.select().from(schema.documents).where(inArray(schema.documents.id, docIds))
    : [];
  const visible = docs.filter(
    (d) =>
      !d.deletedAt &&
      canReadResource(user, {
        classificationLevel: d.classificationLevel,
        departmentId: d.departmentId,
      })
  );
  const shelfDocs = await toShelfDocs(visible);

  const curator = collection.ownerUserId
    ? (
        await db
          .select({ nameEn: schema.users.nameEn, nameAr: schema.users.nameAr, color: schema.users.avatarColor })
          .from(schema.users)
          .where(eq(schema.users.id, collection.ownerUserId))
          .limit(1)
      )[0]
    : null;

  return (
    <Reveal>
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl">{bi(locale, collection.nameEn, collection.nameAr)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          {bi(locale, collection.descriptionEn ?? "", collection.descriptionAr ?? "")}
        </p>
        {curator ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-600">
            <Avatar name={curator.nameEn} color={curator.color} size={20} />
            {t("curatedBy", { name: bi(locale, curator.nameEn, curator.nameAr) })}
          </p>
        ) : null}
      </div>
      {shelfDocs.length === 0 ? (
        <EmptyState title={t("emptyCollection")} className="mt-6" />
      ) : (
        <Shelf docs={shelfDocs} count={shelfDocs.length} />
      )}
    </Reveal>
  );
}
