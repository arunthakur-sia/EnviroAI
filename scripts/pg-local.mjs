// Starts a local Postgres (embedded-postgres, real binaries) on port 54329 with
// the data under ./data/pgdata, creates the `enviroai` database and, when it is
// empty, loads the files in ./supabase in order. Leave it running, then start
// the app with:
//   DATABASE_URL=postgresql://postgres:postgres@localhost:54329/enviroai npm run dev
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("data", "pgdata");
const fresh = !fs.existsSync(path.join(dir, "PG_VERSION"));
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port: 54329,
  persistent: true,
  onLog: () => {},
  onError: (e) => console.error(String(e)),
});
if (fresh) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("enviroai");
} catch {
  /* exists */
}
const client = pg.getPgClient("enviroai");
await client.connect();
const has = (await client.query("select to_regclass('public.users') as t")).rows[0].t;
if (!has) {
  const sqlDir = path.resolve("supabase");
  for (const f of fs.readdirSync(sqlDir).filter((f) => f.endsWith(".sql") && !f.startsWith("03_")).sort()) {
    await client.query(fs.readFileSync(path.join(sqlDir, f), "utf8"));
    console.log("loaded", f);
  }
}
await client.end();
console.log("postgres ready: postgresql://postgres:postgres@localhost:54329/enviroai");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
