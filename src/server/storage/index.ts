// Local filesystem storage, encapsulated so Supabase Storage can replace it later.
// Layout: ./data/uploads/{documentId}/{filename}
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "data", "uploads");

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
  return path.relative(path.resolve(process.cwd()), file).replace(/\\/g, "/");
}

export async function get(storagePath: string): Promise<Buffer> {
  return fs.readFile(path.resolve(process.cwd(), storagePath));
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
