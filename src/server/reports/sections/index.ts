// CR08 5.3: the section library. One definition per code of SECTION_ORDER;
// the builder iterates the request's codes in that canonical order.
import { SECTION_ORDER, type SectionCode, type SectionDefinition } from "../spec";
import cover from "./cover";
import contents from "./contents";
import foreword from "./foreword";
import yearAtAGlance from "./year_at_a_glance";
import mandateGovernance from "./mandate_governance";
import nds3OutcomesOverview from "./nds3_outcomes_overview";
import outcomeDeepDive from "./outcome_deep_dive";
import targetsScorecard from "./targets_scorecard";
import initiativesProgress from "./initiatives_progress";
import deliverablesReceived from "./deliverables_received";
import councilScorecard from "./council_scorecard";
import outputsBehind from "./outputs_behind";
import statisticsHighlights from "./statistics_highlights";
import internationalIndices from "./international_indices";
import indexForecasts from "./index_forecasts";
import signalsImplications from "./signals_implications";
import lessonsThemes from "./lessons_themes";
import knowledgeContinuity from "./knowledge_continuity";
import projectClosure from "./project_closure";
import eventsPartnerships from "./events_partnerships";
import outlook from "./outlook";
import sourcesAppendix from "./sources_appendix";
import closing from "./closing";

export { aggregateSources } from "./sources_appendix";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDefinition = SectionDefinition<any>;

export const SECTION_LIBRARY: Record<SectionCode, AnyDefinition> = {
  cover,
  contents,
  foreword,
  year_at_a_glance: yearAtAGlance,
  mandate_governance: mandateGovernance,
  nds3_outcomes_overview: nds3OutcomesOverview,
  outcome_deep_dive: outcomeDeepDive,
  targets_scorecard: targetsScorecard,
  initiatives_progress: initiativesProgress,
  deliverables_received: deliverablesReceived,
  council_scorecard: councilScorecard,
  outputs_behind: outputsBehind,
  statistics_highlights: statisticsHighlights,
  international_indices: internationalIndices,
  index_forecasts: indexForecasts,
  signals_implications: signalsImplications,
  lessons_themes: lessonsThemes,
  knowledge_continuity: knowledgeContinuity,
  project_closure: projectClosure,
  events_partnerships: eventsPartnerships,
  outlook,
  sources_appendix: sourcesAppendix,
  closing,
};

export function isSectionCode(code: string): code is SectionCode {
  return (SECTION_ORDER as readonly string[]).includes(code);
}

/** Filters unknown codes and returns the rest in canonical order. */
export function orderSections(codes: string[]): SectionCode[] {
  const wanted = new Set(codes);
  return SECTION_ORDER.filter((c) => wanted.has(c));
}

/** The library as the builder UI needs it: metadata only, no loaders. */
export function librarySummary() {
  return SECTION_ORDER.map((code) => {
    const d = SECTION_LIBRARY[code];
    return {
      code,
      name: d.name,
      description: d.description,
      layout: d.layout,
      estimatedPages: d.estimatedPages,
      appliesTo: d.appliesTo,
    };
  });
}
