import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Archive } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import {
  getEditions,
  getEditionByCode,
  getOverview,
  getEditionNodes,
} from "@/server/services/strategy";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { OutcomeArc } from "./OutcomeArc";
import { TreeGraphSection } from "./TreeGraphSection";

export const dynamic = "force-dynamic";

export default async function StrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edition?: string; view?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("strategy");

  const editions = await getEditions();
  const editionCode = sp.edition ?? editions.find((e) => e.isDefault)?.code ?? "nds3";
  const edition = (await getEditionByCode(editionCode)) ?? editions[0];
  if (!edition) redirect(`/${locale}/home`);

  const [tiles, nodes] = await Promise.all([
    getOverview(edition.id),
    getEditionNodes(edition.id),
  ]);
  const isArchived = edition.status === "archived";

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-600">
            {bi(locale, edition.summaryEn ?? "", edition.summaryAr ?? "")}
          </p>
        </div>
        {/* Edition toggle */}
        <div className="inline-flex items-center gap-0.5 rounded-xl bg-sand-100 p-1">
          {editions.map((e) => (
            <Link
              key={e.code}
              href={(e.isDefault ? "/strategy" : `/strategy?edition=${e.code}`) as never}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm transition-colors",
                e.code === edition.code
                  ? "bg-white font-medium text-maroon-900 shadow-sm"
                  : "text-ink-600 hover:text-ink-900"
              )}
            >
              {bi(locale, e.nameEn, e.nameAr).replace(/Strategy|استراتيجية التنمية الوطنية/, "").trim() ||
                e.code.toUpperCase()}
              {e.status === "live" ? (
                <span className="ms-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ok align-middle" />
              ) : null}
            </Link>
          ))}
        </div>
      </div>

      {isArchived ? (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl border border-sand-300 bg-sand-100 px-4 py-3 text-sm text-ink-600"
          data-testid="archive-banner"
        >
          <Archive className="size-4 shrink-0" />
          {t("archiveBanner", {
            name: bi(locale, edition.nameEn, edition.nameAr),
          })}
        </div>
      ) : null}

      <OutcomeArc tiles={tiles} archived={isArchived} />

      <TreeGraphSection
        nodes={nodes.map((n) => ({
          id: n.id,
          parentId: n.parentId,
          nodeType: n.nodeType,
          code: n.code,
          titleEn: n.titleEn,
          titleAr: n.titleAr,
          status: n.status,
          ownerEntityName: n.ownerEntityName,
          verified: n.verified === 1,
        }))}
        archived={isArchived}
      />
    </Reveal>
  );
}
