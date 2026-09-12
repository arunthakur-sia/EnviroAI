"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BadgeCheck } from "lucide-react";
import { bi } from "@/lib/utils";
import { Avatar, ClassificationChip } from "@/components/ui/primitives";
import type { ShelfDoc } from "@/components/nexus/Shelf";

export function DocListRow({ doc }: { doc: ShelfDoc }) {
  const locale = useLocale();
  const t = useTranslations("common");
  return (
    <Link
      href={`/vault/${doc.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-maroon-50"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-medium text-ink-900">
          {bi(locale, doc.titleEn, doc.titleAr)}
          {doc.status === "verified" ? (
            <BadgeCheck className="size-4 shrink-0 text-gulf-600" aria-label={t("verified")} />
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-600">
          {bi(locale, doc.typeNameEn ?? "", doc.typeNameAr ?? "")}
          {doc.publishYear ? <span className="tnum"> · {doc.publishYear}</span> : null}
        </p>
      </div>
      {doc.ownerName ? (
        <span className="hidden items-center gap-2 sm:flex">
          <Avatar name={doc.ownerName} color={doc.ownerColor ?? "maroon"} size={22} />
        </span>
      ) : null}
      <ClassificationChip
        level={doc.classification}
        labels={[
          t("classification.1"),
          t("classification.2"),
          t("classification.3"),
          t("classification.4"),
        ]}
      />
    </Link>
  );
}
