"use client";
// CR03 1.4: the list view of Institutional Memory. CR08 9.1: the owner is a
// person chip, so the row can no longer be one <Link> around everything: the
// link stretches over the row from the title (::after) and the chip sits
// beside it, above that overlay.
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BadgeCheck } from "lucide-react";
import { bi } from "@/lib/utils";
import { Avatar, ClassificationChip } from "@/components/ui/primitives";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import type { ShelfDoc } from "@/components/nexus/Shelf";

export function DocListRow({ doc }: { doc: ShelfDoc }) {
  const locale = useLocale();
  const t = useTranslations("common");
  return (
    <div
      className="relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-maroon-50"
      data-testid="doc-list-row"
      data-doc-id={doc.id}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={`/vault/${doc.id}`}
          className="block rounded-md after:absolute after:inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500"
        >
          <p className="flex items-center gap-2 truncate font-medium text-ink-900">
            {bi(locale, doc.titleEn, doc.titleAr)}
            {doc.status === "verified" ? (
              <BadgeCheck className="size-4 shrink-0 text-gulf-600" aria-label={t("verified")} />
            ) : null}
          </p>
        </Link>
        <p className="mt-0.5 truncate text-xs text-ink-600">
          {bi(locale, doc.typeNameEn ?? "", doc.typeNameAr ?? "")}
          {doc.publishYear ? <span className="tnum"> · {doc.publishYear}</span> : null}
        </p>
      </div>
      {/* CR08 9.1: the owner, with the person card on hover or tap */}
      {doc.ownerUserId && doc.ownerName ? (
        <OwnerControlCompact
          owner={{
            id: doc.ownerUserId,
            nameEn: doc.ownerName,
            nameAr: doc.ownerNameAr ?? doc.ownerName,
            avatarColor: doc.ownerColor ?? "maroon",
          }}
          item={{ type: "document", id: doc.id, titleEn: doc.titleEn, titleAr: doc.titleAr, href: `/vault/${doc.id}` }}
          size="sm"
          className="relative z-[1] hidden max-w-44 sm:inline-flex"
        />
      ) : doc.ownerName ? (
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
    </div>
  );
}
