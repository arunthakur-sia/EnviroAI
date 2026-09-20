// CR08 8: the Hall of Knowledge. Every Knowledge of the Week since the
// start: this week's pick featured at the top, then the archive as an
// editorial gallery grouped by month, each card with the item, the
// contributor, the note and the read count.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { getHallOfKnowledge } from "@/server/services/knowledge-of-week";
import { Reveal } from "@/components/motion";
import { HallView } from "./HallView";

export const dynamic = "force-dynamic";

export default async function HallOfKnowledgePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  await getTranslations("kow");
  const hall = await getHallOfKnowledge(user);
  return (
    <Reveal>
      <HallView hall={hall} numerals={user.numeralsPref} />
    </Reveal>
  );
}
