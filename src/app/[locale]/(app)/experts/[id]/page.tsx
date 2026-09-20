import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { BadgeCheck, Building2, ChevronRight, FolderKanban, GraduationCap, Handshake, Medal } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getExpertProfile } from "@/server/services/experts";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { EmptyState, Avatar, Chip, SectionTitle } from "@/components/ui/primitives";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { AskContextItem } from "@/components/nexus/ask/AskContextItem";
import { ExpertActions } from "./ExpertActions";

export const dynamic = "force-dynamic";

const AVAILABILITY_DOT: Record<string, string> = {
  available: "bg-ok",
  limited: "bg-warn",
  unavailable: "bg-danger",
};

export default async function ExpertProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("experts");
  const tc = await getTranslations("common");
  const ts = await getTranslations("strategy.stakeholders");

  const profile = await getExpertProfile(user, id);
  if (!profile) return <EmptyState title={tc("notFound")} className="mt-12" />;
  const { expert, card, domains, endorsementCounts, skills, engagements, publications, contributions, badges } = profile;
  const internal = card.kind === "internal";
  const name = bi(locale, expert.nameEn, expert.nameAr);

  // CR05 3.2: project involvement from node_stakeholders
  const stakeRows = await db
    .select({
      id: schema.nodeStakeholders.id,
      nodeId: schema.nodeStakeholders.nodeId,
      role: schema.nodeStakeholders.role,
      noteEn: schema.nodeStakeholders.roleNoteEn,
      noteAr: schema.nodeStakeholders.roleNoteAr,
      code: schema.strategyNodes.code,
      titleEn: schema.strategyNodes.titleEn,
      titleAr: schema.strategyNodes.titleAr,
    })
    .from(schema.nodeStakeholders)
    .innerJoin(
      schema.strategyNodes,
      eq(schema.strategyNodes.id, schema.nodeStakeholders.nodeId)
    )
    .where(eq(schema.nodeStakeholders.expertId, id));
  const projectRoles = stakeRows.slice(0, 12);

  let education: { degree: string; institution: string; year: number | null }[] = [];
  let languages: string[] = [];
  try {
    education = JSON.parse(expert.educationJson ?? "[]");
  } catch { /* skip */ }
  try {
    languages = JSON.parse(expert.languagesJson ?? "[]");
  } catch { /* skip */ }

  const levelWidth: Record<string, string> = {
    aware: "w-1/4",
    practitioner: "w-2/4",
    expert: "w-3/4",
    authority: "w-full",
  };
  const countryName =
    card.country && t.has(`countries.${card.country}` as never)
      ? t(`countries.${card.country}` as never)
      : card.country;

  return (
    <Reveal>
      <AskContextItem
        item={{ kind: "expert", id, titleEn: expert.nameEn, titleAr: expert.nameAr, href: `/experts/${id}` }}
      />
      {/* Header */}
      <div
        className="card relative mb-6 flex flex-wrap items-start gap-5 overflow-hidden p-6 ps-7"
        data-testid="expert-header"
        data-kind={card.kind}
      >
        <span aria-hidden className={cn("absolute inset-y-0 start-0 w-1.5", internal ? "bg-maroon-700" : "bg-gulf-600")} />
        <Avatar name={expert.nameEn} color={expert.avatarColor} size={76} />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
            {t(`kind.${card.kind}`)}
          </p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl">
            {name}
            {expert.isVerified ? (
              <BadgeCheck className="size-5 text-gulf-600" role="img" aria-label={t("verified")} />
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {bi(locale, expert.positionEn ?? "", expert.positionAr ?? "")}
            {expert.organisationEn ? (
              <> · {bi(locale, expert.organisationEn ?? "", expert.organisationAr ?? "")}</>
            ) : null}
          </p>
          {internal && card.unitPath.length ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-ink-600" data-testid="profile-unit">
              <Building2 className="size-3.5 text-ink-400" aria-hidden />
              {card.unitPath.map((u, i) => (
                <span key={u.id} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="size-3 text-ink-400 flip-rtl" aria-hidden /> : null}
                  <Link href={`/organisation?unit=${u.code}` as never} className="hover:text-maroon-700">
                    {bi(locale, u.nameEn, u.nameAr)}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            {!internal ? <Chip tone="gulf">{t(`types.${expert.type}` as never)}</Chip> : null}
            <span className="flex items-center gap-1.5 text-ink-600">
              <span className={cn("h-2 w-2 rounded-full", AVAILABILITY_DOT[expert.availability])} aria-hidden />
              {t(`availability.${expert.availability}` as never)}
            </span>
            {countryName ? <span className="text-ink-600">{countryName}</span> : null}
            {expert.yearsExperience ? (
              <span className="text-ink-600 tnum">
                {t("yearsExperience", { count: expert.yearsExperience })}
              </span>
            ) : null}
            {languages.length ? <span className="text-ink-600">{languages.join(" · ")}</span> : null}
            {expert.contactProtocol ? (
              <Chip tone="gold">{expert.contactProtocol}</Chip>
            ) : null}
            {internal ? (
              <span className="flex items-center gap-1 text-ink-600 tnum" data-testid="profile-projects">
                <FolderKanban className="size-3.5 text-maroon-700" aria-hidden />
                {t("projectsCount", { count: card.projectCount })}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-ink-600 tnum" data-testid="profile-engagements">
                <Handshake className="size-3.5 text-gulf-600" aria-hidden />
                {t("engagementsCount", { count: card.engagementCount })}
                {card.lastEngagementYear ? ` · ${t("lastEngagement", { year: String(card.lastEngagementYear) })}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <ExpertActions expertId={id} expertName={name} />
          <BriefDialog resourceType="expert" resourceId={id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          {(expert.bioEn || expert.bioAr) ? (
            <section>
              <SectionTitle>{t("bio")}</SectionTitle>
              <p className="max-w-2xl text-sm leading-relaxed text-ink-900">
                {bi(locale, expert.bioEn ?? "", expert.bioAr ?? "")}
              </p>
            </section>
          ) : null}

          {/* Engagements: a grid with table roles (no HTML table, CR08 design rule) */}
          {engagements.length ? (
            <section data-testid="expert-engagements">
              <SectionTitle>{t("engagements")}</SectionTitle>
              <div className="card overflow-x-auto">
                <div role="table" className="min-w-[640px] text-sm">
                  <div role="row" className="grid grid-cols-[64px_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_80px] bg-sand-50">
                    {["engYear", "engTitle", "engRole", "engOutcome", "engRating"].map((k) => (
                      <div key={k} role="columnheader" className="px-4 py-2 text-start text-xs font-semibold text-ink-600">
                        {t(k as never)}
                      </div>
                    ))}
                  </div>
                  {engagements.map((e) => (
                    <div
                      key={e.id}
                      role="row"
                      className="grid grid-cols-[64px_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_80px] border-t border-sand-100"
                    >
                      <div role="cell" className="px-4 py-2.5 text-ink-600 tnum">{e.year ?? "-"}</div>
                      <div role="cell" className="px-4 py-2.5 font-medium text-ink-900">{e.title}</div>
                      <div role="cell" className="px-4 py-2.5 text-ink-600">{e.role ?? "-"}</div>
                      <div role="cell" className="px-4 py-2.5 text-xs text-ink-600">
                        {bi(locale, e.outcomeEn ?? "", e.outcomeAr ?? "")}
                      </div>
                      <div role="cell" className="px-4 py-2.5 text-gold-500 tnum" aria-label={e.rating ? `${e.rating}/5` : undefined}>
                        {e.rating ? "★".repeat(e.rating) : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* CR05 3.2: the projects this expert is a stakeholder on */}
          {projectRoles.length ? (
            <section data-testid="expert-projects">
              <SectionTitle>{t("projects")}</SectionTitle>
              <div className="card divide-y divide-sand-100">
                {projectRoles.map((r) => (
                  <Link
                    key={r.id}
                    href={`/strategy/${r.nodeId}` as never}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-maroon-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {r.code ? <span className="me-1.5 text-xs text-ink-600 tnum">{r.code}</span> : null}
                        {bi(locale, r.titleEn, r.titleAr)}
                      </span>
                      {r.noteEn || r.noteAr ? (
                        <span className="block truncate text-xs text-ink-600">
                          {bi(locale, r.noteEn ?? "", r.noteAr ?? "")}
                        </span>
                      ) : null}
                    </span>
                    <Chip tone="gulf">{ts(`roles.${r.role}` as never)}</Chip>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Education */}
          {education.length ? (
            <section>
              <SectionTitle>{t("education")}</SectionTitle>
              <ul className="space-y-2">
                {education.map((e, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-ink-900">
                    <GraduationCap className="size-4 shrink-0 text-ink-400" aria-hidden />
                    {e.degree}, {e.institution}
                    {e.year ? <span className="text-xs text-ink-600 tnum">({e.year})</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Publications */}
          {publications.length ? (
            <section>
              <SectionTitle>{t("publications")}</SectionTitle>
              <ul className="space-y-1.5 text-sm text-ink-900">
                {publications.map((p) => (
                  <li key={p.id}>
                    {p.title} {p.year ? <span className="text-xs text-ink-600 tnum">({p.year})</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {/* Domains with level bars */}
          {domains.filter((d) => d.accepted === 1).length ? (
            <div>
              <SectionTitle>{t("domains")}</SectionTitle>
              <div className="card space-y-3 p-4">
                {domains
                  .filter((d) => d.accepted === 1)
                  .map((d) => {
                    const endorsed = endorsementCounts.find((e) => e.termId)?.c ?? 0;
                    return (
                      <div key={d.id}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                          <span className="text-ink-900">{bi(locale, d.nameEn, d.nameAr)}</span>
                          <span className="text-[11px] text-ink-600">
                            {t(`levels.${d.level}` as never)}
                            {endorsed ? ` · ${t("endorsements", { count: endorsed })}` : ""}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-sand-100">
                          <div
                            className={cn(
                              "h-full rounded-full bg-gradient-to-r from-maroon-500 to-maroon-700",
                              levelWidth[d.level] ?? "w-2/4"
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}

          {/* Skills */}
          {skills.length ? (
            <div>
              <SectionTitle>{t("skills")}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <Chip key={s.id} tone="gulf">
                    {s.skill}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {/* Contributions (employees) */}
          {contributions ? (
            <div>
              <SectionTitle>{t("contributions")}</SectionTitle>
              <div className="card grid grid-cols-3 divide-x divide-sand-100 rtl:divide-x-reverse text-center">
                {(
                  [
                    ["documents", contributions.documents],
                    ["answers", contributions.answers],
                    ["lessons", contributions.lessons],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="px-2 py-3">
                    <p className="font-display text-xl font-semibold text-maroon-900 tnum">
                      {v}
                    </p>
                    <p className="text-[11px] text-ink-600">{t(`contrib.${k}` as never)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Badges (employees) */}
          {badges.length ? (
            <div>
              <SectionTitle>{t("badges")}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <Chip key={b.code} tone="gold">
                    <Medal className="size-3" aria-hidden /> {bi(locale, b.nameEn, b.nameAr)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </Reveal>
  );
}
