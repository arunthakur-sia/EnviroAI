/* eslint-disable no-console */
// CR08 5.5 sample: builds a rich ReportDocumentModel exercising every page type
// and every Block kind, renders it in English and Arabic to
// data/reports/samples/template-sample-{en,ar}.docx, then renders page images
// with docx-preview in Edge into data/reports/previews/samples/<name>/.
//   npx tsx scripts/dev-probes/cr08-template-sample.ts [--no-previews]
import fs from "node:fs";
import path from "node:path";
import { closePngRenderer, renderDocxPreviews, renderReportDocx } from "../../src/server/reports/template";
import { bi, type Block, type ChartSpec, type ReportDocumentModel, type SectionContent } from "../../src/server/reports/spec";

const years = ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];

const lineChart: ChartSpec = {
  type: "line",
  title: bi("Water use per capita index, Saudi Arabia and GCC average (illustrative)", "مؤشر استهلاك المياه للفرد، السعودية ومتوسط دول مجلس التعاون (توضيحي)"),
  unit: "%",
  series: [
    { name: bi("Saudi Arabia", "السعودية"), role: "primary", points: [1.2, -3.6, 1.6, 4.2, 1.4, 2.4, 2.9, null].map((y, i) => ({ x: years[i], y })) },
    { name: bi("GCC average", "متوسط دول مجلس التعاون"), role: "comparison", points: [0.9, -4.8, 3.1, 6.9, 0.6, 1.9, 3.2, null].map((y, i) => ({ x: years[i], y })) },
    { name: bi("NES target", "مستهدف الاستراتيجية الوطنية للبيئة"), role: "target", points: years.map((x) => ({ x, y: 4 })) },
    { name: bi("Forecast", "التوقع"), role: "forecast", points: [null, null, null, null, null, null, 2.9, 3.4].map((y, i) => ({ x: years[i], y })) },
  ],
  note: bi("Forecast from the EnviroAI index engine, central scenario.", "التوقع من محرك المؤشرات في EnviroAI، السيناريو المركزي."),
  source: bi("Programme Office, illustrative series.", "مكتب البرنامج، سلسلة توضيحية."),
};

const barChart: ChartSpec = {
  type: "bar",
  title: bi("Deliverables received by quarter", "المخرجات المستلمة حسب الربع"),
  series: [
    { name: bi("Received", "المستلمة"), role: "primary", points: ["Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26"].map((x, i) => ({ x, y: [14, 19, 23, 31, 27, 34, 38][i] })) },
    { name: bi("Verified", "الموثّقة"), role: "comparison", points: ["Q1 25", "Q2 25", "Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26"].map((x, i) => ({ x, y: [11, 15, 20, 26, 24, 30, 33][i] })) },
  ],
  source: bi("EnviroAI Institutional Memory, deliverables register, September 2026.", "EnviroAI، الذاكرة المؤسسية، سجل المخرجات، سبتمبر 2026."),
};

const stackedChart: ChartSpec = {
  type: "stacked",
  title: bi("Knowledge assets added, by type", "الأصول المعرفية المضافة حسب النوع"),
  series: [
    { name: bi("Documents", "الوثائق"), points: years.slice(3).map((x, i) => ({ x, y: [120, 168, 214, 260, 302][i] })) },
    { name: bi("Lessons", "الدروس"), points: years.slice(3).map((x, i) => ({ x, y: [18, 34, 51, 72, 96][i] })) },
    { name: bi("Studies", "الدراسات"), points: years.slice(3).map((x, i) => ({ x, y: [6, 9, 14, 19, 27][i] })) },
  ],
  source: bi("EnviroAI, September 2026.", "EnviroAI، سبتمبر 2026."),
};

