// CR08 5.3: the contents page. The template builds the list from the
// document model (a TOC field plus a rendered static list), so the section
// carries nothing but its title.
import { bi, type SectionDefinition } from "../spec";
import { section } from "./_shared";

const def: SectionDefinition<null> = {
  code: "contents",
  name: bi("Contents", "المحتويات"),
  description: bi(
    "The designed contents page with section numbers and dotted leaders.",
    "صفحة المحتويات المصممة بأرقام الأقسام والنقاط الموجهة."
  ),
  layout: "contents",
  estimatedPages: 1,
  appliesTo: "all",
  async load() {
    return null;
  },
  async write() {
    return section("contents", bi("Contents", "المحتويات"), "contents", { blocks: [] });
  },
};

export default def;
