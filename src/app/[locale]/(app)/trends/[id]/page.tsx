import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getSignal, canTriage } from "@/server/services/signals";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { formatDate, relativeTime } from "@/lib/format";
import { Chip, Button } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { ExternalLink, MessageCircleQuestion, ArrowLeft } from "lucide-react";
import { SignalCard } from "@/components/nexus/SignalCard";
import { toSignalCardData } from "@/components/nexus/signal-card-data";
import { BriefDialog } from "@/components/nexus/BriefDialog";
import { SignalComments } from "./SignalComments";

export const dynamic = "force-dynamic";

export default async function SignalPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("trends");

  const signal = await getSignal(user, id);
  if (!signal) notFound();

  const [comments, history] = await Promise.all([
    db
      .select({
        id: schema.reviews.id,
        note: schema.reviews.note,
        createdAt: schema.reviews.createdAt,
        nameEn: schema.users.nameEn,
        nameAr: schema.users.nameAr,
        color: schema.users.avatarColor,
      })
      .from(schema.reviews)
      .innerJoin(schema.users, eq(schema.users.id, schema.reviews.reviewerId))
      .where(
        and(
          eq(schema.reviews.resourceType, "signal"),
          eq(schema.reviews.resourceId, id),
          eq(schema.reviews.decision, "comment")
        )
      )
      .orderBy(desc(schema.reviews.createdAt))
      .limit(30),
    db
      .select({
        action: schema.auditLog.action,
        metaJson: schema.auditLog.metaJson,
        createdAt: schema.auditLog.createdAt,
        nameEn: schema.users.nameEn,
        nameAr: schema.users.nameAr,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
      .where(
        and(
          eq(schema.auditLog.resourceType, "signal"),
          eq(schema.auditLog.resourceId, id)
        )
      )
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(20),
  ]);

  return (
    <Reveal>
      <div className="mb-4">
        <Link
          href="/trends"
          className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-navy-900"
        >
          <ArrowLeft className="size-4 flip-rtl" /> {t("backToStream")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <SignalCard signal={toSignalCardData(signal)} canTriage={canTriage(user)} />

          {signal.sourceExcerpt ? (
            <div className="card p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                {t("sourceExcerpt")}
              </p>
              <p className="text-sm leading-relaxed text-ink-600">
                {signal.sourceExcerpt.slice(0, 600)}
                {signal.url ? (
                  <a
                    href={signal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ms-2 inline-flex items-center gap-1 text-teal-600 hover:underline"
                  >
                    <ExternalLink className="size-3.5" /> {t("openSource")}
                  </a>
                ) : null}
              </p>
            </div>
          ) : null}

          <SignalComments signalId={id} comments={comments} />
        </div>

        <div className="flex flex-col gap-5">
          <div className="card flex flex-col gap-2.5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("actions")}
            </p>
            <Link href={`/ask/c/new?context=signal:${id}` as never}>
              <Button variant="secondary" className="w-full justify-start">
                <MessageCircleQuestion /> {t("askAboutSignal")}
              </Button>
            </Link>
            <BriefDialog resourceType="signal" resourceId={id} />
          </div>

          <div className="card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("history")}
            </p>
            <div className="flex flex-col gap-2.5">
              {history.length === 0 ? (
                <p className="text-sm text-ink-400">{t("noHistory")}</p>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="text-ink-900">
                      {t(`historyActions.${h.action}` as never)}
                    </span>
                    {h.nameEn ? (
                      <span className="text-xs text-ink-600">
                        {bi(locale, h.nameEn, h.nameAr ?? h.nameEn)}
                      </span>
                    ) : null}
                    <span className="ms-auto shrink-0 text-[11px] text-ink-400">
                      {relativeTime(h.createdAt, locale)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {t("details")}
            </p>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-600">{t("sourceKindLabel")}</dt>
                <dd className="text-ink-900">{t(`sourceKinds.${signal.sourceKind}` as never)}</dd>
              </div>
              {signal.publishedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-600">{t("publishedLabel")}</dt>
                  <dd className="tnum text-ink-900">{formatDate(signal.publishedAt, locale)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-600">{t("sentimentLabel")}</dt>
                <dd>
                  <Chip
                    tone={
                      signal.sentiment === "positive"
                        ? "ok"
                        : signal.sentiment === "negative"
                          ? "danger"
                          : "mist"
                    }
                  >
                    {t(`sentiment.${signal.sentiment}` as never)}
                  </Chip>
                </dd>
              </div>
              {signal.convertedResourceType ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-600">{t("convertedTo")}</dt>
                  <dd>
                    <Link
                      className="text-teal-600 hover:underline"
                      href={
                        (signal.convertedResourceType === "lesson"
                          ? `/lessons/${signal.convertedResourceId}`
                          : signal.convertedResourceType === "document"
                            ? `/vault/${signal.convertedResourceId}`
                            : "/trends") as never
                      }
                    >
                      {t(`convertTargets.${signal.convertedResourceType}` as never)}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
