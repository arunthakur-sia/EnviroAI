"use client";
// CR08 8: the small gold ribbon on this week's pick wherever the item shows
// (Institutional Memory list rows and cards, the Learning Room, search
// results). Pass `active` when the server already knows; otherwise the chip
// looks itself up in the one-per-page cached id set and renders nothing
// until it is sure.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchKowIds } from "./client";

export function KowRibbon({
  resourceType,
  resourceId,
  active,
  className,
}: {
  resourceType: string;
  resourceId: string;
  active?: boolean;
  className?: string;
}) {
  const t = useTranslations("kow");
  const [on, setOn] = React.useState<boolean>(Boolean(active));

  React.useEffect(() => {
    if (active !== undefined) {
      setOn(active);
      return;
    }
    let cancelled = false;
    fetchKowIds().then((ids) => {
      if (!cancelled) setOn(ids.has(`${resourceType}:${resourceId}`));
    });
    return () => {
      cancelled = true;
    };
  }, [active, resourceType, resourceId]);

  if (!on) return null;
  return (
    <span
      data-testid="kow-ribbon"
      title={t("ribbonAria")}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-gold-300 bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-maroon-900 rtl:tracking-normal",
        className
      )}
    >
      <Star className="size-2.5 text-gold-500" fill="currentColor" aria-hidden />
      {t("ribbon")}
    </span>
  );
}
