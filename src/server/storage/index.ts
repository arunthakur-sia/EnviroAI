// Local filesystem storage, encapsulated so Supabase Storage can replace it later.
// Layout: ${DATA_DIR}/uploads/{documentId}/{filename}, stored in the database as
// `data/uploads/...` whatever DATA_DIR is (see src/server/paths.ts).
import "@/server/server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR, isInsideDataDir, resolveDataPath, storedDataPath } from "@/server/paths";

const ROOT = UPLOADS_DIR;

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._؀-ۿ -]+/g, "_").slice(0, 150) || "file";
}

export async function put(
  documentId: string,
  filename: string,
  data: Buffer | Uint8Array
): Promise<string> {
  const dir = path.join(ROOT, documentId);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, safeName(filename));
  await fs.writeFile(file, data);
  return storedDataPath(file);
}

export async function get(storagePath: string): Promise<Buffer> {
  /* CR08 Phase A, defence in depth: only ever read inside the data directory.
     Stored paths are written by put() above, so this can only fire on a
     tampered row, which is exactly the case worth refusing. */
  const resolved = resolveDataPath(storagePath);
  if (!isInsideDataDir(resolved)) {
    throw new Error("storage path escapes the data directory");
  }
  return fs.readFile(resolved);
}

/* CR08 Phase A: what the product can actually read. An upload outside this
   list is refused with 415 rather than stored and silently never parsed. */
export const ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf",
  "docx",
  "doc",
  "xlsx",
  "xls",
  "csv",
  "txt",
  "md",
  "json",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "webp",
  // Add Knowledge voice notes
  "webm",
  "mp3",
  "m4a",
  "wav",
  "ogg",
] as const;

export function isAllowedUpload(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
}

export async function del(documentId: string): Promise<void> {
  await fs.rm(path.join(ROOT, documentId), { recursive: true, force: true });
}

export function urlFor(documentId: string): string {
  return `/api/v1/documents/${documentId}/download`;
}

export async function putText(documentId: string, name: string, text: string): Promise<string> {
  return put(documentId, name, Buffer.from(text, "utf8"));
}
