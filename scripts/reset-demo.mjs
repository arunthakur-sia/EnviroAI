/* eslint-disable no-console */
// CR08 Phase C: "reset demo data" in under two minutes without a reseed.
//   node scripts/reset-demo.mjs --snapshot   freeze the current database and
//                                            files as the demo baseline
//   node scripts/reset-demo.mjs              restore the baseline (default)
// The snapshot lives under data/demo-snapshot/ (the database after a WAL
// checkpoint, plus uploads, reports and podcasts). Restore needs the server
// STOPPED on Windows (the database file is locked while it runs).
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

const { DATA_DIR: DATA, DB_PATH: DB } = await import("./lib/paths.mjs");
const SNAP = path.join(DATA, "demo-snapshot");
const DIRS = ["uploads", "reports", "podcasts"];
const mode = process.argv.includes("--snapshot") ? "snapshot" : "restore";
const t0 = Date.now();

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  if (!fs.existsSync(from)) return 0;
  fs.cpSync(from, to, { recursive: true });
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else n++;
    }
  };
  walk(to);
  return n;
}

function portBusy(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(true));
    s.once("listening", () => s.close(() => resolve(false)));
    s.listen(port, "127.0.0.1");
  });
}

if (mode === "snapshot") {
  if (!fs.existsSync(DB)) {
    console.error("data/nexus.db is missing");
    process.exit(1);
  }
  fs.mkdirSync(SNAP, { recursive: true });
  const client = createClient({ url: `file:${DB.replace(/\\/g, "/")}` });
  await client.execute("PRAGMA wal_checkpoint(TRUNCATE);");
  client.close();
  fs.copyFileSync(DB, path.join(SNAP, "nexus.db"));
  for (const d of DIRS) {
    const n = copyDir(path.join(DATA, d), path.join(SNAP, d));
    console.log(`${d}: ${n} files`);
  }
  fs.writeFileSync(
    path.join(SNAP, "manifest.json"),
    JSON.stringify({ takenAt: new Date().toISOString(), dirs: DIRS }, null, 2)
  );
  console.log(`snapshot taken in ${((Date.now() - t0) / 1000).toFixed(1)}s -> data/demo-snapshot/`);
} else {
  if (!fs.existsSync(path.join(SNAP, "nexus.db"))) {
    console.error("no snapshot yet: run `node scripts/reset-demo.mjs --snapshot` first");
    process.exit(1);
  }
  if (await portBusy(Number(process.env.DEMO_PORT || 3000))) {
    console.error("the server is running on the demo port: stop it, then reset (the database file is locked while it serves)");
    process.exit(1);
  }
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${DB}${suffix}`, { force: true });
  fs.copyFileSync(path.join(SNAP, "nexus.db"), DB);
  for (const d of DIRS) {
    const n = copyDir(path.join(SNAP, d), path.join(DATA, d));
    console.log(`${d}: ${n} files restored`);
  }
  console.log(`demo data restored in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
