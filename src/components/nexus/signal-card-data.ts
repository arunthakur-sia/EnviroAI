// Server-safe types and mapper for SignalCard (no "use client": server pages
// call toSignalCardData when composing props for the client component).

export type SignalLinkChip = {
  resourceType: string;
  resourceId: string;
  titleEn: string;
  titleAr: string;
  code: string | null;
};

export type SignalCardData = {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  whyItMattersEn: string | null;
  whyItMattersAr: string | null;
  publisher: string | null;
  url: string | null;
  publishedAt: string | null;
  signalType: string;
  sentiment: string;
  impact: string;
  horizon: string;
  confidence: number | null;
  triageStatus: string;
  sourceKind: string;
  convertedResourceType: string | null;
  convertedResourceId: string | null;
  links: SignalLinkChip[];
};

export function toSignalCardData(s: SignalCardData): SignalCardData {
  return {
    id: s.id,
    titleEn: s.titleEn,
    titleAr: s.titleAr,
    descriptionEn: s.descriptionEn,
    descriptionAr: s.descriptionAr,
    whyItMattersEn: s.whyItMattersEn,
    whyItMattersAr: s.whyItMattersAr,
    publisher: s.publisher,
    url: s.url,
    publishedAt: s.publishedAt,
    signalType: s.signalType,
    sentiment: s.sentiment,
    impact: s.impact,
    horizon: s.horizon,
    confidence: s.confidence,
    triageStatus: s.triageStatus,
    sourceKind: s.sourceKind,
    convertedResourceType: s.convertedResourceType,
    convertedResourceId: s.convertedResourceId,
    links: s.links,
  };
}
