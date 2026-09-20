// CR08 5.3: lessons and themes. The lessons documented in the period for
// the scope (linked nodes for an outcome or project, authoring department
// for a unit), the themes they cluster into, and the recommendations that
// recur.
import { getLearningRoomData, type RoomLesson } from "@/server/services/lessons";
import { bi, type Block, type SectionDefinition } from "../spec";
import { fmt, inPeriod, memo, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, statusText, writeProse, T, type Prose } from "./_shared";
import { resolveScope } from "./_scope";

type Lesson = { id: string; titleEn: string; titleAr: string; category: string; status: string; nodeCode: string | null; outcomeCode: string | null; departmentEn: string | null; departmentAr: string | null; learningEn: string | null; learningAr: string | null; recommendationEn: string | null; recommendationAr: string | null; createdAt: string; reuseCount: number };
type Theme = { labelEn: string; labelAr: string; summaryEn: string | null; summaryAr: string | null; count: number; outcomes: string[] };
type LessonsData = { lessons: Lesson[]; widened: boolean; themes: Theme[]; byCategory: Record<string, number>; totalInScope: number };

const CATEGORY_AR: Record<string, string> = { delivery: "التنفيذ", external: "خارجي", expert: "خبراء", institutional: "مؤسسي" };

const lessonOf = (l: RoomLesson): Lesson => ({ id: l.id, titleEn: l.titleEn, titleAr: l.titleAr || l.titleEn, category: l.category, status: l.status, nodeCode: l.links[0]?.code ?? l.nodeCode, outcomeCode: l.outcomeCode, departmentEn: l.departmentEn, departmentAr: l.departmentAr, learningEn: l.learningEn, learningAr: l.learningAr, recommendationEn: l.recommendationEn, recommendationAr: l.recommendationAr, createdAt: l.createdAt.slice(0, 10), reuseCount: l.reuseCount });

