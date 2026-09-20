// CR08 5.3: Mandate and governance. For the Council: the published mandate
// of the General Secretariat as recorded from npc.qa, the sectors beneath
// it, and the vision, mission, values and governance bodies of the Council
// Strategy. For a department: the unit's own mandate, head, people and sub
// units. Published mandate text is quoted verbatim.
import { getCouncilPageData } from "@/server/services/council";
import { getOrgTree, type OrgUnitNode } from "@/server/services/organisation";
import { bi, type Block, type SectionDefinition } from "../spec";
import { fmt, memo, proseBlocks, section, SRC, makeSources, noteBlock, writeProse, type Prose } from "./_shared";
import { resolveScope } from "./_scope";

type MandateData = {
  isUnit: boolean;
  unit: {
    nameEn: string;
    nameAr: string;
    code: string;
    level: string;
    mandateEn: string | null;
    mandateAr: string | null;
    sourceUrl: string | null;
    headEn: string | null;
    headAr: string | null;
    headTitleEn: string | null;
    headTitleAr: string | null;
    headcount: number;
    headcountTotal: number;
    children: { nameEn: string; nameAr: string; level: string; headcount: number }[];
  } | null;
  council: {
    nameEn: string;
    nameAr: string;
    visionEn: string | null;
    visionAr: string | null;
    missionEn: string | null;
    missionAr: string | null;
    values: { en: string; ar: string }[];
    governance: { bodyEn: string; bodyAr: string; roleEn: string | null; roleAr: string | null; cadence: string | null }[];
    illustrative: boolean;
  } | null;
  unitsTotal: number;
};

function unitView(u: OrgUnitNode, raw: { mandateEn: string | null; mandateAr: string | null; mandateSourceUrl: string | null } | null, tree: OrgUnitNode[]) {
  const children = tree.filter((c) => c.parentId === u.id);
  return {
    nameEn: u.nameEn,
    nameAr: u.nameAr,
    code: u.code,
    level: u.level,
    mandateEn: raw?.mandateEn ?? null,
    mandateAr: raw?.mandateAr ?? null,
    sourceUrl: raw?.mandateSourceUrl ?? null,
    headEn: u.head?.nameEn ?? u.headNameEn,
    headAr: u.head?.nameAr ?? u.headNameAr,
    headTitleEn: u.headTitleEn,
    headTitleAr: u.headTitleAr,
    headcount: u.headcount,
    headcountTotal: u.headcountTotal,
    children: children.map((c) => ({ nameEn: c.nameEn, nameAr: c.nameAr, level: c.level, headcount: c.headcountTotal })),
  };
}

