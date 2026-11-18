// The full core environmental catalogue: the datasets this caller can open,
// then, grouped apart, the ones restricted above their layer (brief s6,
// s8.2). Locked entries carry no field or record counts (catalogue.ts).
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Database, Lock } from "lucide-react";
import { Reveal } from "@/components/motion";
import { Link } from "@/i18n/navigation";
import { Chip } from "@/components/ui/primitives";
import { DummyDataBanner } from "@/components/ncec/DummyDataBanner";
import { DatasetCatalogue } from "@/components/ncec/DatasetCatalogue";
import { getNcecPrincipal } from "@/server/ncec/principal";
import { getCatalogue } from "@/server/ncec/catalogue";

export const dynamic = "force-dynamic";

export default async function NcecCataloguePage() {
  const principal = await getNcecPrincipal();
  if (!principal) notFound();
  const t = await getTranslations("ksaNcec");
  const catalogue = await getCatalogue(principal, "core_environmental");
  // datasets with dummy records first, so the ones with something to show lead each group
  const order = (a: (typeof catalogue)[number], b: (typeof catalogue)[number]) =>
    Number(b.hasDummyData) - Number(a.hasDummyData) || a.registerOrder - b.registerOrder;
  const open = catalogue.filter((d) => !d.locked).sort(order);
  const locked = catalogue.filter((d) => d.locked).sort(order);

  return (
    <Reveal>
      <div data-testid="ncec-catalogue-page">
        <Link href={"/ncec" as never} className="mb-3 inline-flex text-sm font-medium text-navy-700 hover:underline">
          {t("common.backToDashboard")}
        </Link>
        <header className="mb-4 flex items-center gap-2.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-700">
            <Database className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl">{t("catalogue.title")}</h1>
            <p className="text-sm text-ink-600">{t("catalogue.subtitle", { count: catalogue.length })}</p>
          </div>
        </header>
        <DummyDataBanner />

        <section className="card mb-5 p-4" aria-labelledby="ncec-cat-open">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="ncec-cat-open" className="text-lg">
              {t("catalogue.available")}
            </h2>
            <Chip tone="teal">{open.length}</Chip>
          </div>
          <DatasetCatalogue datasets={open} variant="list" />
        </section>

        {locked.length ? (
          <section className="card p-4" aria-labelledby="ncec-cat-locked">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 id="ncec-cat-locked" className="flex items-center gap-2 text-lg">
                <Lock className="size-4 text-ink-400" aria-hidden />
                {t("catalogue.restricted")}
              </h2>
              <Chip tone="mist">{locked.length}</Chip>
            </div>
            <p className="mb-3 max-w-2xl text-xs text-ink-600">{t("catalogue.restrictedNote")}</p>
            <DatasetCatalogue datasets={locked} variant="list" />
          </section>
        ) : null}
      </div>
    </Reveal>
  );
}
