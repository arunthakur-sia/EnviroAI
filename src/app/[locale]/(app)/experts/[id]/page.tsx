import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BadgeCheck, GraduationCap, Medal } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getExpertProfile } from "@/server/services/experts";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  Avatar,
  Chip,
  SectionTitle,
} from "@/components/ui/primitives";
import { BriefDialog } from "@/components/nexus/BriefDialog";
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

  const profile = await getExpertProfile(user, id);
  if (!profile) return <EmptyState title={tc("notFound")} className="mt-12" />;
  const { expert, domains, endorsementCounts, skills, engagements, publications, contributions, badges } = profile;

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

  return (
    <Reveal>
      {/* Header */}
      <div className="card mb-6 flex flex-wrap items-start gap-5 p-6">
        <Avatar name={expert.nameEn} color={expert.avatarColor} size={76} />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl">
            {bi(locale, expert.nameEn, expert.nameAr)}
            {expert.isVerified ? <BadgeCheck className="size-5 text-gulf-600" /> : null}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {bi(locale, expert.positionEn ?? "", expert.positionAr ?? "")}
            {expert.organisationEn ? (
              <> · {bi(locale, expert.organisationEn ?? "", expert.organisationAr ?? "")}</>
            ) : null}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <Chip tone="sand">{t(`types.${expert.type}` as never)}</Chip>
            <span className="flex items-center gap-1.5 text-ink-600">
              <span className={cn("h-2 w-2 rounded-full", AVAILABILITY_DOT[expert.availability])} />
              {t(`availability.${expert.availability}` as never)}
            </span>
            {expert.yearsExperience ? (
              <span className="text-ink-400 tnum">
                {t("yearsExperience", { count: expert.yearsExperience })}
              </span>
            ) : null}
            {languages.length ? <span className="text-ink-400">{languages.join(" · ")}</span> : null}
            {expert.contactProtocol ? (
              <Chip tone="gold">{expert.contactProtocol}</Chip>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <ExpertActions expertId={id} domains={domains.filter((d) => d.accepted === 1).map((d) => ({ code: d.code, nameEn: d.nameEn, nameAr: d.nameAr }))} />
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

          {/* Engagements */}
          {engagements.length ? (
            <section>
              <SectionTitle>{t("engagements")}</SectionTitle>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sand-50 text-start">
                      <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("engYear")}</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("engTitle")}</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("engRole")}</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("engOutcome")}</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold text-ink-600">{t("engRating")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagements.map((e) => (
                      <tr key={e.id} className="border-t border-sand-100">
                        <td className="px-4 py-2.5 text-ink-400 tnum">{e.year ?? "—"}</td>
                        <td className="px-4 py-2.5 font-medium text-ink-900">{e.title}</td>
                        <td className="px-4 py-2.5 text-ink-600">{e.role ?? "—"}</td>
                        <td className="max-w-64 px-4 py-2.5 text-xs text-ink-600">
                          {bi(locale, e.outcomeEn ?? "", e.outcomeAr ?? "")}
                        </td>
                        <td className="px-4 py-2.5 text-gold-500 tnum">
                          {e.rating ? "★".repeat(e.rating) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    <GraduationCap className="size-4 shrink-0 text-ink-400" />
                    {e.degree}, {e.institution}
                    {e.year ? <span className="text-xs text-ink-400 tnum">({e.year})</span> : null}
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
                    {p.title} {p.year ? <span className="text-xs text-ink-400 tnum">({p.year})</span> : null}
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
                          <span className="text-[11px] text-ink-400">
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
                    <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-maroon-900 tnum">
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
                    <Medal className="size-3" /> {bi(locale, b.nameEn, b.nameAr)}
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
