// CR08 5.3: events and partnerships. EnviroAI has no events register and
// no partners table, so this section uses two honest proxies and says so:
// partners are the publishers of the accepted policy and market signals
// of the period (the organisations whose work the Office acted on), and
// events are the EnviroAI Briefing Cast episodes published in the period. The
// proxy is recorded in meta.proxy and in a note on the page.
import { listSignals, type SignalListItem } from "@/server/services/signals";
import { listEpisodes } from "@/server/services/podcast";
import { bi, type Block, type SectionDefinition } from "../spec";
import { dated, daysSincePeriodStart, fmt, periodLabel, proseBlocks, section, SRC, makeSources, noteBlock, writeProse, T, type Prose } from "./_shared";
import { resolveScope } from "./_scope";

type Partner = { name: string; signals: number; latest: string | null; sampleEn: string; sampleAr: string; types: string[] };
type Event = { titleEn: string; titleAr: string; focus: string; minutes: number; date: string; language: string };
type EventsData = { partners: Partner[]; events: Event[]; widened: boolean; signalCount: number };

const def: SectionDefinition<EventsData> = {
  code: "events_partnerships",
  name: bi("Events and partnerships", "الفعاليات والشراكات"),
  description: bi(
    "The organisations whose policy and market signals the Office acted on, and the Knowledge Cast episodes of the period (proxies, stated as such).",
    "الجهات التي تصرف المكتب بناءً على إشاراتها السياساتية والسوقية، وحلقات بث المعرفة في الفترة (بدائل تقريبية، مصرح بها)."
  ),
  layout: "body",
  estimatedPages: 1,
  appliesTo: "all",
  async load(ctx) {
    const scope = await resolveScope(ctx);
    const nodeId = scope.outcome?.id ?? scope.project?.id;
    const fetch = async (days: number) => {
      const out: SignalListItem[] = [];
      for (const type of ["policy", "market"]) {
        out.push(...(await listSignals(ctx.user, { triage: "accepted", type, days, limit: 100, nodeId }).catch(() => [])));
      }
      return out;
    };
    let rows = (await fetch(daysSincePeriodStart(ctx.request.period))).filter((s) => dated(s.publishedAt ?? s.createdAt, ctx.request.period));
    let widened = false;
    if (!rows.length) {
      rows = await fetch(365);
      widened = rows.length > 0;
    }
    const byPublisher = new Map<string, Partner>();
    for (const s of rows) {
      const name = s.publisher?.trim();
      if (!name) continue;
      const p = byPublisher.get(name) ?? { name, signals: 0, latest: null, sampleEn: s.titleEn, sampleAr: s.titleAr || s.titleEn, types: [] };
      p.signals += 1;
      const date = (s.publishedAt ?? s.createdAt)?.slice(0, 10) ?? null;
      if (date && (!p.latest || date > p.latest)) {
        p.latest = date;
        p.sampleEn = s.titleEn;
        p.sampleAr = s.titleAr || s.titleEn;
      }
      if (!p.types.includes(s.signalType)) p.types.push(s.signalType);
      byPublisher.set(name, p);
    }
    const partners = [...byPublisher.values()].sort((a, b) => b.signals - a.signals).slice(0, 12);
    const episodes = await listEpisodes(ctx.user).catch(() => []);
    const events: Event[] = episodes
      .filter((e) => dated(e.createdAt, ctx.request.period) || widened)
      .slice(0, 10)
      .map((e) => ({ titleEn: e.titleEn, titleAr: e.titleAr, focus: e.focus, minutes: Math.round(e.durationSec / 60), date: e.createdAt.slice(0, 10), language: e.language }));
    return { partners, events, widened, signalCount: rows.length };
  },
  async write(ctx, data) {
    const period = periodLabel(ctx.request.period);
    const mock = (): Prose => ({
      paragraphs: [
        data.partners.length
          ? bi(
              `${fmt(data.partners.length)} organisations published the ${fmt(data.signalCount)} policy and market signals the Office accepted ${data.widened ? `in the twelve months to ${period.en}` : `in ${period.en}`}, led by ${data.partners[0].name} with ${fmt(data.partners[0].signals)}. EnviroAI keeps no partnership register, so these publishers stand in for the partners whose work shaped the period.`,
              `نشرت ${fmt(data.partners.length)} جهة الإشارات السياساتية والسوقية الـ${fmt(data.signalCount)} التي قبلها المكتب ${data.widened ? `في الأشهر الاثني عشر حتى ${period.ar}` : `في ${period.ar}`}، تتصدرها ${data.partners[0].name} بـ${fmt(data.partners[0].signals)}. ولا يحتفظ EnviroAI بسجل للشراكات، ولذلك تحل هذه الجهات الناشرة محل الشركاء الذين شكل عملهم الفترة.`
            )
          : bi(`No accepted policy or market signal names a publisher for this scope in ${period.en}.`, `لا تذكر أي إشارة سياساتية أو سوقية مقبولة جهة ناشرة لهذا النطاق في ${period.ar}.`),
        data.events.length
          ? bi(`${fmt(data.events.length)} EnviroAI Briefing Cast episodes were published ${data.widened ? "over the same twelve months" : `in ${period.en}`}, the Office's own knowledge events for the period.`, `ونُشرت ${fmt(data.events.length)} حلقات من بث المعرفة ${data.widened ? "خلال الأشهر الاثني عشر نفسها" : `في ${period.ar}`}، وهي فعاليات المعرفة الخاصة بالمكتب في الفترة.`)
          : bi(`No Knowledge Cast episode was published in ${period.en}.`, `لم تُنشر أي حلقة من بث المعرفة في ${period.ar}.`),
      ],
    });
    const { prose, live } = await writeProse(
      ctx,
      "events_partnerships",
      {
        purpose: "Describe the organisations whose signals the Office acted on and the knowledge events of the period, stating plainly that both are proxies from the EnviroAI record.",
        structure: "Two short paragraphs: the publishers as partners; the episodes as events.",
        paragraphs: 2,
      },
      data,
      mock
    );
    const blocks: Block[] = [
      ...proseBlocks(prose),
      noteBlock(
        "Proxy note: EnviroAI holds no events register and no partnership table. Partners here are the publishers of accepted policy and market signals; events are the published Knowledge Cast episodes.",
        "ملاحظة بديل: لا يحتفظ EnviroAI بسجل للفعاليات ولا بجدول للشراكات. الشركاء هنا هم ناشرو الإشارات السياساتية والسوقية المقبولة؛ والفعاليات هي حلقات بث المعرفة المنشورة."
      ),
    ];
    if (data.partners.length) {
      blocks.push({
        kind: "table",
        caption: bi("Organisations behind the accepted signals", "الجهات الكامنة وراء الإشارات المقبولة"),
        columns: [T.organisation, bi("Signals", "الإشارات"), bi("Types", "الأنواع"), bi("Latest", "الأحدث"), bi("Most recent signal", "أحدث إشارة")],
        rows: data.partners.map((p) => [bi(p.name, p.name), bi(fmt(p.signals), fmt(p.signals)), bi(p.types.join(", "), p.types.join("، ")), bi(p.latest ?? "", p.latest ?? ""), bi(p.sampleEn, p.sampleAr)]),
        align: ["start", "end", "start", "end", "start"],
      });
    }
    if (data.events.length) {
      blocks.push({
        kind: "table",
        caption: bi("EnviroAI Briefing Cast episodes", "حلقات بث المعرفة"),
        columns: [T.title, T.focus, bi("Language", "اللغة"), T.duration, T.date],
        rows: data.events.map((e) => [bi(e.titleEn, e.titleAr), bi(e.focus, e.focus), bi(e.language, e.language), bi(`${fmt(e.minutes)} min`, `${fmt(e.minutes)} د`), bi(e.date, e.date)]),
        align: ["start", "start", "start", "end", "end"],
      });
    }
    return section("events_partnerships", bi("Events and partnerships", "الفعاليات والشراكات"), "body", {
      lead: bi(`${fmt(data.partners.length)} organisations, ${fmt(data.events.length)} knowledge events.`, `${fmt(data.partners.length)} جهة و${fmt(data.events.length)} فعاليات معرفية.`),
      blocks,
      sources: makeSources([SRC.signals(), SRC.podcast()]),
      meta: { live, proxy: { partners: "publishers of accepted policy and market signals", events: "published Knowledge Cast episodes" }, widened: data.widened, partners: data.partners.length, events: data.events.length },
    });
  },
};

export default def;
