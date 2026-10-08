import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { toShelfDocs } from "@/server/services/documents";
import { getOwnerRefs } from "@/server/services/people";
import { canReadResource } from "@/server/auth/permissions";
import { bi } from "@/lib/utils";
import { Reveal } from "@/components/motion";
import { Shelf } from "@/components/nexus/Shelf";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import { EmptyState } from "@/components/ui/primitives";
import { ReportButton } from "@/components/nexus/ReportButton";
import { Link } from "@/i18n/navigation";
import { Headphones } from "lucide-react";

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
  const tp = await getTranslations("podcast");

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

  // CR08 9.1: the custodian of the collection, with the person card
  const curatorRefs = await getOwnerRefs([collection.ownerUserId]);
  const curator = collection.ownerUserId ? curatorRefs[collection.ownerUserId] ?? null : null;

  return (
    <Reveal>
      <div className="mb-6 flex max-w-3xl flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
        <h1 className="text-2xl">{bi(locale, collection.nameEn, collection.nameAr)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          {bi(locale, collection.descriptionEn ?? "", collection.descriptionAr ?? "")}
        </p>
        {curator ? (
          <div className="mt-3">
            <OwnerControl
              owner={curator}
              role="custodian"
              size="sm"
              align="start"
              item={{
                type: "collection",
                id: collection.id,
                titleEn: collection.nameEn,
                titleAr: collection.nameAr,
                href: `/vault/collections/${collection.id}`,
              }}
            />
          </div>
        ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* CR02 4.3: make an episode from this collection */}
          <Link
            href={`/podcast/new?collection=${collection.id}` as never}
            className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-mist-300 bg-white px-4 text-sm font-medium text-ink-900 hover:border-navy-300 hover:text-navy-700"
          >
            <Headphones className="size-4" /> {tp("listen")}
          </Link>
          {/* CR02 7.1: report over this collection */}
          <ReportButton
            scope={{
              kind: "collection",
              ids: [collection.id],
              labelEn: collection.nameEn,
              labelAr: collection.nameAr,
            }}
          />
        </div>
      </div>
      {shelfDocs.length === 0 ? (
        <EmptyState title={t("emptyCollection")} className="mt-6" />
      ) : (
        <Shelf docs={shelfDocs} count={shelfDocs.length} />
      )}
    </Reveal>
  );
}
