// CR08 5.3: the Foreword, drafted in the Secretary General's voice from the
// headline facts of the period and always marked for editing. The writer
// never invents a figure: the facts are the navigator's at-a-glance band,
// the outcome count, the indices summary and the lessons of the period.
import { getIndicesBoard } from "@/server/services/indices";
import { getLearningRoomData } from "@/server/services/lessons";
import { bi, type SectionDefinition } from "../spec";
import {
  fmt,
  inPeriod,
  internationalCards,
  memo,
  periodLabel,
  periodWord,
  proseBlocks,
  section,
  SRC,
  makeSources,
  summaryOf,
  writeProse,
  type Prose,
} from "./_shared";
import { navigator, reportType, resolveScope } from "./_scope";

type ForewordData = {
  typeName: { en: string; ar: string };
  scopeLabel: { en: string; ar: string };
  isOrg: boolean;
  outcomes: number;
  targetsOnTrack: number;
  targetsTotal: number;
  initiatives: number;
  projects: number;
  updatesInPeriod: number;
  indices: { improving: number; declining: number; stable: number; gccLead: number; tracked: number } | null;
  lessonsInPeriod: number;
  editionCode: string | null;
};

const def: SectionDefinition<ForewordData> = {
  code: "foreword",
  name: bi("Foreword", "التصدير"),
  description: bi(
    "A foreword drafted for the Secretary General from the period's headline facts, marked for editing.",
    "تصدير مصاغ للأمين العام من أبرز حقائق الفترة، موسوم للتحرير."
  ),
  layout: "opener",
  estimatedPages: 1,
  appliesTo: "all",
  async load(ctx) {
    const [type, scope, nav] = await Promise.all([reportType(ctx), resolveScope(ctx), navigator(ctx)]);
    const board = await memo(ctx, "indices-board", () => getIndicesBoard(ctx.user).catch(() => null));
    const room = await memo(ctx, "learning-room", () => getLearningRoomData(ctx.user).catch(() => null));
    const period = ctx.request.period;
    const monthsIn = nav
      ? nav.glance.months
          .map((m, i) => ({ m, n: nav.glance.updatesPerMonth[i] ?? 0 }))
          .filter((x) => inPeriod(`${x.m}-15`, period))
          .reduce((s, x) => s + x.n, 0)
      : 0;
    return {
      typeName: type ? { en: type.nameEn, ar: type.nameAr } : { en: "Report", ar: "تقرير" },
      scopeLabel: scope.label,
      isOrg: scope.kind === "org" || scope.kind === "period",
      outcomes: nav?.outcomes.length ?? 0,
      targetsOnTrack: nav?.glance.targetsOnTrack ?? 0,
      targetsTotal: nav?.glance.targetsTotal ?? 0,
      initiatives: nav?.glance.initiatives ?? 0,
      projects: nav?.glance.projects ?? 0,
      updatesInPeriod: monthsIn,
      indices: board
        ? { ...summaryOf(internationalCards(board.cards)), tracked: internationalCards(board.cards).length }
        : null,
      lessonsInPeriod: room ? room.lessons.filter((l) => inPeriod(l.createdAt, period)).length : 0,
      editionCode: scope.edition?.code ?? null,
    };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const word = periodWord(ctx.request.period);
    const mock = (): Prose => {
      const paragraphs = [
        bi(
          `It is my pleasure to present the ${data.typeName.en} for ${period.en}. ${data.isOrg ? "The Programme Office" : data.scopeLabel.en} carried ${fmt(data.initiatives)} initiatives and ${fmt(data.projects)} projects through ${word.en}, and ${fmt(data.targetsOnTrack)} of the ${fmt(data.targetsTotal)} national targets we track stand on track today.`,
          `يسرني أن أقدم ${data.typeName.ar} عن ${period.ar}. لقد حمل ${data.isOrg ? "مكتب البرنامج" : data.scopeLabel.ar} ${fmt(data.initiatives)} مبادرة و${fmt(data.projects)} مشروعاً عبر ${word.ar}، ويقف اليوم ${fmt(data.targetsOnTrack)} من أصل ${fmt(data.targetsTotal)} مستهدفاً وطنياً نتابعه على المسار الصحيح.`
        ),
      ];
      if (data.indices) {
        paragraphs.push(
          bi(
            `Across the ${fmt(data.indices.tracked)} international indices we follow, Saudi Arabia improved in ${fmt(data.indices.improving)}, held steady in ${fmt(data.indices.stable)} and declined in ${fmt(data.indices.declining)}, leading the Gulf Cooperation Office in ${fmt(data.indices.gccLead)} of them. Each movement is read in this report against the evidence behind it, not as a headline.`,
            `وفي المؤشرات الدولية الـ${fmt(data.indices.tracked)} التي نتابعها، تحسنت السعودية في ${fmt(data.indices.improving)} منها، وحافظت على موقعها في ${fmt(data.indices.stable)}، وتراجعت في ${fmt(data.indices.declining)}، وتصدرت دول مجلس التعاون الخليجي في ${fmt(data.indices.gccLead)} منها. ويقرأ هذا التقرير كل تحرك في ضوء الشواهد الكامنة وراءه، لا بوصفه عنواناً.`
          )
        );
      }
      paragraphs.push(
        bi(
          `${data.updatesInPeriod ? `The ${fmt(data.updatesInPeriod)} status updates recorded during ${word.en} and the ${fmt(data.lessonsInPeriod)} lessons our teams documented are` : `The lessons our teams documented are`} the institutional memory this Office builds on. I thank every directorate and partner whose work these pages record, and I commend the report to its readers.`,
          `${data.updatesInPeriod ? `إن تحديثات الحالة الـ${fmt(data.updatesInPeriod)} المسجلة خلال ${word.ar} والدروس الـ${fmt(data.lessonsInPeriod)} التي وثقتها فرقنا هي` : `إن الدروس التي وثقتها فرقنا هي`} الذاكرة المؤسسية التي يبني عليها هذا المكتب. وأشكر كل إدارة وشريك سجلت هذه الصفحات عملهم، وأوصي القراء بهذا التقرير.`
        )
      );
      return {
        lead: bi(
          `A word from the Secretary General on ${period.en}.`,
          `كلمة الأمين العام عن ${period.ar}.`
        ),
        paragraphs,
      };
    };
    const { prose, live } = await writeProse(
      ctx,
      "foreword",
      {
        purpose:
          "A foreword the Secretary General of the Programme Office will sign, opening the report. It frames the period, names the headline facts once each, and thanks the teams.",
        structure:
          "Three short paragraphs: the period and the Office's role; two or three headline facts from the data; a closing that commends the report. A one-sentence lead.",
        tone: "First person plural where institutional, first person singular for the closing thanks; formal, warm, no superlatives; a draft a human will edit.",
        paragraphs: 3,
        lead: true,
      },
      data,
      mock
    );
    return section("foreword", bi("Foreword", "التصدير"), "opener", {
      lead: prose.lead,
      blocks: [
        ...proseBlocks(prose),
        {
          kind: "paragraph",
          style: "note",
          text: bi(
            "Draft prepared by EnviroAI for the Secretary General's review; the signed text replaces this page.",
            "مسودة أعدها EnviroAI لمراجعة الأمين العام؛ ويحل النص الموقّع محل هذه الصفحة."
          ),
        },
      ],
      sources: makeSources([
        ...(data.editionCode ? [SRC.strategy(data.editionCode)] : []),
        ...(data.indices ? [SRC.forecasts(), { title: "EnviroAI Indices board", detail: "Saudi Arabia's latest movements" }] : []),
        SRC.lessons(),
      ]),
      needsEditing: true,
      meta: { live, draftedFor: "Secretary General" },
    });
  },
};

export default def;
