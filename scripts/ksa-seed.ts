/* eslint-disable no-console */
// EnviroAI KSA modules seed: the Source Library and the Regulatory Overview.
// Idempotent: every row is keyed by a stable id and upserted.
//
// Sources and verification notes come from scripts/seed-content/ksa-sources.json,
// generated once from KSA_Environmental_Data_Source_Databank.xlsx (the seed does
// not read the workbook at runtime). URLs and notes are carried verbatim, trimmed.
//
// Integrity: the databank lists sources, not individual decrees. Regulation and
// timeline rows that the databank backs are linked to their source row. Every
// other row is a placeholder flagged is_illustrative=1 and shown as such in the
// app. No decree number or date below is presented as fact unless flagged.
import { loadEnv } from "../src/lib/load-env";
loadEnv();

import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "./migrate";

const now = () => new Date().toISOString();

type SrcJson = {
  id: string;
  category: string;
  sortOrder: number;
  name: string;
  organization: string;
  subCategory: string;
  mainUrl: string;
  dataUrl: string;
  dataHint: string;
  formats: string;
  languages: string;
  access: string;
  accessTags: string[];
  unverified: boolean;
  notes: string;
};
type VerJson = {
  id: string;
  sortOrder: number;
  item: string;
  tab: string;
  category: string | null;
  issue: string;
  action: string;
  sourceIds: string[];
};

const REGULATORS = [
  { code: "MEWA", icon: "landmark", shortEn: "MEWA", shortAr: "وزارة البيئة", nameEn: "Ministry of Environment, Water and Agriculture", nameAr: "وزارة البيئة والمياه والزراعة", website: "https://www.mewa.gov.sa/en" },
  { code: "NCEC", icon: "shield-check", shortEn: "NCEC", shortAr: "المركز الوطني للالتزام البيئي", nameEn: "National Center for Environmental Compliance", nameAr: "المركز الوطني للالتزام البيئي", website: "https://ncec.gov.sa" },
  { code: "NCW", icon: "paw-print", shortEn: "NCW", shortAr: "المركز الوطني للحياة الفطرية", nameEn: "National Center for Wildlife", nameAr: "المركز الوطني للحياة الفطرية", website: "https://ncw.gov.sa/en/about_NCW" },
  { code: "NCVC", icon: "sprout", shortEn: "NCVC", shortAr: "المركز الوطني للغطاء النباتي", nameEn: "National Center for Vegetation Cover Development and Combating Desertification", nameAr: "المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر", website: "https://ncvc.gov.sa/en/AboutCenter/Pages/default.aspx" },
  { code: "MWAN", icon: "recycle", shortEn: "MWAN", shortAr: "المركز الوطني لإدارة النفايات", nameEn: "National Center for Waste Management", nameAr: "المركز الوطني لإدارة النفايات", website: "https://mwan.gov.sa/en" },
  { code: "ENVFUND", icon: "coins", shortEn: "Environment Fund", shortAr: "صندوق البيئة", nameEn: "Environment Fund", nameAr: "صندوق البيئة", roleEn: "Development and financing of environmental projects", roleAr: "تنمية وتمويل المشاريع البيئية", website: null },
] as const;

type Reg = {
  id: string;
  titleEn: string;
  titleAr?: string;
  regulatorCode?: string;
  issuerLabel?: string;
  instrumentType: "law" | "royal_decree" | "cabinet_resolution" | "executive_regulation" | "strategy" | "library";
  reference?: string;
  gregorianDate?: string;
  hijriDate?: string;
  status?: "active" | "superseded";
  documentUrl?: string;
  sourceId?: string;
  isIllustrative: boolean;
  notesEn?: string;
  notesAr?: string;
};

function byName(sources: SrcJson[], name: string): SrcJson {
  const s = sources.find((x) => x.name === name);
  if (!s) throw new Error(`databank source not found: ${name}`);
  return s;
}