const def: SectionDefinition<MandateData> = {
  code: "mandate_governance",
  name: bi("Mandate and governance", "الولاية والحوكمة"),
  description: bi(
    "The published mandate, the structure beneath it, and the strategy's vision, mission, values and governance bodies.",
    "الولاية المنشورة، والهيكل تحتها، ورؤية الاستراتيجية ورسالتها وقيمها وهيئات حوكمتها."
  ),
  layout: "body",
  estimatedPages: 2,
  appliesTo: "all",
  async load(ctx) {
    const scope = await resolveScope(ctx);
    const tree = await memo(ctx, "org-tree", () => getOrgTree(ctx.user).catch(() => ({ units: [] as OrgUnitNode[], rootId: null })));
    const { db, schema } = await import("@/server/db/client");
    const raws = await db
      .select({ id: schema.orgUnits.id, mandateEn: schema.orgUnits.mandateEn, mandateAr: schema.orgUnits.mandateAr, mandateSourceUrl: schema.orgUnits.mandateSourceUrl })
      .from(schema.orgUnits);
    const rawById = new Map(raws.map((r) => [r.id, r]));
    const isUnit = scope.kind === "department" && Boolean(scope.unit);
    const target = isUnit
      ? tree.units.find((u) => u.id === scope.unit!.id) ?? null
      : tree.units.find((u) => u.id === tree.rootId) ?? null;
    const council = isUnit
      ? null
      : await memo(ctx, "council", () => getCouncilPageData(ctx.user).catch(() => null));
    return {
      isUnit,
      unit: target ? unitView(target, rawById.get(target.id) ?? null, tree.units) : null,
      council: council
        ? {
            nameEn: council.strategy.nameEn,
            nameAr: council.strategy.nameAr,
            visionEn: council.strategy.visionEn,
            visionAr: council.strategy.visionAr,
            missionEn: council.strategy.missionEn,
            missionAr: council.strategy.missionAr,
            values: council.strategy.values.map((v) => ({ en: v.name_en, ar: v.name_ar })),
            governance: council.governance.map((g) => ({ bodyEn: g.bodyNameEn, bodyAr: g.bodyNameAr, roleEn: g.roleEn, roleAr: g.roleAr, cadence: g.cadence })),
            illustrative: council.strategy.isIllustrative,
          }
        : null,
      unitsTotal: tree.units.filter((u) => u.isActive).length,
    };
  },
  async write(ctx, data) {
    const u = data.unit;
    const mock = (): Prose => {
      if (!u) {
        return {
          paragraphs: [
            bi(
              "The organisational structure has not been recorded in SiaNexus yet, so this section cannot describe the mandate.",
              "لم يُسجل الهيكل التنظيمي في سيا نكسس بعد، ولذلك لا يمكن لهذا القسم وصف الولاية."
            ),
          ],
        };
      }
      const paragraphs = [
        bi(
          `${u.nameEn}${u.headEn ? ` is headed by ${u.headEn}${u.headTitleEn ? `, ${u.headTitleEn}` : ""}` : ""}${u.children.length ? ` and comprises ${fmt(u.children.length)} units` : ""}, with ${fmt(u.headcountTotal)} staff recorded in SiaNexus.`,
          `${u.nameAr}${u.headAr ? ` يرأسها ${u.headAr}${u.headTitleAr ? `، ${u.headTitleAr}` : ""}` : ""}${u.children.length ? ` وتضم ${fmt(u.children.length)} وحدات` : ""}، ويعمل بها ${fmt(u.headcountTotal)} موظفاً مسجلاً في سيا نكسس.`
        ),
      ];
      if (data.council) {
        paragraphs.push(
          bi(
            `The Council's institutional strategy, ${data.council.nameEn}, sets out ${fmt(data.council.values.length)} values and is governed through ${fmt(data.council.governance.length)} bodies${data.council.illustrative ? "; the strategy on record is illustrative until the approved text replaces it" : ""}.`,
            `وتحدد الاستراتيجية المؤسسية للمجلس، ${data.council.nameAr}، ${fmt(data.council.values.length)} قيم، وتُحكم من خلال ${fmt(data.council.governance.length)} هيئات${data.council.illustrative ? "؛ والاستراتيجية المسجلة استرشادية إلى أن يحل النص المعتمد محلها" : ""}.`
          )
        );
      }
      return { paragraphs };
    };
    const { prose, live } = await writeProse(
      ctx,
      "mandate_governance",
      {
        purpose: "Explain who the reporting body is, what it is mandated to do, and how it is governed, so the reader can place the rest of the report.",
        structure: "Two paragraphs: the mandate and structure; the strategy's direction and governance. Do not paraphrase the mandate text (it is quoted below); summarise its scope in one sentence.",
        paragraphs: 2,
      },
      { unit: u ? { ...u, mandateEn: u.mandateEn?.slice(0, 1200), mandateAr: u.mandateAr?.slice(0, 1200) } : null, council: data.council, unitsTotal: data.unitsTotal },
      mock
    );
    const blocks: Block[] = [...proseBlocks(prose)];
    if (!u) {
      blocks.push(noteBlock("No organisational unit is recorded for this scope.", "لا توجد وحدة تنظيمية مسجلة لهذا النطاق."));
    } else {
      if (u.mandateEn || u.mandateAr) {
        blocks.push({
          kind: "quote",
          text: bi(u.mandateEn ?? u.mandateAr ?? "", u.mandateAr ?? u.mandateEn ?? ""),
          attribution: bi(`Published mandate, ${u.nameEn}`, `الولاية المنشورة، ${u.nameAr}`),
        });
      }
      if (u.children.length) {
        blocks.push({
          kind: "table",
          caption: bi(`Units under ${u.nameEn}`, `الوحدات التابعة لـ${u.nameAr}`),
          columns: [bi("Unit", "الوحدة"), bi("Level", "المستوى"), bi("Staff", "الموظفون")],
          rows: u.children.map((c) => [bi(c.nameEn, c.nameAr), bi(c.level.replace(/_/g, " "), c.level.replace(/_/g, " ")), bi(fmt(c.headcount), fmt(c.headcount))]),
          align: ["start", "start", "end"],
        });
      }
    }
    if (data.council) {
      const c = data.council;
      if (c.visionEn || c.visionAr) {
        blocks.push({ kind: "callout", title: bi("Vision", "الرؤية"), text: bi(c.visionEn ?? "", c.visionAr ?? ""), tone: "maroon" });
      }
      if (c.missionEn || c.missionAr) {
        blocks.push({ kind: "callout", title: bi("Mission", "الرسالة"), text: bi(c.missionEn ?? "", c.missionAr ?? ""), tone: "gulf" });
      }
      if (c.values.length) {
        blocks.push({ kind: "heading", level: 3, text: bi("Values", "القيم") });
        blocks.push({ kind: "bullets", items: c.values.map((v) => bi(v.en, v.ar)) });
      }
      if (c.governance.length) {
        blocks.push({
          kind: "table",
          caption: bi("Governance bodies", "هيئات الحوكمة"),
          columns: [bi("Body", "الهيئة"), bi("Role", "الدور"), bi("Cadence", "الوتيرة")],
          rows: c.governance.map((g) => [bi(g.bodyEn, g.bodyAr), bi(g.roleEn ?? "", g.roleAr ?? ""), bi(g.cadence ?? "", g.cadence ?? "")]),
        });
      }
    }
    return section("mandate_governance", bi("Mandate and governance", "الولاية والحوكمة"), "body", {
      lead: u
        ? bi(`What ${u.nameEn} is mandated to do and how it is governed.`, `ما أُنيط بـ${u.nameAr} وكيف تُحكم.`)
        : undefined,
      blocks,
      sources: makeSources([
        ...(u ? [{ ...SRC.organisation(), url: u.sourceUrl ?? undefined }] : []),
        ...(data.council ? [SRC.council(data.council.illustrative)] : []),
      ]),
      meta: { live, illustrative: data.council?.illustrative ?? false },
    });
  },
};

export default def;
