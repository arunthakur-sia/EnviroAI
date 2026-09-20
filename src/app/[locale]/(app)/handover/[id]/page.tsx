// CR08 6.3: the recipient's persistent Handover page with the learning path.
// Administrators land on the HR detail; the person on My Handover.
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getHandoverForViewer, getLearningPath } from "@/server/services/handover";
import { Reveal } from "@/components/motion";
import { RecipientPathClient } from "./RecipientPathClient";

export const dynamic = "force-dynamic";

export default async function RecipientHandoverPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const detail = await getHandoverForViewer(user, id);
  if (!detail) notFound();
  if (detail.viewer === "person") redirect(`/${locale}/handover/mine`);
  if (detail.viewer === "admin") redirect(`/${locale}/hr/handovers/${id}`);
  const path = await getLearningPath(user, id);
  return (
    <Reveal>
      <RecipientPathClient detail={detail} initialPath={path} />
    </Reveal>
  );
}
