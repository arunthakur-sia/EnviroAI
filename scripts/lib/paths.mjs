/**
 * The data directory rule, in plain JavaScript, for the boot script and the
 * other scripts that run before or outside the TypeScript build.
 *
 * This is the same rule as `src/server/paths.ts`. Change one and change the
 * other; `tests/paths.test.ts` fails when they disagree.
 */
import fs from "node:fs";
import path from "node:path";

export const STORED_PREFIX = "data";

export function resolveDataDir() {
  const fromEnv = process.env.DATA_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), STORED_PREFIX);
}

export const DATA_DIR = resolveDataDir();

export function dataPath(...segments) {
  return path.join(DATA_DIR, ...segments);
}

export function resolveDataPath(stored) {
  if (path.isAbsolute(stored)) return path.resolve(stored);
  const clean = String(stored).replace(/\\/g, "/").replace(/^\.\//, "");
  const rel =
    clean === STORED_PREFIX
      ? ""
      : clean.startsWith(`${STORED_PREFIX}/`)
        ? clean.slice(STORED_PREFIX.length + 1)
        : clean;
  return path.resolve(DATA_DIR, rel);
}

export function storedDataPath(absolute) {
  const rel = path.relative(DATA_DIR, path.resolve(absolute)).replace(/\\/g, "/");
  return `${STORED_PREFIX}/${rel}`;
}

export const DATA_SUBDIRS = [
  "uploads",
  "reports",
  "reports/module",
  "reports/handover",
  "reports/previews",
  "podcasts",
  "import",
  "tmp",
];

export function ensureDataDirs() {
  for (const sub of DATA_SUBDIRS) fs.mkdirSync(dataPath(sub), { recursive: true });
}

/** The database file, as a path and as the libsql url. */
export const DB_PATH = dataPath("nexus.db");
export function dbUrl() {
  return `file:${DB_PATH.replace(/\\/g, "/")}`;
}
