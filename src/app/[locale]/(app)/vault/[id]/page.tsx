import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { asc, desc, eq } from "drizzle-orm";
import { ShieldAlert, BadgeCheck, Download, FileText, Headphones } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import {
  getDocument,
  documentTags,
  logView,
  relatedItems,
} from "@/server/services/documents";
import { getOwnerRefs } from "@/server/services/people";
import { parseJson, KeyFacts } from "@/server/db/json";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Chip, ClassificationChip, EmptyState } from "@/components/ui/primitives";
import { OwnerControl } from "@/components/nexus/people/OwnerControl";
import { Reveal } from "@/components/motion";
import { Link } from "@/i18n/navigation";
import { SetKnowledgeOfWeekButton } from "@/components/nexus/kow";
import {
  canManageKnowledgeOfWeek,
  kowKindForDocument,
} from "@/server/services/knowledge-of-week";
import { ReaderWorkspace } from "./ReaderWorkspace";
import { VerifyControls } from "./VerifyControls";
import { RelatedStrip } from "./RelatedStrip";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";

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
  const tk = await getTranslations("ksaReader");
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

  const [tags, chunks, tables, related, versions, ownerRefs, kowKind] = await Promise.all([
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
    // CR08 9.1: the owner as a person chip, so the card opens from the header
    getOwnerRefs([doc.ownerUserId]),
    // CR08 8: a study is offered as a study, everything else as a document
    kowKindForDocument(id),
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
  const owner = doc.ownerUserId ? ownerRefs[doc.ownerUserId] ?? null : null;
  const askItem = { kind: "document" as const, id, titleEn: doc.titleEn, titleAr: doc.titleAr, href: `/vault/${id}` };

  const viewerKind = doc.mime?.includes("pdf")
    ? "pdf"
    : doc.mime?.includes("wordprocessingml")
      ? "html"
      : tables.length
        ? "tables"
        : "text";

  return (
    <Reveal>
      {/* CR08 2.3: the Ask EnviroAI launcher knows this document */}
      <AskContextItem item={askItem} />
      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-navy-900 text-aqua-300" aria-hidden>
            <FileText className="size-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl leading-snug">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {doc.status === "verified" ? (
                <Chip tone="teal">
                  <BadgeCheck className="size-3" /> {tk("panel.verified")}
                </Chip>
              ) : (
                <Chip tone="mist">{tc(`status.${doc.status}` as never)}</Chip>
              )}
              <Chip tone="mist">{doc.languageOriginal.toUpperCase()}</Chip>
              <ClassificationChip
                level={doc.classificationLevel}
                labels={[
                  tc("classification.1"),
                  tc("classification.2"),
                  tc("classification.3"),
                  tc("classification.4"),
                ]}
              />
              {doc.titleArMachine || doc.summaryMachine ? (
                <Chip tone="aqua">{tc("aiTranslation")}</Chip>
              ) : null}
              {doc.pageCount ? (
                <span className="text-xs text-ink-600 tnum">{t("pageCount", { count: doc.pageCount })}</span>
              ) : null}
              {versions.length > 1 ? (
                <span className="text-xs text-ink-600 tnum">{t("versionCount", { count: versions.length })}</span>
              ) : null}
              <span className="text-xs text-ink-600 tnum">
                {tk("updated", { date: formatDate(doc.updatedAt, locale, { numerals: user.numeralsPref }) })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {/* CR08 9.1: the owner at the end side of the header, with the
              person card on hover or tap */}
          {owner ? (
            <OwnerControl
              owner={owner}
              role="owner"
              size="sm"
              align="end"
              item={{ type: askItem.kind, id, titleEn: doc.titleEn, titleAr: doc.titleAr, href: askItem.href }}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {/* CR08 8: a Knowledge Admin can make a verified item the week's pick */}
            {canManageKnowledgeOfWeek(user) && doc.status === "verified" ? (
              <SetKnowledgeOfWeekButton
                resourceType={kowKind}
                resourceId={id}
                titleEn={doc.titleEn}
                titleAr={doc.titleAr}
                numerals={user.numeralsPref}
              />
            ) : null}
            {canVerify && doc.status !== "verified" ? <VerifyControls documentId={id} /> : null}
            <a
              href={`/api/v1/documents/${id}/download`}
              className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-mist-300 bg-white px-4 text-sm font-medium text-ink-900 hover:border-navy-300 hover:text-navy-700"
            >
              <Download className="size-4" /> {tc("download")}
            </a>
            {/* CR02 4.3: make an episode from this document */}
            <Link
              href={`/podcast/new?document=${id}` as never}
              className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-mist-300 bg-white px-4 text-sm font-medium text-ink-900 hover:border-navy-300 hover:text-navy-700"
            >
              <Headphones className="size-4" /> {tp("listen")}
            </Link>
          </div>
        </div>
      </div>

      {/* Three-column reading workspace: outline, page viewer, EnviroAI Intelligence */}
      <ReaderWorkspace
        documentId={id}
        kind={viewerKind as "pdf" | "html" | "tables" | "text"}
        pageCount={doc.pageCount ?? 1}
        initialPage={initialPage}
        tables={tables.map((tb) => ({
          caption: tb.caption,
          columns: parseJson({ parse: (v) => v as string[] }, tb.columnsJson, []),
          rows: parseJson({ parse: (v) => v as string[][] }, tb.rowsJson, []),
        }))}
        outline={outline.map((o) => ({ heading: o.heading as string, page: o.pageFrom ?? 1 }))}
        keyFacts={keyFacts.map((f) => ({ text: bi(locale, f.text_en, f.text_ar), page: f.page ?? null }))}
        tags={tags.map((tag) => ({
          id: tag.id,
          label: bi(locale, tag.nameEn, tag.nameAr),
          tone: tag.dimension === "outcome" ? ("navy" as const) : ("mist" as const),
        }))}
        versions={versions.map((v) => ({ versionNo: v.versionNo, createdAt: v.createdAt, note: v.note }))}
        summaryEn={doc.summaryEn}
        summaryAr={doc.summaryAr}
        summaryMachine={doc.summaryMachine === 1}
        verified={doc.status === "verified"}
        numerals={user.numeralsPref}
      />

      <div id="related-documents">
        <RelatedStrip related={related} />
      </div>
    </Reveal>
  );
}
