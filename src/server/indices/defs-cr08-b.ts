// CR08 4.1: index definition of the second research agent: Environment and
// Climate (Climate Change Performance Index). Every value the fetcher stores
// for it comes from sources/indices/research/cr08-<code>.json, each
// observation carrying the URL it was read from. Nothing is invented; the
// gaps are recorded in sources/indices/research/cr08-coverage-b.md.
import type { Cr08IndexDef } from "./defs-cr08";

export const CR08_INDEX_DEFS_B: Cr08IndexDef[] = [
  {
    code: "ccpi",
    nameEn: "Climate Change Performance Index",
    nameAr: "مؤشر أداء تغير المناخ",
    publisher: "Germanwatch, NewClimate Institute and Climate Action Network",
    publisherUrl: "https://ccpi.org/",
    methodologyEn:
      "Fourteen indicators in four categories (greenhouse gas emissions 40 percent, renewable energy 20, energy use 20, climate policy 20) for 63 countries plus the EU that together emit about 90 percent of global greenhouse gases; score 0-100, published each year at the COP. The first three ranks are left empty because no country performs at the very-high level in every category.",
    methodologyAr:
      "أربعة عشر مؤشرًا في أربع فئات (انبعاثات غازات الدفيئة 40 بالمئة، والطاقة المتجددة 20، واستخدام الطاقة 20، وسياسات المناخ 20) لثلاث وستين دولة والاتحاد الأوروبي تمثل معًا نحو 90 بالمئة من الانبعاثات العالمية؛ الدرجة من 0 إلى 100 ويصدر سنويًا عند مؤتمر الأطراف. تُترك المراتب الثلاث الأولى شاغرة لأن أي دولة لا تبلغ المستوى المرتفع جدًا في كل الفئات.",
    scale: "both",
    scoreMin: 0,
    scoreMax: 100,
    higherIsBetter: true,
    frequency: "annual",
    category: "environment",
    responsibleEntityName: "Ministry of Environment, Water and Agriculture",
    linkedTargetKeywords: ["climate", "emissions", "renewable"],
    sourceNotes:
      "Official CCPI results PDFs 2023-2026 (partner-hosted copies of the Germanwatch results publications, cited per row). The research file carries the benchmark countries the publisher covers (Saudi Arabia, the UAE from the 2024 edition and the global peers); a country the CCPI does not assess stays absent. The CCPI 2022 results PDF was not reachable through the corporate proxy.",
    groups: ["environment", "climate"],
    forecastEnabled: false,
  },
];
