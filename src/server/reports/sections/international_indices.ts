// CR08 5.3: Qatar in the international indices: the movements since the
// previous edition, the GCC benchmark, and the bar of Qatar's latest ranks.
// For an outcome report the cards are those linked to the outcome's targets.
import { getIndicesBoard, type BoardCard } from "@/server/services/indices";
import { bi, type Block, type KpiTile, type SectionDefinition } from "../spec";
import { fmt, fmtAuto, internationalCards, memo, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, signed, summaryOf, writeProse, T, type Prose } from "./_shared";
import { resolveScope } from "./_scope";

type Card = { code: string; nameEn: string; nameAr: string; publisher: string | null; year: number | null; rank: number | null; total: number | null; score: number | null; change: number | null; changeKind: "rank" | "score" | null; gccPosition: number | null; gccCount: number; forecastDirection: string | null; category: string };
type IndicesData = { cards: Card[]; summary: { improving: number; stable: number; declining: number; gccLead: number }; scoped: boolean; lastRefresh: string | null };

const cardOf = (c: BoardCard): Card => ({ code: c.code, nameEn: c.nameEn, nameAr: c.nameAr, publisher: c.publisher, year: c.qatar?.year ?? c.latestYear, rank: c.qatar?.rank ?? null, total: c.qatar?.total ?? null, score: c.qatar?.score ?? null, change: c.change, changeKind: c.changeKind, gccPosition: c.gccPosition, gccCount: c.gccCount, forecastDirection: c.forecastDirection, category: c.category });

