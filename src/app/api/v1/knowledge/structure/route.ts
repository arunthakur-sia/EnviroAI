// CR01 5: Add Knowledge step 1. Multipart in (notes, whereFrom, files, urls),
// structured bilingual items out. Files are stored immediately so document items
// can be published from them.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { parseDocument, mimeFromFilename } from "@/server/ingest/parse";
import { structureKnowledge, type KnowledgeItem } from "@/server/ai/knowledge_structurer";
import { fetchPageText } from "@/server/scan/manual";
import { put } from "@/server/storage";
import { newId } from "@/lib/ids";
import { audit } from "@/server/auth/audit";

export const maxDuration = 120;

const IMAGE_MEDIA = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!can(user, "create", "lessons") && !can(user, "create", "vault")) {
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });

  const notes = String(form.get("notes") ?? "");
  const whereFrom = String(form.get("whereFrom") ?? "");
  const urlsRaw = String(form.get("urls") ?? "");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  const parsedFiles: { filename: string; text: string; mime: string }[] = [];
  const images: { filename: string; mediaType: string; base64: string }[] = [];
  const fileRefs: {
    filename: string;
    storagePath: string;
    mime: string;
    sizeBytes: number;
  }[] = [];

  for (const file of files.slice(0, 8)) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 40 * 1024 * 1024) continue;
    const mime = file.type || mimeFromFilename(file.name);
    const storagePath = await put(newId(), file.name, buf);
    fileRefs.push({ filename: file.name, storagePath, mime, sizeBytes: buf.length });
    if (IMAGE_MEDIA.has(mime)) {
      images.push({ filename: file.name, mediaType: mime, base64: buf.toString("base64") });
    } else {
      const parsed = await parseDocument(buf, file.name, mime);
      parsedFiles.push({ filename: file.name, text: parsed.text.slice(0, 20000), mime });
    }
  }

  const pages: { url: string; title: string; text: string }[] = [];
  const urls = urlsRaw
    .split(/\r?\n| \| /)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u))
    .slice(0, 6);
  for (const url of urls) {
    try {
      const page = await fetchPageText(url);
      pages.push({ url, title: page.title, text: page.text });
    } catch {
      pages.push({ url, title: url, text: "" });
    }
  }

  if (!notes.trim() && !parsedFiles.length && !images.length && !pages.some((p) => p.text)) {
    return NextResponse.json({ data: null, error: "nothing_to_structure" }, { status: 422 });
  }

  const { items, live } = await structureKnowledge({
    notes,
    whereFrom,
    parsedFiles,
    images,
    pages,
  });

  // attach file refs to document items (first unassigned file per document item)
  const unassigned = [...fileRefs];
  const withRefs: KnowledgeItem[] = items.map((item) => {
    if (item.types.includes("document") && unassigned.length) {
      const ref = unassigned.shift()!;
      return { ...item, file_ref: ref };
    }
    return item;
  });

  await audit(user.id, "create", "knowledge_submission", undefined, {
    items: withRefs.length,
    live,
    files: files.length,
    urls: urls.length,
  });

  return NextResponse.json({
    data: { items: withRefs, live, whereFrom, fileRefs },
    error: null,
  });
}
