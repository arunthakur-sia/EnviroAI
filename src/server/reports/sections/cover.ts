// CR08 5.3: the cover. No prose; the template draws the title, subtitle,
// period and classification from the document model. The section carries
// the subtitle and an optional key figure so the cover can show one number.
import { bi, type SectionDefinition } from "../spec";
import { section } from "./_shared";
import { navigator, reportType, resolveScope } from "./_scope";

type CoverData = {
  typeName: { en: string; ar: string } | null;
  scopeLabel: { en: string; ar: string };
  outcomes: number;
  targetsOnTrack: number;
  targetsTotal: number;
};

const def: SectionDefinition<CoverData> = {
  code: "cover",
  name: bi("Cover", "الغلاف"),
  description: bi(
    "The designed cover: title, subtitle, period, the year mark and the classification chip.",
    "الغلاف المصمم: العنوان والعنوان الفرعي والفترة وعلامة السنة وشارة التصنيف."
  ),
  layout: "cover",
  estimatedPages: 1,
  appliesTo: "all",
  async load(ctx) {
    const [type, scope, nav] = await Promise.all([reportType(ctx), resolveScope(ctx), navigator(ctx)]);
    return {
      typeName: type ? { en: type.nameEn, ar: type.nameAr } : null,
      scopeLabel: scope.label,
      outcomes: nav?.outcomes.length ?? 0,
      targetsOnTrack: nav?.glance.targetsOnTrack ?? 0,
      targetsTotal: nav?.glance.targetsTotal ?? 0,
    };
  },
  async write(ctx, data) {
    const isNpc = ctx.request.scope.kind === "npc" || ctx.request.scope.kind === "period";
    // the template prints the period label under the subtitle, so the
    // subtitle names only who or what the report is about
    const subtitle = isNpc
      ? bi("National Planning Council", "المجلس الوطني للتخطيط")
      : bi(data.scopeLabel.en, data.scopeLabel.ar);
    const keyFigure =
      isNpc && data.targetsTotal
        ? { value: `${data.targetsOnTrack}/${data.targetsTotal}`, label: bi("targets on track", "مستهدفات على المسار") }
        : undefined;
    return section("cover", data.typeName ? bi(data.typeName.en, data.typeName.ar) : bi("Report", "تقرير"), "cover", {
      lead: subtitle,
      blocks: [],
      keyFigure,
      meta: { subtitle, period: ctx.request.period },
    });
  },
};

export default def;