const def: SectionDefinition<IndicesData> = {
  code: "international_indices",
  name: bi("International indices", "المؤشرات الدولية"),
  description: bi(
    "Qatar's movements across the tracked international indices and its position among the GCC.",
    "تحركات قطر في المؤشرات الدولية المتابعة وموقعها بين دول مجلس التعاون."
  ),
  layout: "body",
  estimatedPages: 3,
  appliesTo: "all",
  async load(ctx) {
    const [scope, board] = await Promise.all([resolveScope(ctx), memo(ctx, "indices-board", () => getIndicesBoard(ctx.user).catch(() => null))]);
    if (!board) return { cards: [], summary: { improving: 0, stable: 0, declining: 0, gccLead: 0 }, scoped: false, lastRefresh: null };
    let cards = internationalCards(board.cards);
    let scoped = false;
    if (scope.kind === "outcome" || scope.kind === "project") {
      const linked = cards.filter((c) => c.linkedTargets.some((t) => scope.scopeNodeIds.has(t.id)));
      if (linked.length) {
        cards = linked;
        scoped = true;
      }
    }
    return { cards: cards.map(cardOf), summary: summaryOf(cards), scoped, lastRefresh: board.lastRefresh };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const climbers = data.cards.filter((c) => (c.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 3);
    const fallers = data.cards.filter((c) => (c.change ?? 0) < 0).sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 2);
    const standing = (c: Card) => (c.rank != null ? `rank ${fmt(c.rank)}${c.total ? ` of ${fmt(c.total)}` : ""}` : c.score != null ? `score ${fmtAuto(c.score)}` : "no value");
    const standingAr = (c: Card) => (c.rank != null ? `المرتبة ${fmt(c.rank)}${c.total ? ` من ${fmt(c.total)}` : ""}` : c.score != null ? `الدرجة ${fmtAuto(c.score)}` : "لا قيمة");
    const moveEn = (c: Card) => (c.changeKind === "rank" ? `${signed(c.change, 0)} places` : `${signed(c.change, 2)} points`);
    const mock = (): Prose => ({
      paragraphs: data.cards.length
        ? [
            bi(
              `Across the ${fmt(data.cards.length)} international indices ${data.scoped ? "linked to this scope" : "tracked"}, Qatar improved in ${fmt(data.summary.improving)}, held steady in ${fmt(data.summary.stable)} and declined in ${fmt(data.summary.declining)} at the latest editions, leading the GCC in ${fmt(data.summary.gccLead)}.`,
              `عبر المؤشرات الدولية الـ${fmt(data.cards.length)} ${data.scoped ? "المرتبطة بهذا النطاق" : "المتابعة"}، تحسنت قطر في ${fmt(data.summary.improving)} منها، وحافظت على موقعها في ${fmt(data.summary.stable)}، وتراجعت في ${fmt(data.summary.declining)} في أحدث الإصدارات، وتصدرت دول مجلس التعاون في ${fmt(data.summary.gccLead)} منها.`
            ),
            ...(climbers.length
              ? [
                  bi(
                    `The strongest gains were ${climbers.map((c) => `${c.nameEn} (${standing(c)} in ${c.year}, ${moveEn(c)})`).join("; ")}.${fallers.length ? ` The largest declines were ${fallers.map((c) => `${c.nameEn} (${moveEn(c)})`).join(" and ")}.` : ""}`,
                    `وكانت أقوى المكاسب في ${climbers.map((c) => `${c.nameAr} (${standingAr(c)} في ${c.year}، ${moveEn(c)})`).join("؛ ")}.${fallers.length ? ` وأكبر التراجعات في ${fallers.map((c) => `${c.nameAr} (${moveEn(c)})`).join(" و")}.` : ""}`
                  ),
                ]
              : []),
          ]
        : [bi("No international index is linked to this scope.", "لا يرتبط أي مؤشر دولي بهذا النطاق.")],
    });
    const { prose, live } = await writeProse(
      ctx,
      "international_indices",
      {
        purpose: "Read Qatar's standing and movements in the international indices, and its position among the GCC.",
        structure: "Two paragraphs: the summary counts; the largest gains and declines naming the index, the year, the rank or score and the movement. Ranks: lower is better.",
        paragraphs: 2,
      },
      { period: period.en, summary: data.summary, cards: data.cards },
      mock
    );
    const tiles: KpiTile[] = [
      { label: bi("Improving", "في تحسن"), value: fmt(data.summary.improving), tone: "maroon" },
      { label: bi("Stable", "مستقرة"), value: fmt(data.summary.stable), tone: "ink" },
      { label: bi("Declining", "في تراجع"), value: fmt(data.summary.declining), tone: "gold" },
      { label: bi("Leading the GCC", "متصدرة خليجياً"), value: fmt(data.summary.gccLead), tone: "gulf" },
    ];
    const blocks: Block[] = [{ kind: "kpis", items: tiles }, ...proseBlocks(prose)];
    if (!data.cards.length) {
      blocks.push(noteBlock("The Indices board holds no index for this scope.", "لا تحتوي لوحة المؤشرات على أي مؤشر لهذا النطاق."));
    } else {
      blocks.push({
        kind: "table",
        caption: bi("Qatar in the tracked indices, latest editions", "قطر في المؤشرات المتابعة، أحدث الإصدارات"),
        columns: [bi("Index", "المؤشر"), T.publisher, T.year, T.rank, T.score, T.change, T.gcc],
        rows: data.cards.map((c) => [
          bi(c.nameEn, c.nameAr),
          bi(c.publisher ?? "", c.publisher ?? ""),
          bi(c.year ? String(c.year) : "", c.year ? String(c.year) : ""),
          bi(c.rank != null ? `${fmt(c.rank)}${c.total ? `/${fmt(c.total)}` : ""}` : "", c.rank != null ? `${fmt(c.rank)}${c.total ? `/${fmt(c.total)}` : ""}` : ""),
          bi(c.score != null ? fmtAuto(c.score) : "", c.score != null ? fmtAuto(c.score) : ""),
          bi(c.change == null ? "" : moveEn(c), c.change == null ? "" : moveEn(c)),
          bi(c.gccPosition ? `${c.gccPosition} of ${c.gccCount}` : "", c.gccPosition ? `${c.gccPosition} من ${c.gccCount}` : ""),
        ]),
        align: ["start", "start", "end", "end", "end", "end", "end"],
        source: bi("Publishers' latest editions, as held in SiaNexus", "أحدث إصدارات الناشرين، كما هي محفوظة في سيا نكسس"),
      });
      const ranked = data.cards.filter((c) => c.rank != null);
      if (ranked.length >= 3) {
        blocks.push({
          kind: "chart",
          chart: {
            type: "bar",
            title: bi("Qatar's latest rank by index (lower is better)", "أحدث مرتبة لقطر بحسب المؤشر (الأقل أفضل)"),
            unit: "rank",
            series: [{ name: bi("Rank", "المرتبة"), role: "primary", points: ranked.map((c) => ({ x: c.code, y: c.rank })) }],
            source: bi("Publishers' latest editions", "أحدث إصدارات الناشرين"),
          },
        });
      }
    }
    return section("international_indices", bi("International indices", "المؤشرات الدولية"), "body", {
      lead: bi(`Qatar in ${fmt(data.cards.length)} indices: ${fmt(data.summary.improving)} up, ${fmt(data.summary.declining)} down.`, `قطر في ${fmt(data.cards.length)} مؤشراً: ${fmt(data.summary.improving)} صاعداً و${fmt(data.summary.declining)} هابطاً.`),
      keyFigure: data.cards.length ? { value: `${data.summary.gccLead}/${data.cards.length}`, label: bi("indices where Qatar leads the GCC", "مؤشرات تتصدر فيها قطر الخليج") } : undefined,
      blocks,
      sources: makeSources(data.cards.map((c) => SRC.indices(c.publisher ?? "Publisher", c.nameEn, c.year))),
      meta: { live, scoped: data.scoped, cards: data.cards.length, lastRefresh: data.lastRefresh },
    });
  },
};

export default def;