function buildRegulations(sources: SrcJson[]): Reg[] {
  const rules = byName(sources, "MEWA Rules & Regulations Library");
  const nes = byName(sources, "MEWA National Environment Strategy (NES)");
  const ncec = byName(sources, "National Center for Environmental Compliance (NCEC)");
  const mwan = byName(sources, "National Center for Waste Management (MWAN)");
  const saso = byName(sources, "SASO Technical Regulations Library");
  const nws = byName(sources, "National Water Strategy 2030");
  const ILLUS_AR = "مثال توضيحي. لم يتم التحقق من هذا الصك في قاعدة المصادر.";
  const ILLUS_EN = "Illustrative placeholder. This instrument is not confirmed in the source databank.";
  return [
    /* Backed by the databank: libraries and strategies, no invented decree numbers or dates */
    { id: "ksa-reg-mewa-library", titleEn: "MEWA Rules and Regulations Library", titleAr: "مكتبة الأنظمة واللوائح في وزارة البيئة والمياه والزراعة", regulatorCode: "MEWA", instrumentType: "library", documentUrl: rules.dataUrl, sourceId: rules.id, isIllustrative: false, notesEn: rules.notes },
    { id: "ksa-reg-ncec-library", titleEn: "NCEC regulations and guides library", regulatorCode: "NCEC", instrumentType: "library", documentUrl: ncec.mainUrl, sourceId: ncec.id, isIllustrative: false, notesEn: ncec.notes },
    { id: "ksa-reg-mwan-strategy", titleEn: "2040 National Waste Management Strategy", regulatorCode: "MWAN", instrumentType: "strategy", documentUrl: mwan.mainUrl, sourceId: mwan.id, isIllustrative: false, notesEn: mwan.notes },
    { id: "ksa-reg-nes", titleEn: "National Environment Strategy (executive summary)", titleAr: "الاستراتيجية الوطنية للبيئة (الملخص التنفيذي)", regulatorCode: "MEWA", instrumentType: "strategy", documentUrl: nes.dataUrl, sourceId: nes.id, isIllustrative: false, notesEn: nes.notes },
    { id: "ksa-reg-nws", titleEn: "National Water Strategy 2030", titleAr: "الاستراتيجية الوطنية للمياه 2030", regulatorCode: "MEWA", instrumentType: "strategy", documentUrl: nws.mainUrl, sourceId: nws.id, isIllustrative: false, notesEn: "Full PDF not confirmed live on the official MEWA page; see the verification note in the Source Library." },
    { id: "ksa-reg-saso-tech", titleEn: "SASO Technical Regulations Library", regulatorCode: undefined, issuerLabel: "SASO", instrumentType: "library", documentUrl: saso.dataUrl, sourceId: saso.id, isIllustrative: false, notesEn: saso.notes },
    /* Illustrative placeholders: the layout of the mockup, not verified instruments */
    { id: "ksa-reg-ill-env-law", titleEn: "Environmental Law", titleAr: "نظام البيئة", regulatorCode: "MEWA", instrumentType: "royal_decree", reference: "Royal Decree M/165", gregorianDate: "2020-07-10", hijriDate: "19/11/1441", status: "active", isIllustrative: true, notesEn: ILLUS_EN, notesAr: ILLUS_AR },
    { id: "ksa-reg-ill-waste-exec", titleEn: "Executive Regulations for Waste Management", titleAr: "اللائحة التنفيذية لإدارة النفايات", regulatorCode: "MWAN", instrumentType: "executive_regulation", gregorianDate: "2022-01-04", hijriDate: "01/06/1443", status: "active", isIllustrative: true, notesEn: ILLUS_EN, notesAr: ILLUS_AR },
    { id: "ksa-reg-ill-cabinet-gov", titleEn: "Cabinet Resolution on Environmental Governance", titleAr: "قرار مجلس الوزراء بشأن الحوكمة البيئية", regulatorCode: "MEWA", instrumentType: "cabinet_resolution", gregorianDate: "2020-09-24", hijriDate: "07/02/1442", status: "superseded", isIllustrative: true, notesEn: ILLUS_EN, notesAr: ILLUS_AR },
    { id: "ksa-reg-ill-protected-areas", titleEn: "Protected Areas Regulation", titleAr: "لائحة المناطق المحمية", regulatorCode: "NCW", instrumentType: "executive_regulation", gregorianDate: "2022-12-06", hijriDate: "12/05/1444", status: "active", isIllustrative: true, notesEn: ILLUS_EN, notesAr: ILLUS_AR },
    { id: "ksa-reg-ill-ncec-compliance", titleEn: "Environmental Compliance and Inspection Regulations", titleAr: "لائحة الالتزام البيئي والتفتيش", regulatorCode: "NCEC", instrumentType: "executive_regulation", status: "active", isIllustrative: true, notesEn: ILLUS_EN, notesAr: ILLUS_AR },
    { id: "ksa-reg-ill-vegetation", titleEn: "Vegetation Cover and Anti-Desertification Regulation", titleAr: "لائحة الغطاء النباتي ومكافحة التصحر", regulatorCode: "NCVC", instrumentType: "executive_regulation", status: "active", isIllustrative: true, notesEn: ILLUS_EN, notesAr: ILLUS_AR },
    { id: "ksa-reg-ill-fund", titleEn: "Environment Fund Financing Rules", titleAr: "قواعد التمويل في صندوق البيئة", regulatorCode: "ENVFUND", instrumentType: "executive_regulation", status: "active", isIllustrative: true, notesEn: ILLUS_EN, notesAr: ILLUS_AR },
  ];
}

