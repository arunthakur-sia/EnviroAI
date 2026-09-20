// CR08 6: the administrator's handover detail.
import { notFound, redirect } from "next/navigation";
import { isNull } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { getHandoverForViewer } from "@/server/services/handover";
import { Reveal } from "@/components/motion";
import { HandoverAdminClient } from "./HandoverAdminClient";

export const dynamic = "force-dynamic";

export default async function HandoverAdminPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const detail = await getHandoverForViewer(user, id);
  if (!detail) notFound();
  if (detail.viewer === "person") redirect(`/${locale}/handover/mine`);
  if (detail.viewer === "recipient") redirect(`/${locale}/handover/${id}`);
  const users = await db
    .select({ id: schema.users.id, nameEn: schema.users.nameEn, nameAr: schema.users.nameAr, departmentId: schema.users.departmentId })
    .from(schema.users)
    .where(isNull(schema.users.deletedAt))
    .orderBy(schema.users.nameEn);
  return (
    <Reveal>
      <HandoverAdminClient initial={detail} users={users.filter((u) => u.id !== detail.person.userId)} />
    </Reveal>
  );
}
