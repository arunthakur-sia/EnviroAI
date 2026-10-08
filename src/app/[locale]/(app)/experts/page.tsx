// CR08 3: the Expert Network in two registers. Internal experts (Office staff)
// grouped by organisation unit with a flat toggle; external experts (other
// entities, academia, consultants, international advisors) with their own
// filters and "Request this expert" on every card. The view comes from the
// URL, then the person's remembered preference, then Internal.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UserRoundPlus, Users } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getExpertsPage, type ExpertKind } from "@/server/services/experts";
import { termsByDimension } from "@/server/services/taxonomy";
import { Reveal, Stagger } from "@/components/motion";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/ui/primitives";
import { ExpertCard } from "@/components/nexus/ExpertCard";
import { ExpertsToolbar } from "./ExpertsToolbar";
import { ExpertsSegments } from "./ExpertsSegments";
import { InternalBoard } from "./InternalBoard";

export const dynamic = "force-dynamic";

/* a link that reads as the primary button, without nesting a button in it */
const LINK_BUTTON =
  "inline-flex h-9.5 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 [&_svg]:size-4 [&_svg]:shrink-0";
const LINK_PRIMARY = `${LINK_BUTTON} bg-navy-700 text-white shadow-sm hover:bg-navy-900`;
const LINK_SECONDARY = `${LINK_BUTTON} border border-mist-300 bg-white text-ink-900 hover:border-navy-300 hover:text-navy-700`;

function readPrefs(raw: string | null): Record<string, unknown> {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

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

  const prefs = readPrefs(user.prefsJson);
  const remembered = prefs.expertsView === "external" ? "external" : "internal";
  const view: ExpertKind =
    sp.view === "external" || sp.view === "internal" ? sp.view : remembered;
  const layout = sp.layout === "flat" ? "flat" : "grouped";

  const [data, terms] = await Promise.all([
    getExpertsPage(user, {
      view,
      q: sp.q,
      type: sp.type,
      domain: sp.domain,
      availability: sp.availability,
      unit: sp.unit,
      level: sp.level,
      projects: sp.projects === "1",
      organisation: sp.organisation,
      country: sp.country,
      workedWith: sp.workedWith === "1",
    }),
    termsByDimension(),
  ]);
  const topics = [...(terms.topic ?? []), ...(terms.sector ?? [])];
  const canAdd = can(user, "create", "experts");
  const anyFilter = Boolean(
    sp.q || sp.type || sp.domain || sp.availability || sp.unit || sp.level || sp.projects || sp.organisation || sp.country || sp.workedWith
  );
  const initialOpen =
    prefs.expertsGroups && typeof prefs.expertsGroups === "object"
      ? (prefs.expertsGroups as Record<string, boolean>)
      : {};

  return (
    <Reveal>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">
            {t("subtitle", { count: data.counts.internal + data.counts.external })}
          </p>
        </div>
        {/* "Add external expert" belongs to the External view only (CR08 3) */}
        {view === "external" && canAdd ? (
          <Link href="/experts/new" className={LINK_PRIMARY} data-testid="add-external">
            <UserRoundPlus /> {t("addExternal")}
          </Link>
        ) : null}
      </div>

      <ExpertsSegments view={view} counts={data.counts} />

      <div className="mt-5">
        <ExpertsToolbar view={view} topics={topics} facets={data.facets} />
      </div>

      <p className="mt-3 text-xs text-ink-600" data-testid="view-count" data-count={data.experts.length}>
        {t("views.count", { count: data.experts.length })}
      </p>

      {data.experts.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={view === "internal" ? t("emptyInternal") : t("emptyExternal")}
          hint={t("emptyHint")}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {anyFilter ? (
                <Link href={`/experts?view=${view}` as never} className={LINK_SECONDARY}>
                  {t("clearFilters")}
                </Link>
              ) : null}
              {view === "external" && canAdd ? (
                <Link href="/experts/new" className={LINK_PRIMARY}>
                  <UserRoundPlus /> {t("addExternal")}
                </Link>
              ) : null}
            </div>
          }
          className="mt-8"
        />
      ) : view === "internal" ? (
        <InternalBoard groups={data.groups} experts={data.experts} layout={layout} initialOpen={initialOpen} />
      ) : (
        <Stagger
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          step={0.03}
        >
          {data.experts.map((e) => (
            <ExpertCard key={e.id} expert={e} />
          ))}
        </Stagger>
      )}
    </Reveal>
  );
}
