// CR08 2.2: Studies. Documents of type study, research and evaluation from
// Institutional Memory in a designed listing: the latest verified study as
// the featured hero, filter chips by type, topic, outcome and year, and a
// shelf per year. "Add study" opens the upload flow with the type pre-set.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getStudiesPage } from "@/server/services/studies";
import { Reveal } from "@/components/motion";
import { StudiesView } from "./StudiesView";

export const dynamic = "force-dynamic";

export default async function StudiesPage({
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
  await getTranslations("studies");

  const data = await getStudiesPage(user, {
    type: sp.type,
    topic: sp.topic,
    outcome: sp.outcome,
    year: sp.year ? Number(sp.year) : undefined,
    q: sp.q,
  });

  return (
    <Reveal>
      <StudiesView
        data={data}
        canAdd={can(user, "create", "vault")}
        active={{ type: sp.type ?? null, topic: sp.topic ?? null, outcome: sp.outcome ?? null, year: sp.year ?? null }}
      />
    </Reveal>
  );
}
