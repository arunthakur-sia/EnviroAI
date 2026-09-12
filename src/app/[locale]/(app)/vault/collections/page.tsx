import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { sql } from "drizzle-orm";
import { LibraryBig } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { bi } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/motion";
import { EmptyState } from "@/components/ui/primitives";
import { CollectionCover } from "./CollectionCover";

export const dynamic = "force-dynamic";

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("collections");

  const collections = await db
    .select({
      id: schema.collections.id,
      nameEn: schema.collections.nameEn,
      nameAr: schema.collections.nameAr,
      descriptionEn: schema.collections.descriptionEn,
      descriptionAr: schema.collections.descriptionAr,
      coverStyle: schema.collections.coverStyle,
      isFeatured: schema.collections.isFeatured,
      count: sql<number>`(select count(*) from collection_items ci where ci.collection_id = ${schema.collections.id})`,
    })
    .from(schema.collections);

  return (
    <Reveal>
      <h1 className="text-2xl">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      {collections.length === 0 ? (
        <EmptyState icon={<LibraryBig />} title={t("empty")} className="mt-8" />
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {collections.map((c) => (
            <Link key={c.id} href={`/vault/collections/${c.id}` as never} className="group">
              <CollectionCover
                style={c.coverStyle}
                title={bi(locale, c.nameEn, c.nameAr)}
                count={c.count}
              />
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-600">
                {bi(locale, c.descriptionEn ?? "", c.descriptionAr ?? "")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Reveal>
  );
}
