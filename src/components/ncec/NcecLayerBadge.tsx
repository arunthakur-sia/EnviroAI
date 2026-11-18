"use client";
// The NCEC layer badge shown in the header (brief s8.2/8.3): teal for L2,
// amber for L3, distinct from every other chip tone in the app.
import { useTranslations } from "next-intl";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function NcecLayerBadge({ layer }: { layer: 2 | 3 }) {
  const t = useTranslations("ksaNcec");
  const Icon = layer === 3 ? ShieldAlert : ShieldCheck;
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold md:inline-flex",
        layer === 3 ? "border-amber-300 bg-amber-100 text-amber-700" : "border-teal-400 bg-teal-100 text-teal-700"
      )}
      data-testid={`ncec-badge-l${layer}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {t(`shell.badge.l${layer}` as never)}
    </span>
  );
}
