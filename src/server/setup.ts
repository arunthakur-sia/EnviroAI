/**
 * The one-time restore path: how a data bundle reaches a deployment that has
 * no shell and no CLI.
 *
 * The Railway CLI is a native binary and cannot run on the machine this
 * product is built on, so `railway up` is not available to put a 120 MB file
 * on the volume. Instead the running app accepts the bundle over HTTP, once,
 * from someone holding a token that only exists while the operator wants this
 * door open.
 *
 * The rules that make that safe:
 *
 *   - The door does not exist unless `SETUP_TOKEN` is set to at least 32
 *     characters. With no token the page and every route answer 404, not 403:
 *     a 403 would confirm the route is there.
 *   - The token is compared in constant time, over hashes, so neither its
 *     value nor its length leaks through timing.
 *   - Five wrong guesses from one address close the door for fifteen minutes.
 *   - The operator deletes `SETUP_TOKEN` in Railway after the upload, which
 *     removes the route entirely on the next deploy.
 *
 * The upload is chunked because an office connection and a corporate proxy
 * will not carry 120 MB in one request. Chunks append to a `.part` file next
 * to a small JSON sidecar recording what has been received, so a refreshed
 * page resumes where it stopped rather than starting again.
 */
import "@/server/server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { IMPORT_DIR } from "@/server/paths";

export const BUNDLE_NAME = "enviroai-data.tar.gz";
export const PART_NAME = `${BUNDLE_NAME}.part`;
export const META_NAME = `${BUNDLE_NAME}.part.json`;
/** 8 MB: large enough that a 120 MB bundle is 15 requests, small enough that a
    proxy with a body limit and a slow line both survive one. */
export const CHUNK_SIZE = 8 * 1024 * 1024;

export const bundlePath = () => path.join(IMPORT_DIR, BUNDLE_NAME);
export const partPath = () => path.join(IMPORT_DIR, PART_NAME);
export const metaPath = () => path.join(IMPORT_DIR, META_NAME);

/* ------------------------------------------------------------------ */
/* the door                                                             */
/* ------------------------------------------------------------------ */

/** The configured token, or null when the restore path is closed. */
export function setupToken(): string | null {
  const raw = process.env.SETUP_TOKEN?.trim();
  if (!raw || raw.length < 32) return null;
  return raw;
}

/** True when the restore page and its routes exist at all. */
export function setupEnabled(): boolean {
  return setupToken() !== null;
}

/** Constant time, and over hashes so the comparison cannot leak the length. */
function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* Attempts live in memory. The database may be empty or mid-restore when this
   runs, and a restart resetting the counter is acceptable: a restart is not
   something an attacker can ask for. */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map<string, { failures: number; lockedUntil: number }>();

export type TokenCheck =
  | { ok: true }
  | { ok: false; reason: "locked"; retryAfterSeconds: number }
  | { ok: false; reason: "wrong"; remaining: number };

export function checkToken(presented: string | null, clientKey: string): TokenCheck {
  const expected = setupToken();
  if (!expected) return { ok: false, reason: "wrong", remaining: 0 };

  const now = Date.now();
  const state = attempts.get(clientKey) ?? { failures: 0, lockedUntil: 0 };
  if (state.lockedUntil > now) {
    return { ok: false, reason: "locked", retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000) };
  }
  if (presented && sameSecret(presented, expected)) {
    attempts.delete(clientKey);
    return { ok: true };
  }
  state.failures += 1;
  if (state.failures >= MAX_ATTEMPTS) {
    state.failures = 0;
    state.lockedUntil = now + LOCK_MS;
    attempts.set(clientKey, state);
    return { ok: false, reason: "locked", retryAfterSeconds: Math.ceil(LOCK_MS / 1000) };
  }
  attempts.set(clientKey, state);
  return { ok: false, reason: "wrong", remaining: MAX_ATTEMPTS - state.failures };
}

/** Who is guessing. Behind Railway's proxy the first forwarded address is the
    caller; locally there is no header and every request shares one bucket. */
export function clientKeyOf(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "local";
}

/* ------------------------------------------------------------------ */
/* the upload                                                           */
/* ------------------------------------------------------------------ */

export type UploadMeta = {
  name: string;
  size: number;
  sha256: string;
  chunkSize: number;
  received: number;
  startedAt: string;
};

export async function readMeta(): Promise<UploadMeta | null> {
  try {
    return JSON.parse(await fsp.readFile(metaPath(), "utf8")) as UploadMeta;
  } catch {
    return null;
  }
}

