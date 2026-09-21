/**
 * Where everything the app writes at runtime lives.
 *
 * One rule, in one place: every runtime file (the SQLite database, uploads,
 * generated reports, podcast audio, the session secret, temporary files) sits
 * under DATA_DIR, which is `./data` locally and the mounted volume in a
 * container. Nothing else in `src/` may join `process.cwd()` with "data".
 *
 * Paths the app reads but never writes stay where the repository put them and
 * are deliberately NOT routed through here: `sources/` (the public documents
 * the seed ingests), `public/` (fonts and brand assets), `src/server/ai/prompts`
 * and `scripts/seed-content`. Those ship with the code, not with the volume.
 *
 * Stored paths keep their `data/` prefix. The database holds thousands of rows
 * that say `data/uploads/<id>/<file>`, written when the data directory was
 * always `./data`; `resolveDataPath` maps that prefix onto DATA_DIR so those
 * rows keep resolving after the directory moves, with no migration.
 *
 * The same rule is repeated in plain JavaScript in `scripts/lib/paths.mjs`,
 * for the boot script and the other scripts that cannot import TypeScript.
 * `tests/paths.test.ts` asserts the two agree.
 */
import fs from "node:fs";
import path from "node:path";

/** The prefix a stored path carries, whatever DATA_DIR happens to be. */
export const STORED_PREFIX = "data";

function resolveDataDir(): string {
  const fromEnv = process.env.DATA_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), STORED_PREFIX);
}

/** The runtime data root: `$DATA_DIR`, or `./data` when it is not set. */
export const DATA_DIR = resolveDataDir();

/** An absolute path inside the data directory. */
export function dataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments);
}

/**
 * An absolute path for a path stored in the database. Accepts the `data/...`
 * form every existing row uses, a bare relative form (`uploads/...`), and an
 * absolute path (returned as it is, for rows written by an older build).
 */
export function resolveDataPath(stored: string): string {
  if (path.isAbsolute(stored)) return path.resolve(stored);
  const clean = stored.replace(/\\/g, "/").replace(/^\.\//, "");
  const rel = clean === STORED_PREFIX
    ? ""
    : clean.startsWith(`${STORED_PREFIX}/`)
      ? clean.slice(STORED_PREFIX.length + 1)
      : clean;
  return path.resolve(DATA_DIR, rel);
}

/** The `data/...` string to store for a file inside the data directory. */
export function storedDataPath(absolute: string): string {
  const rel = path.relative(DATA_DIR, path.resolve(absolute)).replace(/\\/g, "/");
  return `${STORED_PREFIX}/${rel}`;
}

/** True when an absolute path is the data directory or sits inside it. */
export function isInsideDataDir(absolute: string): boolean {
  const resolved = path.resolve(absolute);
  return resolved === DATA_DIR || resolved.startsWith(DATA_DIR + path.sep);
}

/** The named places inside the data directory, so nothing spells them twice. */
export const UPLOADS_DIR = dataPath("uploads");
export const REPORTS_DIR = dataPath("reports");
export const PODCASTS_DIR = dataPath("podcasts");
export const IMPORT_DIR = dataPath("import");
export const TMP_DIR = dataPath("tmp");
export const DB_PATH = dataPath("nexus.db");
export const SESSION_SECRET_FILE = dataPath("session-secret.txt");

/** Every directory the app expects to exist before it serves a request. */
export const DATA_SUBDIRS = [
  "uploads",
  "reports",
  "reports/module",
  "reports/handover",
  "reports/previews",
  "podcasts",
  "import",
  "tmp",
] as const;

export function ensureDataDirs(): void {
  for (const sub of DATA_SUBDIRS) fs.mkdirSync(dataPath(sub), { recursive: true });
}

/* ------------------------------------------------------------------ */
/* Absolute URLs                                                        */
/* ------------------------------------------------------------------ */

/**
 * The public origin, from APP_URL, with no trailing slash. Null when it is not
 * set, which is the local case: the browser composes absolute links from
 * `window.location.origin` and is right to.
 */
export function appUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/**
 * An absolute URL for a path the app hands to someone outside the browser
 * session (an invitation, an external handover link). Falls back to the path
 * itself when APP_URL is not set, which keeps local behaviour unchanged.
 */
export function absoluteUrl(pathname: string): string {
  const base = appUrl();
  if (!base) return pathname;
  return `${base}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}
