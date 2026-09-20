// CR08 5.3: the sources appendix. On its own it is empty; the builder calls
// aggregateSources() once every other section has been written, which
// merges and renumbers their SourceItem lists into this section's block.
import { bi, type SectionContent, type SectionDefinition, type SourceItem } from "../spec";
import { makeSources, section } from "./_shared";

const TITLE = bi("Sources", "المصادر");

export function aggregateSources(sections: SectionContent[]): SectionContent {
  const items = sections
    .filter((s) => s.code !== "sources_appendix")
    .flatMap((s) => s.sources ?? [])
    .map((s) => ({ title: s.title, detail: s.detail, url: s.url }));
  const merged: SourceItem[] = makeSources(items);
  const blocks: SectionContent["blocks"] = merged.length
    ? [
        {
          kind: "paragraph",
          style: "note",
          text: bi(
            "Every figure in this report is drawn from the sources below as held in SiaNexus on the generation date. Forecasts are SiaNexus estimates and are labelled as such where they appear.",
            "كل رقم في هذا التقرير مأخوذ من المصادر أدناه كما هي محفوظة في سيا نكسس بتاريخ الإعداد. التنبؤات تقديرات من سيا نكسس، وهي موسومة بذلك حيثما وردت."
          ),
        },
        { kind: "sources", items: merged },
      ]
    : [
        {
          kind: "paragraph",
          style: "note",
          text: bi("No sources were cited by the selected sections.", "لم تستشهد الأقسام المختارة بأي مصادر."),
        },
      ];
  return section("sources_appendix", TITLE, "sources", {
    blocks,
    sources: [],
    meta: { count: merged.length },
  });
}

const def: SectionDefinition<null> = {
  code: "sources_appendix",
  name: bi("Sources appendix", "ملحق المصادر"),
  description: bi(
    "Every source the other sections cite, merged and numbered once.",
    "كل مصدر استشهدت به الأقسام الأخرى، مدمجاً ومرقماً مرة واحدة."
  ),
  layout: "sources",
  estimatedPages: 1,
  appliesTo: "all",
  async load() {
    return null;
  },
  async write() {
    return aggregateSources([]);
  },
};

export default def;
