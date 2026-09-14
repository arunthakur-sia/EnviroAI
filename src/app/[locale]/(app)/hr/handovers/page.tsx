import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getHrHandovers } from "@/server/services/hr";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { Avatar, Chip } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "ok" | "sand" | "gulf" | "danger"> = {
  complete: "ok",
  open: "sand",
  in_progress: "gulf",
  overdue: "danger",
};

export default async function HrHandoversPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const data = await getHrHandovers(user);
  if (!data) notFound();
  const t = await getTranslations("hr");

  const groups: [string, typeof data.handovers][] = (
    ["overdue", "open", "in_progress", "complete"] as const
  ).map((s) => [s, data.handovers.filter((h) => h.status === s)]);

  return (
    <Reveal>
      <div className="flex flex-col gap-6" data-testid="hr-handovers">
        {groups.map(([status, rows]) =>
          rows.length ? (
            <section key={status}>
              <p className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
                {t(`handoverStatus.${status}` as never)}
                <span className="tnum font-medium">{rows.length}</span>
              </p>
              <div className="card divide-y divide-sand-100">
                {rows.map((h) => (
                  <Link
                    key={h.id}
                    href={`/hr/handovers/${h.id}` as never}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-maroon-50/50"
                    data-testid="handover-row"
                  >
                    {h.person ? <Avatar name={h.person.nameEn} color={h.person.avatarColor} size={34} /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink-900">
                          {h.person ? bi(locale, h.person.nameEn, h.person.nameAr) : "-"}
                        </span>
                        <Chip tone="sand">{t(`handoverKinds.${h.kind}` as never)}</Chip>
                      </span>
                      <span className="block text-xs text-ink-600">
                        {h.successor
                          ? t("successorLine", { name: bi(locale, h.successor.nameEn, h.successor.nameAr) })
                          : t("noSuccessor")}
                        {" · "}
                        <span className="tnum">{t("itemsCount", { count: h.items })}</span>
                      </span>
                    </span>
                    {h.dueDate ? (
                      <span className="hidden text-xs text-ink-600 tnum sm:block">{t("due", { date: h.dueDate })}</span>
                    ) : null}
                    <span className="w-32 shrink-0">
                      <span className="mb-1 flex items-center justify-between text-[11px] text-ink-600 tnum">
                        <Chip tone={STATUS_TONE[h.status] ?? "sand"}>{t(`handoverStatus.${h.status}` as never)}</Chip>
                        {h.completionPct}%
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-sand-200">
                        <span
                          className="block h-full rounded-full bg-maroon-700"
                          style={{ width: `${h.completionPct}%` }}
                        />
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        )}
        {!data.handovers.length ? (
          <p className="card px-4 py-8 text-center text-sm text-ink-600">{t("noHandovers")}</p>
        ) : null}
      </div>
    </Reveal>
  );
}
