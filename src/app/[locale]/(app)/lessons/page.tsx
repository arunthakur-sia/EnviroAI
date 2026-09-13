// CR04 3: the Learning Room. A page people open to learn: Lesson of the
// week, AI themes, category lanes by the worth-reading score, browse tools,
// the full feed, and the guided Learn mode. All reading happens inline.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getLearningRoomData } from "@/server/services/lessons";
import { Reveal } from "@/components/motion";
import { LearningRoom } from "./LearningRoom";

export const dynamic = "force-dynamic";

export default async function LessonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const data = await getLearningRoomData(user);
  const canAdd = can(user, "create", "lessons");

  return (
    <Reveal>
      <LearningRoom data={data} canAdd={canAdd} />
    </Reveal>
  );
}
