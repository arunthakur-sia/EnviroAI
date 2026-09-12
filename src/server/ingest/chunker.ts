// Heading-aware chunker: target ~500 tokens (~1900 chars) with ~80 token overlap,
// page anchors preserved, tables kept whole as their own chunks.
import type { ParsedDocument, ParsedTable } from "./parse";

export type Chunk = {
  index: number;
  pageFrom: number | null;
  pageTo: number | null;
  heading: string | null;
  text: string;
  lang: string;
  tokenCount: number;
};

const TARGET_CHARS = 1900;
const OVERLAP_CHARS = 320;
const MIN_CHARS = 200;

function estimateTokens(s: string): number {
  return Math.ceil(s.length / 3.8);
}

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/^\d+(\.\d+)*\s+\S/.test(t)) return true; // 3.2 Something
  if (/^(chapter|section|outcome|الفصل|الباب|النتيجة|القسم)\b/i.test(t)) return true;
  if (t === t.toUpperCase() && /[A-Z]{4,}/.test(t)) return true;
  return false;
}

export function chunkDocument(parsed: ParsedDocument): Chunk[] {
  const chunks: Chunk[] = [];
  let heading: string | null = null;
  let buf = "";
  let bufPageFrom: number | null = null;
  let bufPageTo: number | null = null;

  const flush = () => {
    const text = buf.trim();
    if (text.length >= MIN_CHARS) {
      chunks.push({
        index: chunks.length,
        pageFrom: bufPageFrom,
        pageTo: bufPageTo,
        heading,
        text,
        lang: detectChunkLang(text),
        tokenCount: estimateTokens(text),
      });
      buf = text.slice(-OVERLAP_CHARS);
    } else if (text.length > 0) {
      // too small to stand alone; keep accumulating
      return;
    } else {
      buf = "";
    }
  };

  for (const page of parsed.pages) {
    const paragraphs = page.text.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
    for (const para of paragraphs) {
      if (looksLikeHeading(para)) {
        if (buf.trim().length >= MIN_CHARS) {
          flush();
          buf = "";
        }
        heading = para.slice(0, 120);
        bufPageFrom = page.page;
        bufPageTo = page.page;
        continue;
      }
      if (bufPageFrom === null) bufPageFrom = page.page;
      bufPageTo = page.page;
      buf += (buf ? "\n" : "") + para;
      if (buf.length >= TARGET_CHARS) {
        flush();
        bufPageFrom = page.page;
      }
    }
  }
  if (buf.trim().length >= MIN_CHARS) {
    const text = buf.trim();
    chunks.push({
      index: chunks.length,
      pageFrom: bufPageFrom,
      pageTo: bufPageTo,
      heading,
      text,
      lang: detectChunkLang(text),
      tokenCount: estimateTokens(text),
    });
  }

  // Tables become their own chunks with a markdown rendering, never split.
  for (const table of parsed.tables) {
    const md = tableToMarkdown(table);
    if (md.length < 40) continue;
    chunks.push({
      index: chunks.length,
      pageFrom: table.page,
      pageTo: table.page,
      heading: table.caption,
      text: md.slice(0, 6000),
      lang: detectChunkLang(md),
      tokenCount: estimateTokens(md),
    });
  }
  return chunks;
}

function detectChunkLang(text: string): string {
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return arabic > latin ? "ar" : "en";
}

export function tableToMarkdown(table: ParsedTable): string {
  const cols = table.columns.length ? table.columns : table.rows[0] || [];
  const rows = table.columns.length ? table.rows : table.rows.slice(1);
  const lines = [
    (table.caption ? `${table.caption}\n` : "") + "| " + cols.join(" | ") + " |",
    "| " + cols.map(() => "---").join(" | ") + " |",
    ...rows.slice(0, 40).map((r) => "| " + r.join(" | ") + " |"),
  ];
  return lines.join("\n");
}
