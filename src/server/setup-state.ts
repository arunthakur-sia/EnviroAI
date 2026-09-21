/**
 * Is this instance still waiting for its data?
 *
 * A container that comes up with an empty volume is not broken, it is
 * unfinished: the operator has not uploaded the bundle yet. Every page shows a
 * waiting screen in that state rather than an error, while `/api/health` keeps
 * answering 200 so the platform does not restart a service that is doing
 * exactly what it should.
 *
 * The answer is cached once it is "there are users", because that is a
 * one-way door: a seeded instance never becomes unseeded while it runs, and
 * nobody should pay for a COUNT on every page render forever.
 */
import { sql } from "drizzle-orm";
import { db, schema } from "@/server/db/client";

let seeded = false;

export async function awaitingSetup(): Promise<boolean> {
  if (seeded) return false;
  try {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(schema.users);
    const count = Number(row?.n ?? 0);
    if (count > 0) {
      seeded = true;
      return false;
    }
    return true;
  } catch {
    /* No users table means the migrations have not run, which is the same
       situation from the reader's point of view: not ready yet. */
    return true;
  }
}
