// Parser selection by mime/extension. Output shape is uniform for the chunker.
// PDF: unpdf. docx: mammoth. xlsx/csv: SheetJS. pptx: jszip slide XML. html/txt: text.
import { isArabicText } from "@/lib/utils";

export type ParsedTable = {
  page: number | null;
  caption: string | null;
  columns: string[];
  rows: string[][];
};

export type ParsedDocument = {
  text: string;
  pages: { page: number; text: string }[];
  tables: ParsedTable[];
  pageCount: number;
  lang: "ar" | "en" | "mixed";
  html?: string;
};

function detectLang(text: string): "ar" | "en" | "mixed" {
  const sample = text.slice(0, 4000);
  const arabic = (sample.match(/[؀-ۿ]/g) || []).length;
  const latin = (sample.match(/[a-zA-Z]/g) || []).length;
  if (arabic > latin * 3) return "ar";
  if (latin > arabic * 3) return "en";
  return arabic > 20 && latin > 20 ? "mixed" : arabic > latin ? "ar" : "en";
}

async function parsePdf(buf: Buffer): Promise<ParsedDocument> {
  const { extractText } = await import("unpdf");
  const data = new Uint8Array(buf);
  const result = await extractText(data, { mergePages: false });
  const pagesRaw = Array.isArray(result.text) ? result.text : [String(result.text)];
  const pages = pagesRaw.map((t, i) => ({ page: i + 1, text: (t || "").trim() }));
  const text = pages.map((p) => p.text).join("\n\n");
  return {
    text,
    pages,
    tables: [],
    pageCount: result.totalPages || pages.length,
    lang: detectLang(text),
  };
}

async function parseDocx(buf: Buffer): Promise<ParsedDocument> {
  const mammoth = (await import("mammoth")).default;
  const [raw, html] = await Promise.all([
    mammoth.extractRawText({ buffer: buf }),
    mammoth.convertToHtml({ buffer: buf }),
  ]);
  const text = raw.value || "";
  // approximate pages every ~3000 chars so citations still have anchors
  const pages: { page: number; text: string }[] = [];
  for (let i = 0; i < text.length; i += 3000) {
    pages.push({ page: pages.length + 1, text: text.slice(i, i + 3000) });
  }
  if (!pages.length) pages.push({ page: 1, text });
  return {
    text,
    pages,
    tables: [],
    pageCount: pages.length,
    lang: detectLang(text),
    html: html.value,
  };
}

async function parseXlsx(buf: Buffer): Promise<ParsedDocument> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  const tables: ParsedTable[] = [];
  const textParts: string[] = [];
  let page = 0;
  for (const name of wb.SheetNames.slice(0, 20)) {
    page += 1;
    const sheet = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown as string[][];
    if (!json.length) continue;
    const nonEmpty = json.filter((r) => r.some((c) => String(c).trim() !== ""));
    if (!nonEmpty.length) continue;
    const columns = (nonEmpty[0] || []).map((c) => String(c));
    const rows = nonEmpty.slice(1, 2001).map((r) => r.map((c) => String(c)));
    tables.push({ page, caption: name, columns, rows });
    textParts.push(
      `Sheet: ${name}\n` +
        [columns.join(" | "), ...rows.slice(0, 60).map((r) => r.join(" | "))].join("\n")
    );
  }
  const text = textParts.join("\n\n");
  return {
    text,
    pages: textParts.map((t, i) => ({ page: i + 1, text: t })),
    tables,
    pageCount: page,
    lang: detectLang(text),
  };
}

function parseCsvText(text: string): { columns: string[]; rows: string[][] } {
  // Handles quoted fields with embedded separators; sniffs ; vs ,
  const firstLine = text.slice(0, 2000).split(/\r?\n/)[0] || "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) {
      cur.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.some((c) => c.trim() !== "")) rows.push(cur);
      cur = [];
    } else field += ch;
  }
  if (field !== "" || cur.length) {
    cur.push(field);
    if (cur.some((c) => c.trim() !== "")) rows.push(cur);
  }
  const columns = rows[0] || [];
  return { columns, rows: rows.slice(1) };
}

async function parseCsv(buf: Buffer): Promise<ParsedDocument> {
  const text = buf.toString("utf8");
  const { columns, rows } = parseCsvText(text);
  const preview =
    [columns.join(" | "), ...rows.slice(0, 80).map((r) => r.join(" | "))].join("\n");
  return {
    text: preview,
    pages: [{ page: 1, text: preview }],
    tables: [{ page: 1, caption: null, columns, rows: rows.slice(0, 5000) }],
    pageCount: 1,
    lang: detectLang(preview),
  };
}

async function parsePptx(buf: Buffer): Promise<ParsedDocument> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/g)?.pop()) - Number(b.match(/\d+/g)?.pop()));
  const pages: { page: number; text: string }[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    pages.push({ page: i + 1, text: texts.join(" ").trim() });
  }
  const text = pages.map((p) => p.text).join("\n\n");
  return { text, pages, tables: [], pageCount: pages.length, lang: detectLang(text) };
}

function parseHtml(buf: Buffer): ParsedDocument {
  const html = buf.toString("utf8");
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();
  return {
    text,
    pages: [{ page: 1, text }],
    tables: [],
    pageCount: 1,
    lang: detectLang(text),
  };
}

function parseTxt(buf: Buffer): ParsedDocument {
  const text = buf.toString("utf8");
  const pages: { page: number; text: string }[] = [];
  for (let i = 0; i < text.length; i += 3000) {
    pages.push({ page: pages.length + 1, text: text.slice(i, i + 3000) });
  }
  if (!pages.length) pages.push({ page: 1, text });
  return { text, pages, tables: [], pageCount: pages.length, lang: detectLang(text) };
}

export function mimeFromFilename(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    html: "text/html",
    htm: "text/html",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return map[ext] || "application/octet-stream";
}

export async function parseDocument(
  buf: Buffer,
  filename: string,
  mime?: string
): Promise<ParsedDocument> {
  const m = mime || mimeFromFilename(filename);
  try {
    if (m.includes("pdf")) return await parsePdf(buf);
    if (m.includes("wordprocessingml")) return await parseDocx(buf);
    if (m.includes("spreadsheetml") || m.includes("ms-excel")) return await parseXlsx(buf);
    if (m.includes("csv")) return await parseCsv(buf);
    if (m.includes("presentationml")) return await parsePptx(buf);
    if (m.includes("html")) return parseHtml(buf);
    if (m.startsWith("text/") || m.includes("json")) return parseTxt(buf);
  } catch (e) {
    console.error(`[parse] failed for ${filename}:`, e);
  }
  // Images and unknown types: no text
  return { text: "", pages: [], tables: [], pageCount: 0, lang: "en" };
}

export { detectLang, isArabicText };
