// CR08 5.4: one module report: the review payload from the reports service
// (sections, comments, versions, what the caller may do) handed to the
// client review screen. An invisible report answers with the friendly 404.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FileQuestion } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getModuleReport } from "@/server/services/reports";
import { canManageKnowledgeOfWeek } from "@/server/services/knowledge-of-week";
import { Reveal } from "@/components/motion";
import { EmptyState } from "@/components/ui/primitives";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";
import { ButtonLink } from "@/components/nexus/reports/ButtonLink";
import { ReportPage } from "./ReportPage";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const detail = await getModuleReport(user, id);
  if (!detail) {
    // A report that does not exist, or one this reader may not see (an
    // unpublished request of someone else's), reads the same way on purpose.
    // The page streams behind a loading.tsx boundary, so the shell is already
    // flushed and notFound() could not paint anything: the friendly state is
    // rendered in place, as vault/[id] does for a missing document.
    const tc = await getTranslations("common");
    const t = await getTranslations("reports");
    return (
      <Reveal>
        <EmptyState
          icon={<FileQuestion />}
          title={tc("notFound")}
          hint={t("hub.emptyGalleryHint")}
          className="mt-12"
          action={
            <ButtonLink href="/reports" variant="secondary" size="sm">
              {t("report.back")}
            </ButtonLink>
          }
        />
      </Reveal>
    );
  }
  return (
    <Reveal>
      {/* CR08 2.3: the Ask EnviroAI launcher knows this report */}
      <AskContextItem item={{ kind: "report", id, titleEn: detail.report.titleEn, titleAr: detail.report.titleAr, href: `/reports/${id}` }} />
      {/* CR08 8: the Knowledge of the Week control needs a server answer */}
      <ReportPage
        initial={detail}
        focusSection={sp.section ?? null}
        canSetKnowledgeOfWeek={canManageKnowledgeOfWeek(user)}
        numerals={user.numeralsPref}
      />
    </Reveal>
  );
}
