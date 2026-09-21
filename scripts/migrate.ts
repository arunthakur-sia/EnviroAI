// Applies every SQL file in src/server/db/migrations in name order.
// The work is in scripts/lib/migrate-core.mjs, in plain JavaScript, so the
// container's boot script runs the same migrator without tsx. Safe to run
// repeatedly: a file whose content hash is already recorded in `_migrations`
// is skipped outright and "already exists" errors are tolerated.
import fs from "node:fs";
import { applyMigrations } from "./lib/migrate-core.mjs";
import { DATA_DIR, dbUrl } from "./lib/paths.mjs";

export async function migrate(opts: { quiet?: boolean } = {}): Promise<void> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  await applyMigrations({ dbUrl: dbUrl(), quiet: opts.quiet });
}

const isMain = process.argv[1] && /migrate\.(ts|js|mjs)$/.test(process.argv[1]);
if (isMain) {
  migrate()
    .then(() => console.log("migrations complete"))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
