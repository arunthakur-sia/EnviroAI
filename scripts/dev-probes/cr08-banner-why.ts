/* eslint-disable no-console */
// Why does the Home handover banner not render for the seeded recipient?
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { eq } = await import("drizzle-orm");
  const { getUserById } = await import("../../src/server/auth/session");
  const { getMyRecipientHandovers } = await import("../../src/server/services/handover");

  const [row] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.email, "mohammed.alqarni@enviroai.demo"))
    .limit(1);
  if (!row) {
    console.log("no such user");
    return;
  }
  const paths = await db
    .select()
    .from(schema.handoverLearningPaths)
    .where(eq(schema.handoverLearningPaths.recipientUserId, row.id));
  console.log(`learning paths: ${paths.length}`);
  for (const p of paths) {
    const [h] = await db
      .select()
      .from(schema.handovers)
      .where(eq(schema.handovers.id, p.handoverId))
      .limit(1);
    console.log(
      `  path ${p.id} handover ${p.handoverId} signedOff=${p.signedOffAt ?? "null"} handoverStatus=${h?.status} kind=${h?.kind} personKind=${h?.personKind}`
    );
  }
  const user = await getUserById(row.id);
  if (!user) {
    console.log("getUserById returned null");
    return;
  }
  const rows = await getMyRecipientHandovers(user);
  console.log(`getMyRecipientHandovers: ${rows.length}`);
  for (const r of rows) {
    console.log(
      `  ${r.id} status=${r.status} signedOffAt=${r.signedOffAt ?? "null"} items=${JSON.stringify(r.items)} person=${r.person?.nameEn}`
    );
  }
  console.log(
    `open after the banner filter: ${rows.filter((r) => r.status !== "complete" && !r.signedOffAt).length}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
