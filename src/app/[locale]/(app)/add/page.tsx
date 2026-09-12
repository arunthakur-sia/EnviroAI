import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { termsByDimension } from "@/server/services/taxonomy";
import { Reveal } from "@/components/motion";
import { AddKnowledgeClient } from "./AddKnowledgeClient";

export const dynamic = "force-dynamic";

export default async function AddKnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ node?: string; category?: string; mode?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("addKnowledge");
  const terms = await termsByDimension();

  // CR02 3.2: "Add lesson" from an initiative or project pre-fills the node
  let nodeContext: { id: string; code: string | null; titleEn: string; titleAr: string } | null =
    null;
  if (sp.node) {
    const [node] = await db
      .select()
      .from(schema.strategyNodes)
      .where(eq(schema.strategyNodes.id, sp.node))
      .limit(1);
    if (node) {
      nodeContext = { id: node.id, code: node.code, titleEn: node.titleEn, titleAr: node.titleAr };
    }
  }

  return (
    <Reveal>
      <div className="mb-6">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">{t("subtitle")}</p>
      </div>
      <AddKnowledgeClient
        topics={(terms.topic ?? []).map((topic) => ({
          code: topic.code,
          nameEn: topic.nameEn,
          nameAr: topic.nameAr,
        }))}
        nodeContext={nodeContext}
        categoryHint={sp.category ?? null}
        initialMode={sp.mode === "speak" ? "speak" : sp.mode === "upload" ? "upload" : "write"}
        whisperAvailable={Boolean(process.env.OPENAI_API_KEY)}
      />
    </Reveal>
  );
}
