// CR08 3: the small vocabularies the Expert Network shares between the server
// service and its client components (kept free of server imports).

/** The four external types; the stored codes predate the CR08 labels. */
export const EXTERNAL_TYPES = ["government", "academic", "consultant", "international"] as const;
export type ExternalType = (typeof EXTERNAL_TYPES)[number];

/** Domain levels, lowest first. */
export const LEVEL_ORDER = ["aware", "practitioner", "expert", "authority"] as const;

export const AVAILABILITY_VALUES = ["available", "limited", "unavailable"] as const;

/** The countries the form and the filter know a name for (ISO 3166-1 alpha-2). */
export const KNOWN_COUNTRIES = [
  "QA", "SA", "AE", "KW", "BH", "OM", "JO", "LB", "EG", "TN", "MA",
  "US", "GB", "FR", "DE", "NL", "CH", "PT", "IT", "ES", "SE",
  "CA", "AU", "IN", "KR", "JP", "SG", "TR", "CO", "GH", "NG", "KE", "SN",
] as const;
