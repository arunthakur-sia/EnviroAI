import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";
import { SiaLogo } from "@/components/nexus/Logo";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("login");

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-sand-100 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--color-maroon-700) 0 2px, transparent 2px 18px), repeating-linear-gradient(-45deg, var(--color-gulf-600) 0 2px, transparent 2px 26px)",
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <SiaLogo variant="full" height={30} />
        </div>
        <div className="relative">
          <h1 className="max-w-md text-4xl leading-[1.15] text-maroon-900">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-md text-ink-600">{t("heroSubtitle")}</p>
        </div>
        <div className="relative flex items-center justify-between gap-4">
          <p className="text-xs text-ink-400">{t("footer")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/NPC_logo_transparent.png"
            alt={locale === "ar" ? "المجلس الوطني للتخطيط" : "National Planning Council"}
            className="h-10 w-auto select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Form panel (CR05 1.4: a white card on the bright neutral ground) */}
      <div className="flex flex-1 items-center justify-center bg-sand-50 px-6">
        <div className="card w-full max-w-md px-8 py-10">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <SiaLogo variant="full" height={42} />
            <p className="mt-1.5 text-sm text-ink-600">{t("descriptor")}</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
