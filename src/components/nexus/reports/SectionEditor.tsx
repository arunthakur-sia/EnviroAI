"use client";
// CR08 5: manual editing of the AI text inside the review tool. One textarea
// per paragraph, bullet, numbered item, callout and quote, in both languages
// side by side; every other block kind is kept as generated. Saving sends the
// whole block list back (the API replaces the section's blocks).
import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, Label, Textarea } from "@/components/ui/primitives";
import type { BiText, Block, SectionContent } from "@/server/reports/spec";

export type SectionPatch = { lead?: BiText | null; blocks: Block[] };

function BiField({
  label,
  value,
  onChange,
  rows = 3,
  testId,
}: {
  label: string;
  value: BiText;
  onChange: (next: BiText) => void;
  rows?: number;
  testId?: string;
}) {
  const t = useTranslations("reports");
  return (
    <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">{label}</legend>
      <div>
        <Label className="sr-only">{t("report.english")}</Label>
        <Textarea
          dir="ltr"
          lang="en"
          rows={rows}
          value={value.en}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
          className="min-h-0 text-start"
          data-testid={testId ? `${testId}-en` : undefined}
          aria-label={`${label}, ${t("report.english")}`}
        />
      </div>
      <div>
        <Label className="sr-only">{t("report.arabic")}</Label>
        <Textarea
          dir="rtl"
          lang="ar"
          rows={rows}
          value={value.ar}
          onChange={(e) => onChange({ ...value, ar: e.target.value })}
          className="min-h-0 text-start"
          data-testid={testId ? `${testId}-ar` : undefined}
          aria-label={`${label}, ${t("report.arabic")}`}
        />
      </div>
    </fieldset>
  );
}

const BLOCK_LABEL: Record<string, string> = {
  paragraph: "Paragraph",
  bullets: "Bullet",
  numbered: "Item",
  callout: "Callout",
  quote: "Quote",
  heading: "Heading",
};

export function SectionEditor({
  content,
  saving,
  onSave,
  onCancel,
}: {
  content: SectionContent;
  saving: boolean;
  onSave: (patch: SectionPatch) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("reports");
  const [lead, setLead] = React.useState<BiText | null>(content.lead ?? null);
  const [blocks, setBlocks] = React.useState<Block[]>(() => JSON.parse(JSON.stringify(content.blocks)) as Block[]);

  const patchBlock = (index: number, next: Block) => setBlocks((prev) => prev.map((b, i) => (i === index ? next : b)));

  const editable = blocks.some((b) => ["paragraph", "bullets", "numbered", "callout", "quote", "heading"].includes(b.kind)) || Boolean(lead);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ lead: lead && (lead.en.trim() || lead.ar.trim()) ? lead : null, blocks });
      }}
      className="mt-3 rounded-xl border border-aqua-300 bg-aqua-100/40 p-4"
      data-testid="section-editor"
    >
      <p className="text-sm text-ink-600">{t("report.editHint")}</p>
      <div className="mt-3 space-y-4">
        {lead ? <BiField label={t("report.lead")} value={lead} onChange={setLead} rows={2} testId="editor-lead" /> : null}
        {blocks.map((b, i) => {
          const label = `${i + 1}. ${BLOCK_LABEL[b.kind] ?? b.kind}`;
          switch (b.kind) {
            case "paragraph":
              return <BiField key={i} label={label} value={b.text} onChange={(text) => patchBlock(i, { ...b, text })} rows={4} testId={`editor-block-${i}`} />;
            case "heading":
              return <BiField key={i} label={label} value={b.text} onChange={(text) => patchBlock(i, { ...b, text })} rows={1} testId={`editor-block-${i}`} />;
            case "callout":
              return <BiField key={i} label={label} value={b.text} onChange={(text) => patchBlock(i, { ...b, text })} rows={3} testId={`editor-block-${i}`} />;
            case "quote":
              return <BiField key={i} label={label} value={b.text} onChange={(text) => patchBlock(i, { ...b, text })} rows={3} testId={`editor-block-${i}`} />;
            case "bullets":
            case "numbered":
              return (
                <div key={i} className="space-y-2">
                  {b.items.map((item, j) => (
                    <BiField
                      key={j}
                      label={`${label} ${j + 1}`}
                      value={item}
                      onChange={(text) => patchBlock(i, { ...b, items: b.items.map((x, k) => (k === j ? text : x)) })}
                      rows={2}
                      testId={`editor-block-${i}-${j}`}
                    />
                  ))}
                </div>
              );
            default:
              return (
                <p key={i} className="rounded-lg border border-dashed border-mist-300 bg-white/60 px-3 py-2 text-xs text-ink-400">
                  {t("report.notEditable", { kind: b.kind })}
                </p>
              );
          }
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" loading={saving} disabled={!editable} data-testid="editor-save">
          {saving ? t("report.saving") : t("report.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} data-testid="editor-cancel">
          {t("report.cancel")}
        </Button>
      </div>
    </form>
  );
}
