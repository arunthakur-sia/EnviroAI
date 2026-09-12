import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { asc, desc, eq } from "drizzle-orm";
import { ShieldAlert, BadgeCheck, Download, Headphones } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import {
  getDocument,
  documentTags,
  logView,
  relatedItems,
} from "@/server/services/documents";
import { parseJson, KeyFacts } from "@/server/db/json";
import { bi } from "@/lib/utils";
import { Chip, ClassificationChip, EmptyState, Avatar } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { Link } from "@/i18n/navigation";
import { Reader } from "./Reader";
import { AiPanel } from "./AiPanel";
import { VerifyControls } from "./VerifyControls";
import { RelatedStrip } from "./RelatedStrip";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("reader");
  const tc = await getTranslations("common");
  const tp = await getTranslations("podcast");

  const { doc, allowed } = await getDocument(user, id);
  if (!doc) {
    return <EmptyState title={tc("notFound")} className="mt-12" />;
  }
  if (!allowed) {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title={tc("forbidden")}
        hint={t("clearanceHint")}
        className="mt-12"
      />
    );
  }
  await logView(user, id);

  const [tags, chunks, tables, related, versions, owner] = await Promise.all([
    documentTags(id),
    db
      .select({
        heading: schema.documentChunks.heading,
        pageFrom: schema.documentChunks.pageFrom,
        chunkIndex: schema.documentChunks.chunkIndex,
      })
      .from(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, id))
      .orderBy(asc(schema.documentChunks.chunkIndex)),
    db
      .select()
      .from(schema.documentTables)
      .where(eq(schema.documentTables.documentId, id))
      .limit(10),
    relatedItems(id),
    db
      .select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.documentId, id))
      .orderBy(desc(schema.documentVersions.versionNo)),
    doc.ownerUserId
      ? db
          .select({
            nameEn: schema.users.nameEn,
            nameAr: schema.users.nameAr,
            color: schema.users.avatarColor,
          })
          .from(schema.users)
          .where(eq(schema.users.id, doc.ownerUserId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const keyFacts = parseJson(KeyFacts, doc.keyFactsJson, []);
  const outline = chunks
    .filter((c) => c.heading)
    .filter((c, i, arr) => arr.findIndex((x) => x.heading === c.heading) === i)
    .slice(0, 40);
  const canVerify = can(user, "verify", "vault", {
    classificationLevel: doc.classificationLevel,
    departmentId: doc.departmentId,
  });
  const title = bi(locale, doc.titleEn, doc.titleAr);
  const initialPage = sp.page ? Number(sp.page) : 1;

  const viewerKind = doc.mime?.includes("pdf")
    ? "pdf"
    : doc.mime?.includes("wordprocessingml")
      ? "html"
      : tables.length
        ? "tables"
        : "text";

  return (
    <Reveal>
      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl leading-snug">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ClassificationChip
              level={doc.classificationLevel}
              labels={[
                tc("classification.1"),
                tc("classification.2"),
                tc("classification.3"),
                tc("classification.4"),
              ]}
            />
            <Chip tone={doc.status === "verified" ? "gulf" : "sand"}>
              {doc.status === "verified" ? <BadgeCheck className="size-3" /> : null}
              {tc(`status.${doc.status}` as never)}
            </Chip>
            {doc.titleArMachine || doc.summaryMachine ? (
              <Chip tone="gold">{tc("aiTranslation")}</Chip>
            ) : null}
            {owner[0] ? (
              <span className="flex items-center gap-1.5 text-xs text-ink-600">
                <Avatar name={owner[0].nameEn} color={owner[0].color} size={18} />
                {bi(locale, owner[0].nameEn, owner[0].nameAr)}
              </span>
            ) : null}
            {doc.pageCount ? (
              <span className="text-xs text-ink-400 tnum">
                {t("pageCount", { count: doc.pageCount })}
              </span>
            ) : null}
            {versions.length > 1 ? (
              <span className="text-xs text-ink-400 tnum">
                {t("versionCount", { count: versions.length })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canVerify && doc.status !== "verified" ? <VerifyControls documentId={id} /> : null}
          <a
            href={`/api/v1/documents/${id}/download`}
            className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-sand-300 bg-white px-4 text-sm font-medium text-ink-900 hover:border-maroon-300 hover:text-maroon-700"
          >
            <Download className="size-4" /> {tc("download")}
          </a>
          <BriefDialog resourceType="document" resourceId={id} />
          {/* CR02 4.3: make an episode from this document */}
          <Link
            href={`/podcast/new?document=${id}` as never}
            className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-sand-300 bg-white px-4 text-sm font-medium text-ink-900 hover:border-maroon-300 hover:text-maroon-700"
          >
            <Headphones className="size-4" /> {tp("listen")}
          </Link>
        </div>
      </div>

      {/* Three-column reading layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Outline */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-5">
            {outline.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {t("outline")}
                </p>
                <nav className="flex flex-col gap-0.5 text-sm">
                  {outline.map((o, i) => (
                    <a
                      key={i}
                      href={`?page=${o.pageFrom ?? 1}`}
                      className="truncate rounded px-2 py-1 text-ink-600 hover:bg-maroon-50 hover:text-maroon-900"
                    >
                      {o.heading}
                    </a>
                  ))}
                </nav>
              </div>
            ) : null}
            {keyFacts.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {t("keyFacts")}
                </p>
                <ul className="space-y-2 text-xs leading-relaxed text-ink-900">
                  {keyFacts.map((f, i) => (
                    <li key={i} className="rounded-lg bg-gold-100/60 px-2.5 py-2">
                      {bi(locale, f.text_en, f.text_ar)}
                      {f.page ? (
                        <span className="ms-1 text-ink-400 tnum">({f.page})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {tags.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {t("tags")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Chip key={tag.id} tone={tag.dimension === "outcome" ? "maroon" : "sand"}>
                      {bi(locale, tag.nameEn, tag.nameAr)}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        {/* Document */}
        <Reader
          documentId={id}
          kind={viewerKind as "pdf" | "html" | "tables" | "text"}
          pageCount={doc.pageCount ?? 1}
          initialPage={initialPage}
          tables={tables.map((tb) => ({
            caption: tb.caption,
            columns: parseJson({ parse: (v) => v as string[] }, tb.columnsJson, []),
            rows: parseJson({ parse: (v) => v as string[][] }, tb.rowsJson, []),
          }))}
        />

        {/* AI panel */}
        <AiPanel
          documentId={id}
          summaryEn={doc.summaryEn}
          summaryAr={doc.summaryAr}
          summaryMachine={doc.summaryMachine === 1}
        />
      </div>

      <RelatedStrip related={related} />
    </Reveal>
  );
}