const TIMELINE = [
  { id: "ksa-tl-1", kind: "decision", g: "2020-07-10", h: "19/11/1441", en: "Royal Decree M/165: Environmental Law approved.", ar: "الموافقة على نظام البيئة بالمرسوم الملكي م/165.", reg: "ksa-reg-ill-env-law" },
  { id: "ksa-tl-2", kind: "decision", g: "2020-09-24", h: "07/02/1442", en: "Cabinet Resolution on environmental governance issued.", ar: "صدور قرار مجلس الوزراء بشأن الحوكمة البيئية.", reg: "ksa-reg-ill-cabinet-gov" },
  { id: "ksa-tl-3", kind: "law", g: "2022-01-04", h: "01/06/1443", en: "Executive regulations published.", ar: "نشر اللوائح التنفيذية.", reg: "ksa-reg-ill-waste-exec" },
  { id: "ksa-tl-4", kind: "decision", g: "2022-05-16", h: "15/10/1443", en: "NCEC operationalized and began mandate execution.", ar: "بدء المركز الوطني للالتزام البيئي أعماله وتنفيذ مهامه.", reg: null },
  { id: "ksa-tl-5", kind: "event", g: "2023-03-04", h: "12/08/1444", en: "Environment Fund established.", ar: "تأسيس صندوق البيئة.", reg: null },
  { id: "ksa-tl-6", kind: "event", g: "2024-08-06", h: "01/02/1446", en: "Compliance rollout milestone.", ar: "محطة في طرح متطلبات الالتزام.", reg: null },
] as const;