const def: SectionDefinition<LessonsData> = {
  code: "lessons_themes",
  name: bi("Lessons and themes", "الدروس والمحاور"),
  description: bi(
    "The lessons documented in the period for the scope, the themes they form, and the recommendations that recur.",
    "الدروس الموثقة في الفترة ضمن النطاق، والمحاور التي تشكلها، والتوصيات المتكررة."
  ),
  layout: "body",
  estimatedPages: 2,
  appliesTo: "all",
  async load(ctx) {
    const scope = await resolveScope(ctx);
    const room = await memo(ctx, "learning-room", () => getLearningRoomData(ctx.user).catch(() => null));
    if (!room) return { lessons: [], widened: false, themes: [], byCategory: {}, totalInScope: 0 };
    const inScope = room.lessons.filter((l) => {
      if (scope.kind === "npc" || scope.kind === "period") return true;
      if (scope.kind === "department" && scope.unit) return l.departmentEn === scope.unit.nameEn || l.links.some((k) => scope.scopeNodeIds.has(k.nodeId));
      return l.links.some((k) => scope.scopeNodeIds.has(k.nodeId)) || (l.nodeId ? scope.scopeNodeIds.has(l.nodeId) : false);
    });
    let chosen = inScope.filter((l) => inPeriod(l.createdAt, ctx.request.period));
    let widened = false;
    if (!chosen.length && inScope.length) {
      chosen = [...inScope].sort((a, b) => b.score - a.score).slice(0, 12);
      widened = true;
    }
    const chosenIds = new Set(chosen.map((l) => l.id));
    const themes: Theme[] = room.themes
      .map((t) => ({ labelEn: t.labelEn, labelAr: t.labelAr, summaryEn: t.summaryEn, summaryAr: t.summaryAr, count: t.lessonIds.filter((id) => chosenIds.has(id)).length, outcomes: t.outcomes.map((o) => o.code) }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    const byCategory: Record<string, number> = {};
    for (const l of chosen) byCategory[l.category] = (byCategory[l.category] ?? 0) + 1;
    return { lessons: chosen.sort((a, b) => b.score - a.score).slice(0, 20).map(lessonOf), widened, themes, byCategory, totalInScope: inScope.length };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const withRec = data.lessons.filter((l) => l.recommendationEn).slice(0, 5);
    const mock = (): Prose => ({
      paragraphs: data.lessons.length
        ? [
            bi(
              `${fmt(data.lessons.length)} lessons ${data.widened ? `were on record for this scope (none was documented inside ${period.en}, so the most reused are shown)` : `were documented in ${period.en} for this scope`}: ${Object.entries(data.byCategory).map(([c, n]) => `${fmt(n)} ${c}`).join(", ")}.${data.themes.length ? ` They cluster into ${fmt(data.themes.length)} themes, led by "${data.themes[0].labelEn}" with ${fmt(data.themes[0].count)} lessons.` : ""}`,
              `${fmt(data.lessons.length)} درساً ${data.widened ? `كانت مسجلة لهذا النطاق (ولم يُوثق أي منها داخل ${period.ar}، ولذلك تُعرض الأكثر إعادة استخدام)` : `وُثقت في ${period.ar} لهذا النطاق`}: ${Object.entries(data.byCategory).map(([c, n]) => `${fmt(n)} ${CATEGORY_AR[c] ?? c}`).join("، ")}.${data.themes.length ? ` وتتجمع في ${fmt(data.themes.length)} محاور، يتصدرها "${data.themes[0].labelAr}" بـ${fmt(data.themes[0].count)} دروس.` : ""}`
            ),
          ]
        : [bi(`No lesson is linked to this scope in ${period.en} or before it.`, `لا يرتبط أي درس بهذا النطاق في ${period.ar} ولا قبلها.`)],
      bullets: withRec.map((l) => bi(`${l.nodeCode ? `${l.nodeCode}: ` : ""}${l.recommendationEn}`, `${l.nodeCode ? `${l.nodeCode}: ` : ""}${l.recommendationAr ?? l.recommendationEn}`)),
    });
    const { prose, live } = await writeProse(
      ctx,
      "lessons_themes",
      {
        purpose: "Synthesise the period's lessons into themes and the recommendations that should carry into the next cycle.",
        structure: "One paragraph on counts and themes; then one bullet per recurring recommendation, prefixed by the node code where the lesson sits.",
        paragraphs: 1,
        bullets: Math.min(5, withRec.length),
      },
      { period: period.en, widened: data.widened, byCategory: data.byCategory, themes: data.themes, lessons: data.lessons.slice(0, 12).map((l) => ({ ...l, learningEn: l.learningEn?.slice(0, 300), learningAr: l.learningAr?.slice(0, 300), recommendationEn: l.recommendationEn?.slice(0, 300), recommendationAr: l.recommendationAr?.slice(0, 300) })) },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (data.widened) blocks.push(noteBlock(`No lesson was documented inside ${period.en}; the most reused lessons on record for the scope are shown.`, `لم يُوثق أي درس داخل ${period.ar}؛ وتُعرض الدروس الأكثر إعادة استخدام المسجلة للنطاق.`));
    if (data.themes.length) {
      blocks.push({
        kind: "table",
        caption: bi("Themes", "المحاور"),
        columns: [T.theme, T.lessons, bi("Outcomes", "النتائج")],
        rows: data.themes.map((t) => [bi(t.labelEn, t.labelAr), bi(fmt(t.count), fmt(t.count)), bi(t.outcomes.join(", "), t.outcomes.join("، "))]),
        align: ["start", "end", "start"],
      });
    }
    if (data.lessons.length) {
      blocks.push({
        kind: "table",
        caption: bi("Lessons", "الدروس"),
        columns: [T.title, T.category, bi("Linked to", "مرتبط بـ"), T.department, T.status, T.date],
        rows: data.lessons.slice(0, 15).map((l) => [bi(l.titleEn, l.titleAr), bi(l.category, CATEGORY_AR[l.category] ?? l.category), bi(l.nodeCode ?? "", l.nodeCode ?? ""), bi(l.departmentEn ?? "", l.departmentAr ?? l.departmentEn ?? ""), statusText(l.status), bi(l.createdAt, l.createdAt)]),
        align: ["start", "start", "start", "start", "start", "end"],
      });
    } else {
      blocks.push(noteBlock("No lessons to list.", "لا دروس لإدراجها."));
    }
    return section("lessons_themes", bi("Lessons and themes", "الدروس والمحاور"), "body", {
      lead: bi(`${fmt(data.lessons.length)} lessons, ${fmt(data.themes.length)} themes.`, `${fmt(data.lessons.length)} درساً و${fmt(data.themes.length)} محاور.`),
      blocks,
      sources: makeSources([SRC.lessons(), ...data.lessons.slice(0, 10).map((l) => ({ title: l.titleEn, detail: `lesson, ${l.createdAt}` }))]),
      meta: { live, count: data.lessons.length, widened: data.widened, themes: data.themes.length, totalInScope: data.totalInScope },
    });
  },
};

export default def;