async function writeMeta(meta: UploadMeta): Promise<void> {
  await fsp.writeFile(metaPath(), JSON.stringify(meta, null, 2), "utf8");
}

export async function clearPartial(): Promise<void> {
  await fsp.rm(partPath(), { force: true });
  await fsp.rm(metaPath(), { force: true });
}

/**
 * Begins an upload, or reports where a previous one stopped. A second call
 * with the same size and digest resumes; anything else starts over, because a
 * different file cannot be appended to a half-written one.
 */
export async function beginUpload(input: {
  name: string;
  size: number;
  sha256: string;
}): Promise<{ resumeFrom: number; chunkSize: number; totalChunks: number }> {
  await fsp.mkdir(IMPORT_DIR, { recursive: true });
  const totalChunks = Math.max(1, Math.ceil(input.size / CHUNK_SIZE));
  const existing = await readMeta();
  if (
    existing &&
    existing.size === input.size &&
    existing.sha256.toLowerCase() === input.sha256.toLowerCase() &&
    existing.chunkSize === CHUNK_SIZE
  ) {
    /* Trust the file on disk over the sidecar: a crash between the append and
       the sidecar write would otherwise resume one chunk too late and corrupt
       the result. */
    let onDisk = 0;
    try {
      onDisk = (await fsp.stat(partPath())).size;
    } catch {
      onDisk = 0;
    }
    const complete = Math.floor(onDisk / CHUNK_SIZE);
    const received = Math.min(existing.received, complete);
    if (received !== existing.received) await writeMeta({ ...existing, received });
    if (onDisk !== received * CHUNK_SIZE) await fsp.truncate(partPath(), received * CHUNK_SIZE);
    return { resumeFrom: received, chunkSize: CHUNK_SIZE, totalChunks };
  }
  await clearPartial();
  await fsp.writeFile(partPath(), Buffer.alloc(0));
  await writeMeta({
    name: input.name,
    size: input.size,
    sha256: input.sha256.toLowerCase(),
    chunkSize: CHUNK_SIZE,
    received: 0,
    startedAt: new Date().toISOString(),
  });
  return { resumeFrom: 0, chunkSize: CHUNK_SIZE, totalChunks };
}

export type ChunkResult =
  | { ok: true; received: number; duplicate: boolean }
  | { ok: false; error: string; expectedIndex?: number };

/** Appends one chunk. Chunks arrive in order; a repeat of the last one is
    accepted and ignored, which is what makes a client-side retry safe. */
export async function appendChunk(index: number, body: Buffer): Promise<ChunkResult> {
  const meta = await readMeta();
  if (!meta) return { ok: false, error: "no_upload_in_progress" };
  if (index === meta.received - 1) {
    return { ok: true, received: meta.received, duplicate: true };
  }
  if (index !== meta.received) {
    return { ok: false, error: "out_of_order", expectedIndex: meta.received };
  }
  const offset = index * meta.chunkSize;
  if (offset + body.length > meta.size) return { ok: false, error: "too_long" };
  const expected = Math.min(meta.chunkSize, meta.size - offset);
  if (body.length !== expected) return { ok: false, error: "wrong_chunk_size" };

  const handle = await fsp.open(partPath(), "r+");
  try {
    await handle.write(body, 0, body.length, offset);
  } finally {
    await handle.close();
  }
  const received = meta.received + 1;
  await writeMeta({ ...meta, received });
  return { ok: true, received, duplicate: false };
}

async function sha256Of(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(file);
    stream.on("error", reject);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export type FinishResult =
  | { ok: true; bytes: number; sha256: string }
  | { ok: false; error: string; detail?: string };

/** Verifies the whole file and puts it where the boot script looks for it. */
export async function finishUpload(): Promise<FinishResult> {
  const meta = await readMeta();
  if (!meta) return { ok: false, error: "no_upload_in_progress" };
  let size = 0;
  try {
    size = (await fsp.stat(partPath())).size;
  } catch {
    return { ok: false, error: "no_file" };
  }
  if (size !== meta.size) {
    return { ok: false, error: "size_mismatch", detail: `${size} received, ${meta.size} declared` };
  }
  const digest = await sha256Of(partPath());
  if (digest !== meta.sha256) {
    /* A bundle that does not match its digest is worse than no bundle: the
       boot script would unpack it over the volume. Start again. */
    await clearPartial();
    return { ok: false, error: "checksum_mismatch", detail: "the upload was discarded" };
  }
  await fsp.rm(bundlePath(), { force: true });
  await fsp.rename(partPath(), bundlePath());
  await fsp.rm(metaPath(), { force: true });
  return { ok: true, bytes: size, sha256: digest };
}