const areaChart: ChartSpec = {
  type: "area",
  title: bi("Population, mid-year", "السكان في منتصف العام"),
  unit: bi("million", "مليون").en,
  series: [{ name: bi("Population", "السكان"), role: "primary", points: years.map((x, i) => ({ x, y: [2.8, 2.83, 2.69, 2.98, 3.06, 3.12, 3.16, 3.19][i] })) }],
  source: bi("Programme Office, illustrative series.", "مكتب البرنامج، سلسلة توضيحية."),
};

const figureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 640 200" font-family="Inter, Segoe UI, sans-serif">
<rect width="640" height="200" fill="#FFFFFF"/>
<g>
  <rect x="20" y="70" width="170" height="60" rx="8" fill="#F6E7EC" stroke="#8A1538"/>
  <text x="105" y="95" text-anchor="middle" font-size="12" font-weight="600" fill="#0B2A4A">Programme Strategy</text>
  <text x="105" y="113" text-anchor="middle" font-size="10" fill="#5B6470">5 goals, 12 outcomes</text>
  <rect x="235" y="70" width="170" height="60" rx="8" fill="#DFF1F2" stroke="#0F6E76"/>
  <text x="320" y="95" text-anchor="middle" font-size="12" font-weight="600" fill="#0F6E76">NES themes</text>
  <text x="320" y="113" text-anchor="middle" font-size="10" fill="#5B6470">7 outcomes, 30 targets</text>
  <rect x="450" y="70" width="170" height="60" rx="8" fill="#F8F0DA" stroke="#C9A24D"/>
  <text x="535" y="95" text-anchor="middle" font-size="12" font-weight="600" fill="#8A5C10">Vision 2030 pillars</text>
  <text x="535" y="113" text-anchor="middle" font-size="10" fill="#5B6470">4 pillars</text>
  <path d="M190 100 H235 M405 100 H450" stroke="#8A93A0" stroke-width="1.5"/>
  <path d="M229 95 L235 100 L229 105 M444 95 L450 100 L444 105" fill="none" stroke="#8A93A0" stroke-width="1.5"/>
