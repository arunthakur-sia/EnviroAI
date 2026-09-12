// CR03 3: the serializable signal shape shared by the radar and the briefing.
export type BoardSignal = {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  whyEn: string | null;
  whyAr: string | null;
  publisher: string | null;
  publishedAt: string | null;
  createdAt: string;
  sourceKind: string;
  url: string | null;
  signalType: string;
  impact: string;
  horizon: string;
  sentiment: string;
  confidence: number | null;
  triageStatus: string;
  outcomes: { nodeId: string; code: string; taxCode: string | null; nameEn: string; nameAr: string }[];
};

export const IMPACT_SCORE: Record<string, number> = { high: 3, medium: 2, low: 1 };
