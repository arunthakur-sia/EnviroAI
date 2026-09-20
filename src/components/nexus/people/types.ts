// CR08 9.1: the shapes OwnerControl and the person card exchange. Type-only
// imports from the services keep the client bundle free of server code.
import type { PersonCard } from "@/server/services/people";

export type OwnerRef = {
  id: string;
  nameEn: string;
  nameAr: string;
  avatarColor: string;
  positionEn?: string | null;
  positionAr?: string | null;
  unitEn?: string | null;
  unitAr?: string | null;
};

export type OwnerRole =
  | "owner"
  | "department_owner"
  | "project_owner"
  | "unit_head"
  | "author"
  | "custodian";

/** The item the owner is shown for; `href` is the locale-less app path. */
export type ItemRef = {
  type: string;
  id: string;
  titleEn: string;
  titleAr: string;
  href: string;
};

export type PersonCardData = PersonCard;

export type PickedPerson = {
  id: string;
  nameEn: string;
  nameAr: string;
  avatarColor: string;
  positionEn?: string | null;
  positionAr?: string | null;
  unitEn?: string | null;
  unitAr?: string | null;
};

export type PickedDocument = { id: string; titleEn: string; titleAr: string };

/** The absolute deep link of an item for the current locale. */
export function absoluteItemLink(locale: string, href: string): string {
  const path = href.startsWith("/") ? href : `/${href}`;
  if (typeof window === "undefined") return `/${locale}${path}`;
  return `${window.location.origin}/${locale}${path}`;
}
