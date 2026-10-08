#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Writes `railway-variables.txt`: the service variables to paste into Railway,
 * one KEY=value per line.
 *
 * The values are read from `.env.local` and, for the two podcast voice ids,
 * from the `podcast_voices` setting in the local database when the environment
 * does not carry them. A fresh 48-character SESSION_SECRET is generated here
 * rather than copied, so the deployment does not share a secret with anyone's
 * laptop.
 *
 * Nothing secret is printed: the report says which keys were found and how long
 * each value is, never the value. The file itself is in .gitignore and
 * .railwayignore.
 *
 *   npm run railway:variables
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { DB_PATH, dbUrl } from "./lib/paths.mjs";

const OUT = path.join(process.cwd(), "railway-variables.txt");

function readEnvLocal() {
  const file = path.resolve(process.cwd(), ".env.local");
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!m) continue;
    out.set(m[1], m[2].trim().replace(/^["']|["']$/g, ""));
  }
  return out;
}

/** A 48-character secret, from the alphabet a URL and a shell both tolerate. */
function newSecret(length = 48) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function voicesFromDatabase() {
  if (!fs.existsSync(DB_PATH)) return { mariam: "", hamad: "" };
  const client = createClient({ url: dbUrl() });
  try {
    const res = await client.execute({
      sql: "SELECT value_json FROM settings WHERE key = ? LIMIT 1",
      args: ["podcast_voices"],
    });
    const raw = res.rows[0]?.value_json;
    if (!raw) return { mariam: "", hamad: "" };
    const parsed = JSON.parse(String(raw));
    return { mariam: String(parsed?.mariam ?? ""), hamad: String(parsed?.hamad ?? "") };
  } catch {
    return { mariam: "", hamad: "" };
  } finally {
    client.close();
  }
}

const env = readEnvLocal();
const voices = await voicesFromDatabase();

const pick = (key, fallback = "") => (env.get(key) || fallback || "").trim();

const vars = [
  ["NODE_ENV", "production"],
  ["DATA_DIR", "/app/data"],
  ["APP_URL", "https://${{RAILWAY_PUBLIC_DOMAIN}}"],
  // the app's own name for the session secret; there is no SESSION_PASSWORD
  ["SESSION_SECRET", newSecret(48)],
  ["ANTHROPIC_API_KEY", pick("ANTHROPIC_API_KEY")],
  ["VOYAGE_API_KEY", pick("VOYAGE_API_KEY")],
  ["ELEVENLABS_API_KEY", pick("ELEVENLABS_API_KEY")],
  ["ELEVENLABS_VOICE_MARIAM", pick("ELEVENLABS_VOICE_MARIAM", voices.mariam)],
  ["ELEVENLABS_VOICE_HAMAD", pick("ELEVENLABS_VOICE_HAMAD", voices.hamad)],
  ["TZ", "Asia/Riyadh"],
  ["SCAN_SCHEDULE_ENABLED", "false"],
  ["SKIP_INDICES_FETCH", "1"],
  ["SKIP_CR07_FETCH", "1"],
  ["PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "1"],
  ["NEXT_TELEMETRY_DISABLED", "1"],
  /* The one-time door for the data bundle, last so it is easy to find and
     delete. While it is set, /setup/restore exists and accepts the upload;
     removing it in Railway takes the page away on the next deploy. */
  ["SETUP_TOKEN", newSecret(40)],
];

fs.writeFileSync(OUT, vars.map(([k, v]) => `${k}=${v}`).join("\n") + "\n", "utf8");

console.log(`wrote ${path.basename(OUT)} with ${vars.length} variables\n`);
const SECRETS = new Set([
  "SESSION_SECRET",
  "ANTHROPIC_API_KEY",
  "VOYAGE_API_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_MARIAM",
  "ELEVENLABS_VOICE_HAMAD",
]);
for (const [k, v] of vars) {
  if (SECRETS.has(k)) {
    console.log(`  ${k.padEnd(34)} ${v ? `set (${v.length} characters)` : "EMPTY: not in .env.local"}`);
  } else {
    console.log(`  ${k.padEnd(34)} ${v}`);
  }
}
console.log(
  "\nThe file is in .gitignore and .railwayignore. Paste it into Railway's variables\n" +
    "(Raw Editor), then delete it. APP_URL uses Railway's own reference syntax, so it\n" +
    "resolves to whatever public domain the service is given."
);

/* The setup token is the one value the operator has to type by hand, into the
   restore page, so it is the one value printed. It is not a credential to
   anything else and it stops working the moment they delete the variable. */
const setup = vars.find(([k]) => k === "SETUP_TOKEN")?.[1] ?? "";
console.log(
  `\nSETUP_TOKEN (type this into /setup/restore after the first deploy):\n\n  ${setup}\n\n` +
    "Upload enviroai-data.tar.gz there, then delete SETUP_TOKEN in Railway and deploy\n" +
    "again. That removes the restore page and starts EnviroAI with your data."
);
