// CR07 2.6: the shape of the illustrative Council Strategy content. The content
// modules carry the words (bilingual, hand written); scripts/cr07-council-seed.ts
// generates the mechanical parts (period targets, actuals, milestone dates,
// budgets, stakeholders) deterministically from them.

export type Bi = { en: string; ar: string };

/* ---------- strategy header and direction ---------- */

export type CouncilValue = {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
};

export type StrategyMeta = {
  nameEn: string;
  nameAr: string;
  periodFrom: string; // YYYY-MM-DD
  periodTo: string;
  approvedOn: string;
  visionEn: string;
  visionAr: string;
  missionEn: string;
  missionAr: string;
  values: CouncilValue[]; // exactly 5
  /** org unit code that owns the strategy (the Strategy Office) */
  ownerUnitCode: string;
};

/* ---------- situation analysis ---------- */

export type SwotItem = {
  quadrant: "strength" | "weakness" | "opportunity" | "threat";
  textEn: string;
  textAr: string;
};

export type StakeholderItem = {
  nameEn: string;
  nameAr: string;
  /** 1 to 5 */
  interest: number;
  /** 1 to 5 */
  influence: number;
  roleEn: string;
  roleAr: string;
};

export type ChallengeItem = {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** goal code this challenge bears on, for example "G2" */
  goalCode: string;
};

export type BaselineItem = { textEn: string; textAr: string };

/* ---------- governance and risk ---------- */

export type GovernanceBody = {
  bodyNameEn: string;
  bodyNameAr: string;
  roleEn: string;
  roleAr: string;
  /** monthly | quarterly | biannual | annual | as_needed */
  cadence: string;
  /** org unit codes or role descriptions, bilingual pairs */
  members: Bi[];
};

export type RiskItem = {
  code: string; // R-01 .. R-20
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** 1 to 5 */
  likelihood: number;
  /** 1 to 5 */
  impact: number;
  mitigationEn: string;
  mitigationAr: string;
  /** open | mitigating | closed */
  status: string;
  /** node code the risk sits on, or null for strategy level */
  nodeCode: string | null;
};

/* ---------- the results chain ---------- */

export type AlignmentRef = {
  /** nds_node | nds_kpi | data_strategy_initiative */
  targetKind: string;
  /** for nds_node: the NDS3 outcome code such as "O7"; for the data strategy: a slug */
  targetCode: string;
  labelEn: string;
  labelAr: string;
  noteEn: string;
  noteAr: string;
};

export type GoalSeed = {
  code: string; // G1 .. G5
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  ownerUnitCode: string;
  alignment: AlignmentRef[];
};

export type IntermediateOutcomeSeed = {
  code: string; // G1.IO1 ..
  goalCode: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  ownerUnitCode: string;
};

export type OutputSeed = {
  code: string; // G1.IO1.OP1 ..
  intermediateCode: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  ownerUnitCode: string;
};

export type ActivitySeed = {
  titleEn: string;
  titleAr: string;
  /** not_started | on_track | at_risk | delayed | completed */
  status: string;
};

export type ProjectSeed = {
  code: string; // CP-01 .. CP-45
  outputCode: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  ownerUnitCode: string;
  /** not_started | on_track | at_risk | delayed | completed */
  status: string;
  /** 1 to 5, impact on the strategy */
  priorityImpact: number;
  /** 1 to 5, ease of delivery */
  priorityFeasibility: number;
  /** rough budget in QAR, 0 for a no-cost project */
  budgetQar: number;
  inputsEn: string;
  inputsAr: string;
  /** head count assigned */
  people: number;
  systemsEn: string[];
  systemsAr: string[];
  activities: ActivitySeed[]; // 2 to 4
};

/* ---------- indicators ---------- */

export type IndicatorSeed = {
  code: string; // CI-001 .. CI-080
  /** the council node code the indicator measures */
  nodeCode: string;
  nameEn: string;
  nameAr: string;
  definitionEn: string;
  definitionAr: string;
  formulaEn: string;
  formulaAr: string;
  /** percent | number | days | score | QAR million | ratio */
  unit: string;
  /** up_good | down_good */
  direction: string;
  /** monthly | quarterly | yearly */
  frequency: string;
  baselineValue: number;
  /** the 2030 target value */
  targetValue2030: number;
  dataSourceEn: string;
  dataSourceAr: string;
  meansOfVerificationEn: string;
  meansOfVerificationAr: string;
  notesEn: string;
  notesAr: string;
  /** how the seeded actuals should read against target */
  performance: "on_target" | "at_risk" | "behind";
};
