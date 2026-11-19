// NCEC Environmental Data: placeholder until the environmental KPI mockup is
// approved. Gated by ncec/layout.tsx like every /ncec/* route.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Leaf } from "lucide-react";
import { Reveal } from "@/components/motion";
import { getNcecPrincipal } from "@/server/ncec/principal";

export const dynamic = "force-dynamic";

export default async function NcecEnvDataPage() {
  const principal = await getNcecPrincipal();
  if (!principal) notFound(); // defensive; ncec/layout.tsx already gates this
  const t = await getTranslations("ksaNcec");
  return (
    <Reveal>
      <div data-testid="ncec-envdata-page">
        <header className="mb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700">
              <Leaf className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl">{t("envData.title")}</h1>
              <p className="text-sm text-ink-600">{t("envData.subtitle")}</p>
            </div>
          </div>
        </header>
        <section className="card p-8 text-center">
          <h2 className="text-lg">{t("envData.placeholderTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">{t("envData.placeholderBody")}</p>
        </section>
      </div>
    </Reveal>
  );
}
