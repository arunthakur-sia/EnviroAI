// CR05 4.4: the International Indices board. CR08 4.2: grouped, with the
// group switcher deep-linkable through ?group=<code>.
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
  searchParams: Promise<{ view?: string; group?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("indices");
  const data = await getIndicesBoard(user);
  const canManage = can(user, "manage", "settings");

  return (
    <Reveal>
      <div className="mb-5">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">{t("subtitle")}</p>
      </div>
      <IndicesBoard
        data={data}
        canRefresh={canManage}
        canManage={canManage}
        initialView={sp.view === "table" ? "table" : "cards"}
        initialGroup={sp.group ?? null}
      />
    </Reveal>
  );
}