async function main() {
  await migrate({ quiet: true });
  const { db, schema } = await import("../src/server/db/client");
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "scripts", "seed-content", "ksa-sources.json"), "utf8")
  ) as { sources: SrcJson[]; verification: VerJson[] };
  const ts = now();
  const nn = (s: string) => (s && s.trim() ? s.trim() : null);

  for (const s of raw.sources) {
    const row = {
      id: s.id,
      category: s.category,
      sortOrder: s.sortOrder,
      nameEn: s.name,
      organizationEn: nn(s.organization),
      subCategoryEn: nn(s.subCategory),
      mainUrl: nn(s.mainUrl),
      dataUrl: nn(s.dataUrl),
      dataHint: nn(s.dataHint),
      formats: nn(s.formats),
      languages: nn(s.languages),
      access: nn(s.access),
      accessTags: JSON.stringify(s.accessTags),
      unverified: s.unverified ? 1 : 0,
      notesEn: nn(s.notes),
      updatedAt: ts,
    };
    await db
      .insert(schema.ksaSources)
      .values({ ...row, createdAt: ts })
      .onConflictDoUpdate({ target: schema.ksaSources.id, set: row });
  }
  for (const v of raw.verification) {
    const row = {
      sortOrder: v.sortOrder,
      item: v.item,
      tab: nn(v.tab),
      category: v.category,
      issue: v.issue,
      action: nn(v.action),
      sourceIdsJson: JSON.stringify(v.sourceIds),
    };
    await db
      .insert(schema.ksaVerificationNotes)
      .values({ id: v.id, ...row, createdAt: ts })
      .onConflictDoUpdate({ target: schema.ksaVerificationNotes.id, set: row });
  }

  let order = 0;
  for (const r of REGULATORS) {
    order++;
    const row = {
      code: r.code,
      sortOrder: order,
      shortEn: r.shortEn,
      shortAr: r.shortAr,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      roleEn: "roleEn" in r ? r.roleEn : null,
      roleAr: "roleAr" in r ? r.roleAr : null,
      icon: r.icon,
      website: r.website,
    };
    await db
      .insert(schema.ksaRegulators)
      .values({ id: `ksa-regulator-${r.code.toLowerCase()}`, ...row, createdAt: ts })
      .onConflictDoUpdate({ target: schema.ksaRegulators.code, set: row });
  }

  order = 0;
  for (const g of buildRegulations(raw.sources)) {
    order++;
    const row = {
      titleEn: g.titleEn,
      titleAr: g.titleAr ?? null,
      regulatorCode: g.regulatorCode ?? null,
      issuerLabel: g.issuerLabel ?? null,
      instrumentType: g.instrumentType,
      reference: g.reference ?? null,
      gregorianDate: g.gregorianDate ?? null,
      hijriDate: g.hijriDate ?? null,
      status: g.status ?? "active",
      documentUrl: g.documentUrl ?? null,
      sourceId: g.sourceId ?? null,
      isIllustrative: g.isIllustrative ? 1 : 0,
      notesEn: g.notesEn ?? null,
      notesAr: g.notesAr ?? null,
      sortOrder: order,
      updatedAt: ts,
    };
    await db
      .insert(schema.ksaRegulations)
      .values({ id: g.id, ...row, createdAt: ts })
      .onConflictDoUpdate({ target: schema.ksaRegulations.id, set: row });
  }

  order = 0;
  for (const e of TIMELINE) {
    order++;
    const row = {
      kind: e.kind,
      sortOrder: order,
      gregorianDate: e.g,
      hijriDate: e.h,
      titleEn: e.en,
      titleAr: e.ar,
      // the databank confirms none of these events, so all six are placeholders
      isIllustrative: 1,
      regulationId: e.reg,
    };
    await db
      .insert(schema.ksaTimelineEvents)
      .values({ id: e.id, ...row, createdAt: ts })
      .onConflictDoUpdate({ target: schema.ksaTimelineEvents.id, set: row });
  }

  // Grant the two new portals to roles that store an explicit portal list.
  // A NULL list means "role default", which the app already extends.
  const roles = await db.select().from(schema.roles);
  for (const r of roles) {
    if (!r.portalsJson) continue;
    try {
      const list = JSON.parse(r.portalsJson);
      if (!Array.isArray(list)) continue;
      const next = [...list];
      for (const p of ["regulatory", "sources"]) if (!next.includes(p)) next.push(p);
      if (next.length !== list.length) {
        await db.update(schema.roles).set({ portalsJson: JSON.stringify(next) }).where(eq(schema.roles.id, r.id));
      }
    } catch {
      /* leave an unparsable value alone */
    }
  }

  console.log(`ksa-seed: ${raw.sources.length} sources, ${raw.verification.length} verification notes, ${REGULATORS.length} regulators, regulations and ${TIMELINE.length} timeline events`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
