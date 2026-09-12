import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UserRoundPlus, Users } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listExperts } from "@/server/services/experts";
import { termsByDimension } from "@/server/services/taxonomy";
import { Reveal, Stagger } from "@/components/motion";
import { Link } from "@/i18n/navigation";
import { Button, EmptyState } from "@/components/ui/primitives";
import { ExpertCard } from "@/components/nexus/ExpertCard";
import { ExpertsToolbar } from "./ExpertsToolbar";

export const dynamic = "force-dynamic";

export default async function ExpertsPage({
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
  const t = await getTranslations("experts");

  const [experts, terms] = await Promise.all([
    listExperts(user, {
      q: sp.q,
      type: sp.type,
      domain: sp.domain,
      availability: sp.availability,
    }),
    termsByDimension(),
  ]);

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle", { count: experts.length })}</p>
        </div>
        {can(user, "create", "experts") ? (
          <Link href="/experts/new">
            <Button>
              <UserRoundPlus /> {t("addExternal")}
            </Button>
          </Link>
        ) : null}
      </div>

      <ExpertsToolbar topics={[...(terms.topic ?? []), ...(terms.sector ?? [])]} />

      {experts.length === 0 ? (
        <EmptyState icon={<Users />} title={t("empty")} hint={t("emptyHint")} className="mt-8" />
      ) : (
        <Stagger className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" step={0.03}>
          {experts.map((e) => (
            <ExpertCard key={e.id} expert={e} />
          ))}
        </Stagger>
      )}
    </Reveal>
  );
}
