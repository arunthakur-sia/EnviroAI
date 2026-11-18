// Seeds NCEC access for the demo: who sees which NCEC layer. Idempotent, SQLite or Postgres.
//   admin@enviroai.demo    L3: base layer 2 plus a grant on DS-015, DS-016, DS-038, DS-056 (brief R4)
//   ncec.l2@enviroai.demo  L2 (created if missing)
//   ncec.l1@enviroai.demo  L1, no NCEC access (created if missing)
// Every other user has no row, which is L1. Re-running refreshes the L3 grant's 30-day expiry.
// Usage:
//   node scripts/ncec/seed-access.mjs --driver sqlite --target nexus.db [--dry-run]
//   node scripts/ncec/seed-access.mjs --driver pg --target <db> --allow-remote [--dry-run]
import bcrypt from "bcryptjs";
import { ulid } from "ulid";
import { openDb, parseArgs } from "./lib/db.mjs";

const DEMO_PASSWORD = "EnviroAI!2026"; // the shared demo password every seeded user has (scripts/seed.ts)
const GRANT_DAYS = 30;
const L3_GRANT = ["DS-015", "DS-016", "DS-038", "DS-056"];
const TEMPLATE_EMAIL = "reader@enviroai.demo"; // new users copy this user's role and department

const NEW_USERS = [
  { email: "ncec.l2@enviroai.demo", nameEn: "NCEC Staff (L2)", nameAr: "موظف المركز (المستوى 2)", avatarColor: "teal" },
  { email: "ncec.l1@enviroai.demo", nameEn: "Public User (L1)", nameAr: "مستخدم عام (المستوى 1)", avatarColor: "aqua" },
];

const args = parseArgs(process.argv.slice(2));
const dry = args.flags.has("dry-run");
const db = await openDb(args);
console.log(`target: ${db.label}${dry ? " (dry run)" : ""}`);

try {
  await db.begin();
  try {
    await db.all("SELECT 1 FROM ncec_user_access LIMIT 1");
  } catch {
    throw new Error("ncec_user_access does not exist yet. Run the migrations first.");
  }
  const userId = async (email) => (await db.all("SELECT id FROM users WHERE email = ?", [email]))[0]?.id ?? null;

  const template = (await db.all("SELECT role_id, department_id FROM users WHERE email = ?", [TEMPLATE_EMAIL]))[0];
  if (!template) throw new Error(`${TEMPLATE_EMAIL} not found. Seed the app users first (npm run seed).`);

  const now = new Date().toISOString();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of NEW_USERS) {
    if (await userId(u.email)) {
      console.log(`user ${u.email}: exists`);
      continue;
    }
    await db.run(
      `INSERT INTO users (id, email, password_hash, name_en, name_ar, avatar_color, department_id, role_id,
         clearance_level, department_scope, locale_pref, password_set_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2, 'all', 'en', ?, ?, ?)`,
      [ulid(), u.email, hash, u.nameEn, u.nameAr, u.avatarColor, template.department_id, template.role_id, now, now, now],
    );
    console.log(`user ${u.email}: created`);
  }

  const expires = new Date(Date.now() + GRANT_DAYS * 86400000).toISOString();
  const rows = [
    { email: "admin@enviroai.demo", base: 2, grant: L3_GRANT, expires },
    { email: "ncec.l2@enviroai.demo", base: 2, grant: [], expires: null },
    { email: "ncec.l1@enviroai.demo", base: 1, grant: [], expires: null },
  ];
  for (const r of rows) {
    const id = await userId(r.email);
    if (!id) throw new Error(`${r.email} not found`);
    await db.run(
      `INSERT INTO ncec_user_access (user_id, base_layer, granted_dataset_ids, include_personal_data, allow_export, grant_expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET base_layer = excluded.base_layer,
         granted_dataset_ids = excluded.granted_dataset_ids, include_personal_data = excluded.include_personal_data,
         allow_export = excluded.allow_export, grant_expires_at = excluded.grant_expires_at, updated_at = excluded.updated_at`,
      [id, r.base, JSON.stringify(r.grant), db.bool(false), db.bool(false), r.expires, now],
    );
    console.log(`access ${r.email}: layer ${r.grant.length ? 3 : r.base}${r.grant.length ? ` (grant ${r.grant.join(", ")}, expires ${r.expires.slice(0, 10)})` : ""}`);
  }

  if (dry) {
    await db.rollback();
    console.log("dry run: rolled back");
  } else {
    await db.commit();
    console.log("done");
  }
} catch (e) {
  await db.rollback().catch(() => {});
  console.error("FAILED, rolled back:", e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
