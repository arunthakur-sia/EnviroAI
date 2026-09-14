// CR05 6.3: the invitation acceptance page (first login).
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { SiaLogo } from "@/components/nexus/Logo";
import { EmptyState } from "@/components/ui/primitives";
import { nowIso } from "@/lib/ids";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const [invite] = await db
    .select()
    .from(schema.invitations)
    .where(eq(schema.invitations.token, token))
    .limit(1);
  const valid = invite && invite.status === "pending" && invite.expiresAt >= nowIso();

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-6">
      <div className="card w-full max-w-md px-8 py-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <SiaLogo variant="full" height={36} />
          <h1 className="text-xl">{t("title")}</h1>
        </div>
        {valid ? (
          <>
            <p className="mb-5 text-center text-sm text-ink-600">
              {t("hello", { name: invite.nameEn ?? invite.email })}
              <span className="mt-0.5 block text-xs text-ink-400" dir="ltr">
                {invite.email}
              </span>
            </p>
            <AcceptInviteForm token={token} />
          </>
        ) : (
          <EmptyState title={t("invalid")} hint={t("invalidHint")} />
        )}
      </div>
    </div>
  );
}
