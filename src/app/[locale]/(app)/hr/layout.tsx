// CR05 5.6: the HR Knowledge portal. HR Admin and Super Admin see the whole
// organisation, Department Heads their department; for everyone else the
// portal does not exist (a friendly 404, never a 403; 6.1).
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth/session";
import { hrScopeFor } from "@/server/services/hr";
import { HrNav } from "./HrNav";

export default async function HrLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const { canSeePortal } = await import("@/server/auth/permissions");
  if (!canSeePortal(user, "hr")) notFound();
  const scope = hrScopeFor(user);
  if (!scope) notFound();
  const t = await getTranslations("hr");

  return (
    <div data-testid="hr-portal">
      <div className="mb-5">
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          {scope.all ? t("subtitleAll") : t("subtitleDept")}
        </p>
      </div>
      <HrNav />
      {children}
    </div>
  );
}
