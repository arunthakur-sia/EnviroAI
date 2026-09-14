// CR05 4.4: the International Indices board.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getIndicesBoard } from "@/server/services/indices";
import { Reveal } from "@/components/motion";
import { IndicesBoard } from "./IndicesBoard";

export const dynamic = "force-dynamic";

export default async function IndicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("indices");
  const data = await getIndicesBoard(user);

  return (
    <Reveal>
      <div className="mb-5">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">{t("subtitle")}</p>
      </div>
      <IndicesBoard
        data={data}
        canRefresh={can(user, "manage", "settings")}
        initialView={sp.view === "table" ? "table" : "cards"}
        initialCategory={sp.category ?? null}
      />
    </Reveal>
  );
}