</g>
</svg>`;

const bodyBlocks: Block[] = [
  { kind: "heading", level: 2, text: bi("Where the strategy stands", "أين تقف الاستراتيجية") },
  {
    kind: "paragraph",
    text: bi(
      "The National Environment Strategy entered its third year with most targets moving in the right direction. Twenty of the thirty headline targets are on track, seven are at risk, and three are behind the trajectory needed to reach 2030. The Office's monitoring cycle now reads quarterly actuals for every indicator with a reporting lag of one quarter or less.",
      "دخلت الاستراتيجية الوطنية للبيئة عامها الثالث ومعظم المستهدفات تتحرك في الاتجاه الصحيح. عشرون من المستهدفات الرئيسية الثلاثين على المسار، وسبعة معرّضة للخطر، وثلاثة متأخرة عن المسار اللازم لبلوغ 2030. وتقرأ دورة الرصد في المكتب الآن القيم الفعلية الفصلية لكل مؤشر بفارق إبلاغ لا يتجاوز ربعاً واحداً."
    ),
  },
  { kind: "heading", level: 3, text: bi("Economic diversification", "التنويع الاقتصادي") },
  {
    kind: "paragraph",
    text: bi(
      "Non-hydrocarbon growth reached 3.1 percent, above the 2.7 percent needed for the 2030 target, driven by logistics, tourism and financial services. Manufacturing value added grew more slowly than planned and remains the weakest link in the diversification chain.",
      "بلغ نمو القطاعات غير الهيدروكربونية 3.1 بالمئة، متجاوزاً نسبة 2.7 بالمئة اللازمة لمستهدف 2030، بدفع من قطاعات اللوجستيات والسياحة والخدمات المالية. ونمت القيمة المضافة للصناعة التحويلية بوتيرة أبطأ مما كان مخططاً وتبقى الحلقة الأضعف في سلسلة التنويع."
    ),
  },
  { kind: "heading", level: 3, text: bi("Fiscal sustainability", "الاستدامة المالية") },
  {
    kind: "paragraph",
    text: bi(
      "The non-hydrocarbon fiscal balance improved for the second consecutive year as spending discipline held and non-oil revenues rose with the new fee framework.",
      "تحسّن الميزان المالي غير الهيدروكربوني للعام الثاني على التوالي مع الحفاظ على انضباط الإنفاق وارتفاع الإيرادات غير النفطية بفضل إطار الرسوم الجديد."
    ),
  },
  {
    kind: "quote",
    text: bi(
      "A strategy is only as strong as the evidence behind it. This year every headline target reads from a verified series, and every deviation has an owner.",
      "لا تكون الاستراتيجية أقوى من الأدلة التي تستند إليها. هذا العام يقرأ كل مستهدف رئيسي من سلسلة موثّقة، ولكل انحراف مالك مسؤول."
    ),
    attribution: bi("Programme Director, Programme Office", "مدير البرنامج، مكتب البرنامج"),
  },
  {
    kind: "bullets",
    items: [
      bi("Twenty targets on track, seven at risk, three behind.", "عشرون مستهدفاً على المسار، وسبعة معرّضة للخطر، وثلاثة متأخرة."),
      bi("Quarterly actuals for 96 percent of indicators.", "قيم فعلية فصلية لنسبة 96 بالمئة من المؤشرات."),
      bi("Fourteen corrective decisions taken by the Office this year.", "أربعة عشر قراراً تصحيحياً اتخذها المكتب هذا العام."),
    ],
  },
  { kind: "heading", level: 2, text: bi("What changed this year", "ما الذي تغيّر هذا العام") },
  {
    kind: "numbered",
    items: [
      bi("Monitoring moved from annual to quarterly for every headline target.", "انتقل الرصد من سنوي إلى فصلي لكل مستهدف رئيسي."),
      bi("Outcome owners now sign off deviations before they reach the Office.", "يوقّع مالكو النتائج الآن على الانحرافات قبل وصولها إلى المكتب."),
      bi("The lessons register links every lesson to a project or initiative.", "يربط سجل الدروس كل درس بمشروع أو مبادرة."),
    ],
  },
  {
    kind: "callout",
    title: bi("Key finding", "النتيجة الأبرز"),
    text: bi(
      "Targets that share a data source with a statistical programme are twice as likely to be on track as targets that rely on administrative reporting alone.",
      "المستهدفات التي تشترك في مصدر بيانات مع برنامج إحصائي أكثر احتمالاً بمرتين أن تكون على المسار مقارنة بالمستهدفات التي تعتمد على الإبلاغ الإداري وحده."
    ),
    tone: "navy",
  },
  { kind: "keyFigure", value: "3.1%", label: bi("Non-hydrocarbon growth in 2026", "نمو القطاعات غير الهيدروكربونية في 2026") },
  {
    kind: "paragraph",
    text: bi(
      "The table below summarises the outcome-level picture. Each row reads the latest verified actual against the trajectory agreed at the start of the strategy.",
      "يلخّص الجدول أدناه الصورة على مستوى النتائج. تقرأ كل صف أحدث قيمة فعلية موثّقة مقابل المسار المتفق عليه في بداية الاستراتيجية."
    ),
  },
  {
    kind: "table",
    caption: bi("Table 1. Headline targets by outcome", "الجدول 1. المستهدفات الرئيسية حسب النتيجة"),
    columns: [bi("Outcome", "النتيجة"), bi("Targets", "المستهدفات"), bi("On track", "على المسار"), bi("At risk", "معرّضة للخطر"), bi("Behind", "متأخرة")],
    align: ["start", "end", "end", "end", "end"],
    rows: [
      [bi("Sustainable economic growth", "النمو الاقتصادي المستدام"), bi("8", "8"), bi("6", "6"), bi("2", "2"), bi("0", "0")],
      [bi("Fiscal sustainability", "الاستدامة المالية"), bi("4", "4"), bi("3", "3"), bi("1", "1"), bi("0", "0")],
      [bi("Future-ready workforce", "قوى عاملة جاهزة للمستقبل"), bi("6", "6"), bi("3", "3"), bi("2", "2"), bi("1", "1")],
      [bi("Cohesive society", "مجتمع متماسك"), bi("5", "5"), bi("4", "4"), bi("1", "1"), bi("0", "0")],
      [bi("Quality of life", "جودة الحياة"), bi("4", "4"), bi("2", "2"), bi("1", "1"), bi("1", "1")],
      [bi("Environmental sustainability", "الاستدامة البيئية"), bi("3", "3"), bi("2", "2"), bi("0", "0"), bi("1", "1")],
    ],
    source: bi("EnviroAI Strategy module, verified actuals to Q2 2026.", "وحدة الاستراتيجية في EnviroAI، قيم فعلية موثّقة حتى الربع الثاني 2026."),
  },
  {
    kind: "figure",
    caption: bi("How the three planning frameworks relate", "كيف ترتبط الأطر الثلاثة للتخطيط البيئي"),
    source: bi("Programme Office.", "مكتب البرنامج."),
    svg: figureSvg,
    widthPx: 640,
    heightPx: 200,
  },
  {
    kind: "paragraph",
    text: bi(
      "Knowledge assets grew faster than headcount for the third year, a sign that the institutional memory is compounding rather than merely accumulating.",
      "نمت الأصول المعرفية بوتيرة أسرع من عدد الموظفين للعام الثالث، وهو مؤشر على أن الذاكرة المؤسسية تتراكم بتأثير مضاعف لا مجرد تجميع."
    ),
  },
  { kind: "chart", chart: stackedChart },
  {
    kind: "kpis",
    items: [
      { label: bi("Documents verified", "وثائق موثّقة"), value: "1,204", delta: "+18% vs 2025", tone: "navy" },
      { label: bi("Lessons published", "دروس منشورة"), value: "96", delta: "+24 vs 2025", tone: "teal" },
      { label: bi("Expert answers", "إجابات الخبراء"), value: "412", delta: "+9%", tone: "aqua" },
      { label: bi("Median time to answer", "الزمن الوسيط للإجابة"), value: "2.1", unit: "days", delta: "-0.6 days", tone: "ink" },
    ],
  },
  { kind: "pageBreak" },
  { kind: "heading", level: 2, text: bi("Outlook to 2027", "الآفاق حتى 2027") },
  {
    kind: "paragraph",
    style: "lead",
    text: bi(
      "Three decisions in the coming year will determine whether the at-risk targets recover: the manufacturing incentive review, the labour market data agreement, and the water reuse programme.",
      "ثلاثة قرارات في العام المقبل ستحدد ما إذا كانت المستهدفات المعرّضة للخطر ستتعافى: مراجعة حوافز الصناعة التحويلية، واتفاقية بيانات سوق العمل، وبرنامج إعادة استخدام المياه."
    ),
  },
  {
    kind: "paragraph",
    text: bi(
      "The Office will report on each decision in the quarterly performance report, with the same evidence standard applied to the Programme Strategy itself.",
      "سيرفع المكتب تقريراً عن كل قرار في تقرير الأداء الفصلي، مع تطبيق معيار الأدلة نفسه على استراتيجية المكتب ذاتها."
    ),
  },
  {
    kind: "paragraph",
    style: "note",
    text: bi("Figures in this section are illustrative seeded data used to demonstrate the report design.", "الأرقام في هذا القسم بيانات توضيحية مزروعة لعرض تصميم التقرير."),
  },
  { kind: "chart", chart: areaChart },
  {
    kind: "scorecard",
    caption: bi("Table 2. Programme Strategy goals, latest period", "الجدول 2. أهداف استراتيجية المكتب، أحدث فترة"),
    columns: [bi("Indicators", "المؤشرات"), bi("On track", "على المسار"), bi("Score", "الدرجة")],
    rows: [
      { label: bi("Goal 1. Evidence-based planning", "الهدف 1. الاستراتيجية القائمة على الأدلة"), cells: [{ text: "16" }, { text: "13", rag: "green", trend: "up" }, { text: "82", rag: "green", trend: "up" }] },
      { label: bi("Goal 2. Statistical excellence", "الهدف 2. التميّز الإحصائي"), cells: [{ text: "18" }, { text: "12", rag: "amber", trend: "flat" }, { text: "67", rag: "amber", trend: "down" }] },
      { label: bi("Goal 3. Institutional capability", "الهدف 3. القدرة المؤسسية"), cells: [{ text: "14" }, { text: "7", rag: "red", trend: "down" }, { text: "48", rag: "red", trend: "down" }] },
    ],
    source: bi("EnviroAI Programme Strategy, illustrative data.", "استراتيجية المكتب في EnviroAI، بيانات توضيحية."),
  },
  {
    kind: "sources",
    items: [
      { n: 1, title: "NES mid-term review (illustrative)", detail: "Programme Office, June 2026, pp. 12 to 18" },
      { n: 2, title: "Quarterly environment statistics digest (illustrative)", detail: "illustrative release", url: "https://www.mewa.gov.sa/en" },
    ],
  },
];

const sections: SectionContent[] = [
  { code: "cover", title: bi("Cover", "الغلاف"), layout: "cover", blocks: [] },
  { code: "contents", title: bi("Contents", "المحتويات"), layout: "contents", blocks: [] },
  {
    code: "foreword",
    numeral: "01",
    title: bi("Foreword", "تمهيد"),
    layout: "opener",
    needsEditing: true,
    lead: bi(
      "A message from the Secretary General on a year in which planning became measurable.",
      "كلمة الأمين العام عن عام أصبح فيه الأداء قابلاً للقياس."
    ),
    blocks: [
      {
        kind: "paragraph",
        text: bi(
          "This report records a year in which the Programme Office moved from setting direction to demonstrating delivery. For the first time, every headline target of the National Environment Strategy is read from a verified statistical series, and every deviation from trajectory has a named owner and a corrective decision.",
          "يوثّق هذا التقرير عاماً انتقل فيه مكتب البرنامج من تحديد الاتجاه إلى إثبات الإنجاز. فللمرة الأولى، يُقرأ كل مستهدف رئيسي في الاستراتيجية الوطنية للبيئة من سلسلة إحصائية موثّقة، ولكل انحراف عن المسار مالك مسمّى وقرار تصحيحي."
        ),
      },
      {
        kind: "paragraph",
        text: bi(
          "The Office also invested in its own memory. EnviroAI now holds the documents, lessons and expertise of the institution in one place, so that what we learn in one project is available to the next.",
          "واستثمر المكتب أيضاً في ذاكرته. يحتفظ EnviroAI الآن بوثائق المؤسسة ودروسها وخبراتها في مكان واحد، بحيث يكون ما نتعلمه في مشروع متاحاً للمشروع الذي يليه."
        ),
      },
      {
        kind: "paragraph",
        text: bi(
          "I thank the Office's staff, our partner entities and the international institutions whose data and advice made this year's progress measurable.",
          "أشكر موظفي المكتب والجهات الشريكة والمؤسسات الدولية التي جعلت بياناتها ومشورتها تقدّم هذا العام قابلاً للقياس."
        ),
      },
    ],
  },
  {
    code: "year_at_a_glance",
    numeral: "02",
    title: bi("The year at a glance", "العام في لمحة"),
    layout: "glance",
    lead: bi("Eight numbers that describe 2026.", "ثمانية أرقام تصف عام 2026."),
    blocks: [
      {
        kind: "kpis",
        items: [
          { label: bi("Targets on track", "مستهدفات على المسار"), value: "20", unit: "of 30", delta: "+3 vs 2025", tone: "navy" },
          { label: bi("Real GDP growth", "نمو الناتج المحلي الحقيقي"), value: "2.9", unit: "%", delta: "+0.5 pts", tone: "navy" },
          { label: bi("Non-hydrocarbon growth", "نمو غير الهيدروكربوني"), value: "3.1", unit: "%", delta: "+0.4 pts", tone: "teal" },
          { label: bi("SDG Index score", "درجة مؤشر أهداف التنمية المستدامة"), value: "72.4", delta: "+1.2 pts, rank 42", tone: "aqua" },
          { label: bi("Population, mid-year", "السكان في منتصف العام"), value: "3.19", unit: "m", delta: "+0.9%", tone: "ink" },
          { label: bi("Deliverables received", "المخرجات المستلمة"), value: "126", delta: "+31 vs 2025", tone: "teal" },
          { label: bi("Lessons captured", "الدروس الملتقطة"), value: "96", delta: "+24", tone: "aqua" },
          { label: bi("Corrective decisions", "القرارات التصحيحية"), value: "14", delta: "unchanged", tone: "ink" },
        ],
      },
      {
        kind: "paragraph",
        text: bi(
          "Water and climate indicators moved in line with the strategy's central scenario while reuse indicators outpaced it. Delivery discipline improved: the Office received a third more deliverables than in 2025 and verified them faster.",
          "جاءت مؤشرات المياه والمناخ متوافقة مع السيناريو المركزي للاستراتيجية بينما تجاوزت مؤشرات إعادة الاستخدام هذا السيناريو. وتحسّن انضباط الإنجاز: تلقّى المكتب مخرجات تزيد بمقدار الثلث عمّا تلقّاه في 2025 ووثّقها بوتيرة أسرع."
        ),
      },
      {
        kind: "paragraph",
        text: bi(
          "Two areas need attention in 2027: the manufacturing targets, where value added lags the plan, and the workforce outcome, where the labour market data agreement is still pending.",
          "مجالان يحتاجان إلى الاهتمام في 2027: مستهدفات الصناعة التحويلية حيث تتخلف القيمة المضافة عن الخطة، ونتيجة القوى العاملة حيث لا تزال اتفاقية بيانات سوق العمل معلّقة."
        ),
      },
      {
        kind: "callout",
        tone: "teal",
        title: bi("Reading the tiles", "قراءة البطاقات"),
        text: bi("Deltas compare with the same period of 2025. Ranks are out of 167 countries.", "تقارن الفروق مع الفترة نفسها من 2025. الترتيب من بين 167 دولة."),
      },
    ],
  },
  {
    code: "nes_themes_overview",
    numeral: "03",
    title: bi("NES themes overview", "نظرة عامة على محاور الاستراتيجية الوطنية للبيئة"),
    layout: "opener",
    lead: bi(
      "Seven outcomes, thirty headline targets, and a monitoring cycle that now reads every quarter.",
      "سبع نتائج، وثلاثون مستهدفاً رئيسياً، ودورة رصد تقرأ الآن كل ربع سنة."
    ),
    keyFigure: { value: "20 / 30", label: bi("headline targets on track", "مستهدفاً رئيسياً على المسار") },
    blocks: bodyBlocks,
    sources: [{ n: 3, title: "Sustainable Development Report 2026", detail: "SDSN, Saudi Arabia country profile", url: "https://dashboards.sdgindex.org" }],
  },
  {
    code: "statistics_highlights",
    numeral: "04",
    title: bi("Statistics highlights", "أبرز الإحصاءات"),
    layout: "chart",
    lead: bi("The two series the Office watched most closely this year.", "السلسلتان اللتان راقبهما المكتب عن كثب هذا العام."),
    blocks: [
      {
        kind: "paragraph",
        text: bi(
          "Growth held close to the strategy's central path and the pipeline of deliverables kept rising through the year. Both charts read verified quarterly data with a one-quarter lag.",
          "بقي النمو قريباً من المسار المركزي للاستراتيجية واستمر تدفق المخرجات في الارتفاع على مدار العام. يقرأ الرسمان البيانيان بيانات فصلية موثّقة بفارق ربع واحد."
        ),
      },
      { kind: "chart", chart: lineChart },
      { kind: "chart", chart: barChart },
    ],
  },
  {
    code: "targets_scorecard",
    numeral: "05",
    title: bi("Targets scorecard", "بطاقة أداء المستهدفات"),
    layout: "scorecard",
    lead: bi("Every headline target against its trajectory, with the latest verified actual.", "كل مستهدف رئيسي مقابل مساره، مع أحدث قيمة فعلية موثّقة."),
    blocks: [
      {
        kind: "scorecard",
        caption: bi("Headline targets, status at Q2 2026", "المستهدفات الرئيسية، الحالة في الربع الثاني 2026"),
        columns: [bi("Baseline", "خط الأساس"), bi("2025", "2025"), bi("2026", "2026"), bi("Target 2030", "مستهدف 2030"), bi("Status", "الحالة")],
        rows: [
          { label: bi("Non-hydrocarbon GDP growth (%)", "نمو الناتج غير الهيدروكربوني (%)"), cells: [{ text: "2.1" }, { text: "2.7", trend: "up" }, { text: "3.1", trend: "up" }, { text: "4.0" }, { text: "On track", rag: "green", trend: "up" }] },
          { label: bi("Treated wastewater reused (million m3)", "المياه المعالجة المعاد استخدامها (مليون م3)"), cells: [{ text: "54" }, { text: "56", trend: "up" }, { text: "57", trend: "flat" }, { text: "72" }, { text: "Behind", rag: "red", trend: "down" }] },
          { label: bi("Saudization in the Office (%)", "السعودة في المكتب (%)"), cells: [{ text: "51" }, { text: "52", trend: "up" }, { text: "53", trend: "up" }, { text: "58" }, { text: "At risk", rag: "amber", trend: "flat" }] },
          { label: bi("Tourism arrivals (m)", "الوافدون السياحيون (مليون)"), cells: [{ text: "4.0" }, { text: "5.1", trend: "up" }, { text: "5.6", trend: "up" }, { text: "6.0" }, { text: "On track", rag: "green", trend: "up" }] },
          { label: bi("Renewable share of electricity (%)", "حصة المتجددة من الكهرباء (%)"), cells: [{ text: "3" }, { text: "6", trend: "up" }, { text: "9", trend: "up" }, { text: "18" }, { text: "On track", rag: "green", trend: "up" }] },
          { label: bi("Water reuse rate (%)", "معدل إعادة استخدام المياه (%)"), cells: [{ text: "31" }, { text: "33", trend: "up" }, { text: "33", trend: "flat" }, { text: "45" }, { text: "Behind", rag: "red", trend: "flat" }] },
          { label: bi("Government e-services satisfaction (%)", "رضا المستخدمين عن الخدمات الحكومية الإلكترونية (%)"), cells: [{ text: "78" }, { text: "82", trend: "up" }, { text: "85", trend: "up" }, { text: "90" }, { text: "On track", rag: "green", trend: "up" }] },
          { label: bi("Median time to verify a deliverable (days)", "الزمن الوسيط لتوثيق المخرج (يوم)"), cells: [{ text: "21" }, { text: "14", trend: "down" }, { text: "9", trend: "down" }, { text: "7" }, { text: "At risk", rag: "amber", trend: "down" }] },
        ],
        source: bi("EnviroAI Strategy module, verified actuals to Q2 2026. Illustrative data.", "وحدة الاستراتيجية في EnviroAI، قيم فعلية موثّقة حتى الربع الثاني 2026. بيانات توضيحية."),
      },
      {
        kind: "paragraph",
        style: "note",
        text: bi("Status reads the latest actual against the straight-line trajectory from baseline to target; a target is at risk when it sits within five percent below the trajectory and behind when it sits further below.", "تُقرأ الحالة من أحدث قيمة فعلية مقابل المسار المستقيم من خط الأساس إلى المستهدف؛ يكون المستهدف معرّضاً للخطر عندما يقع ضمن خمسة بالمئة تحت المسار، ومتأخراً عندما يقع أبعد من ذلك."),
      },
    ],
  },
  {
    code: "sources_appendix",
    numeral: "06",
    title: bi("Sources", "المصادر"),
    layout: "sources",
    blocks: [
      {
        kind: "sources",
        items: [
          { n: 1, title: "NES mid-term review (illustrative)", detail: "Programme Office, June 2026, pp. 12 to 18" },
          { n: 2, title: "Quarterly environment statistics digest (illustrative)", detail: "Programme Office, illustrative release", url: "https://www.mewa.gov.sa/en" },
          { n: 3, title: "Sustainable Development Report 2026", detail: "SDSN, Saudi Arabia country profile", url: "https://dashboards.sdgindex.org" },
          { n: 4, title: "World Economic Outlook, April 2026", detail: "International Monetary Fund", url: "https://www.imf.org/en/Publications/WEO" },
          { n: 5, title: "Programme Strategy 2025 to 2030", detail: "Programme Office, internal, illustrative seed" },
          { n: 6, title: "EnviroAI Institutional Memory", detail: "Deliverables and lessons registers, extracted 19 September 2026" },
        ],
      },
    ],
  },
  { code: "closing", title: bi("Closing", "الخاتمة"), layout: "closing", blocks: [] },
];

const model: ReportDocumentModel = {
  request: {
    reportId: "template-sample",
    typeCode: "org_annual",
    family: "public",
    period: { kind: "year", year: 2026, label: bi("Year 2026", "سنة 2026") },
    scope: { kind: "org", label: bi("Programme Office", "مكتب البرنامج") },
    audience: "leadership",
    languageMode: "both",
    sectionCodes: sections.map((s) => s.code),
    classification: 2,
    requestedBy: "sample",
  },
  typeName: bi("Programme Office Annual Report", "التقرير السنوي لمكتب البرنامج"),
  title: bi("Annual Report 2026", "التقرير السنوي 2026"),
  subtitle: bi("Progress on the National Environment Strategy and the Office's mandate", "التقدم في الاستراتيجية الوطنية للبيئة وولاية المكتب"),
  periodLabel: bi("Reporting year 2026", "السنة المشمولة بالتقرير 2026"),
  yearMark: "2026",
  classification: 2,
  generatedAt: new Date().toISOString(),
  preparedBy: bi("Strategy and Performance Sector", "قطاع الاستراتيجية والأداء"),
  sections,
  coverFigure: { value: "68%", label: bi("of NES headline targets on track", "من المستهدفات الرئيسية للاستراتيجية الوطنية للبيئة على المسار") },
};

async function main() {
  const previews = !process.argv.includes("--no-previews");
  // --suffix x writes template-sample-en-x.docx (used with REPORT_NO_RASTER=1 for the fallback build)
  const si = process.argv.indexOf("--suffix");
  const suffix = si >= 0 ? `-${process.argv[si + 1]}` : "";
  const outDir = path.join(process.cwd(), "data", "reports", "samples");
  fs.mkdirSync(outDir, { recursive: true });
  for (const lang of ["en", "ar"] as const) {
    const outPath = path.join(outDir, `template-sample-${lang}${suffix}.docx`);
    const t0 = Date.now();
    const buf = await renderReportDocx(model, { lang, outPath });
    console.log(`${lang}: ${buf.length} bytes in ${Date.now() - t0} ms -> ${path.relative(process.cwd(), outPath)}`);
    if (previews) {
      const t1 = Date.now();
      const pages = await renderDocxPreviews(outPath);
      console.log(`${lang}: ${pages.length} preview pages in ${Date.now() - t1} ms`);
      for (const p of pages) console.log("  " + p);
    }
  }
  await closePngRenderer();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
