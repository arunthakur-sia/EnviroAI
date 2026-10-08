/* eslint-disable no-console */
// Does getActiveKnowledgeOfWeek ever return null for the Super Admin?
import { loadEnv } from "../../src/lib/load-env";
loadEnv();

async function main() {
  const { db, schema } = await import("../../src/server/db/client");
  const { eq } = await import("drizzle-orm");
  const { getUserById } = await import("../../src/server/auth/session");
  const { getActiveKnowledgeOfWeek } = await import("../../src/server/services/knowledge-of-week");

  for (const email of ["admin@enviroai.demo", "reader@enviroai.demo"]) {
    const [row] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    const user = row ? await getUserById(row.id) : null;
    if (!user) {
      console.log(`${email}: no user`);
      continue;
    }
    const out: string[] = [];
    for (let i = 0; i < 5; i++) {
      const card = await getActiveKnowledgeOfWeek(user);
      out.push(card ? `${card.resourceType}:${card.titleEn.slice(0, 20)}` : "NULL");
      await new Promise((r) => setTimeout(r, 300));
    }
    console.log(`${email}: ${out.join(" | ")}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
