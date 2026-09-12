import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Upload, LibraryBig } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listDocuments, toShelfDocs } from "@/server/services/documents";
import { termsByDimension, getDepartmentsLite } from "@/server/services/taxonomy";
import { Shelf, KnowledgeCard, type ShelfDoc } from "@/components/nexus/Shelf";
import { VaultToolbar } from "./VaultToolbar";
import { DocListRow } from "./DocListRow";
import { EmptyState, Button } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/motion";

export const dynamic = "force-dynamic";

export default async function VaultPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("vault");

  const view = sp.view === "grid" ? "grid" : sp.view === "list" ? "list" : "shelves";
  const groupBy = sp.group === "outcome" ? "outcome" : "type";

  const [{ documents }, terms, departments] = await Promise.all([
    listDocuments(user, {
      q: sp.q,
      knowledgeType: sp.type,
      outcome: sp.outcome,
      sector: sp.sector,
      topic: sp.topic,
      department: sp.department,
      year: sp.year ? Number(sp.year) : undefined,
      language: sp.language,
      classification: sp.classification ? Number(sp.classification) : undefined,
      status: sp.status,
      sort: (sp.sort as never) ?? "newest",
      limit: 120,
    }),
    termsByDimension(),
    getDepartmentsLite(),
  ]);

  const shelfDocs = await toShelfDocs(documents);
  const canUpload = can(user, "create", "vault");

  // group for shelves view
  let groups: { key: string; label: string; labelAr: string; docs: ShelfDoc[] }[] = [];
  if (view === "shelves") {
    if (groupBy === "type") {
      const byType = new Map<string, ShelfDoc[]>();
      for (const d of shelfDocs) {
        const key = d.typeCode ?? "other";
        (byType.get(key) ?? byType.set(key, []).get(key)!).push(d);
      }
      groups = [...byType.entries()].map(([key, docs]) => ({
        key,
        label: docs[0]?.typeNameEn ?? t("otherShelf"),
        labelAr: docs[0]?.typeNameAr ?? t("otherShelf"),
        docs,
      }));
    } else {
      // group by outcome via taggings is heavy; use a single shelf per outcome tag term
      const outcomes = terms.outcome ?? [];
      const { db, schema } = await import("@/server/db/client");
      const { inArray, and, eq } = await import("drizzle-orm");
      const docIds = shelfDocs.map((d) => d.id);
      const tags = docIds.length
        ? await db
            .select({
              resourceId: schema.taggings.resourceId,
              termId: schema.taggings.termId,
            })
            .from(schema.taggings)
            .where(
              and(
                eq(schema.taggings.resourceType, "document"),
                inArray(schema.taggings.resourceId, docIds)
              )
            )
        : [];
      const docMap = new Map(shelfDocs.map((d) => [d.id, d]));
      for (const o of outcomes) {
        const ids = tags.filter((tg) => tg.termId === o.id).map((tg) => tg.resourceId);
        const docs = ids.map((id) => docMap.get(id)).filter(Boolean) as ShelfDoc[];
        if (docs.length) groups.push({ key: o.code, label: o.nameEn, labelAr: o.nameAr, docs });
      }
      const taggedIds = new Set(tags.map((tg) => tg.resourceId));
      const untagged = shelfDocs.filter((d) => !taggedIds.has(d.id));
      if (untagged.length)
        groups.push({ key: "other", label: t("otherShelf"), labelAr: t("otherShelf"), docs: untagged });
    }
  }

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle", { count: shelfDocs.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/vault/collections">
            <Button variant="secondary">
              <LibraryBig /> {t("collections")}
            </Button>
          </Link>
          {canUpload ? (
            <Link href="/vault/upload">
              <Button>
                <Upload /> {t("upload")}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <VaultToolbar
        terms={{
          knowledge_type: terms.knowledge_type ?? [],
          outcome: terms.outcome ?? [],
          sector: terms.sector ?? [],
          topic: terms.topic ?? [],
        }}
        departments={departments}
      />

      {shelfDocs.length === 0 ? (
        <EmptyState
          icon={<LibraryBig />}
          title={t("emptyTitle")}
          hint={t("emptyHint")}
          action={
            canUpload ? (
              <Link href="/vault/upload">
                <Button>
                  <Upload /> {t("upload")}
                </Button>
              </Link>
            ) : undefined
          }
          className="mt-8"
        />
      ) : view === "shelves" ? (
        <div className="mt-6">
          {groups.map((g) => (
            <Shelf key={g.key} docs={g.docs} label={g.label} labelAr={g.labelAr} count={g.docs.length} />
          ))}
        </div>
      ) : view === "grid" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shelfDocs.map((d) => (
            <KnowledgeCard key={d.id} doc={d} />
          ))}
        </div>
      ) : (
        <div className="card mt-6 divide-y divide-sand-100">
          {shelfDocs.map((d) => (
            <DocListRow key={d.id} doc={d} />
          ))}
        </div>
      )}
    </Reveal>
  );
}
