import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { listQuestions } from "@/server/services/ask";
import { Reveal } from "@/components/motion";
import { bi } from "@/lib/utils";
import { Award } from "lucide-react";
import { EmptyState, Chip } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { QuestionRow } from "../QuestionRow";

export const dynamic = "force-dynamic";

export default async function OpenBoardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("askPage");

  const [openQuestions, bounties] = await Promise.all([
    listQuestions(user, { status: ["open", "routed", "ai_answered"], limit: 50 }),
    db.select().from(schema.bounties).where(eq(schema.bounties.status, "open")),
  ]);

  return (
    <Reveal>
      <h1 className="text-2xl">{t("openBoard")}</h1>
      <p className="mt-1 text-sm text-ink-600">{t("openBoardSubtitle")}</p>

      <Tabs defaultValue="questions" className="mt-6">
        <TabsList>
          <TabsTrigger value="questions">
            {t("openQuestions")} <span className="ms-1 text-xs text-ink-400 tnum">{openQuestions.length}</span>
          </TabsTrigger>
          <TabsTrigger value="bounties">
            {t("bounties")} <span className="ms-1 text-xs text-ink-400 tnum">{bounties.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="mt-4">
          {openQuestions.length ? (
            <div className="card divide-y divide-sand-100">
              {openQuestions.map((q) => (
                <QuestionRow key={q.id} q={q} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("noOpenQuestions")} hint={t("noOpenQuestionsHint")} />
          )}
        </TabsContent>
        <TabsContent value="bounties" className="mt-4">
          {bounties.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bounties
                .sort((a, b) => b.points - a.points)
                .map((b) => (
                  <div key={b.id} className="card flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <Award className="size-4 text-gold-500" />
                      <Chip tone="gold" className="tnum">{t("bountyPoints", { points: b.points })}</Chip>
                      <Chip tone={b.source === "gap_radar" ? "gulf" : "sand"}>
                        {t(`bountySource.${b.source}` as never)}
                      </Chip>
                    </div>
                    <p className="font-medium text-ink-900">{bi(locale, b.titleEn, b.titleAr)}</p>
                    <p className="line-clamp-3 text-sm leading-relaxed text-ink-600">
                      {bi(locale, b.descriptionEn ?? "", b.descriptionAr ?? "")}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState title={t("noBounties")} />
          )}
        </TabsContent>
      </Tabs>
    </Reveal>
  );
}
