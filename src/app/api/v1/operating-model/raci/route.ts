// CR08 10.2 section 4: one RACI cell. PUT { processId, unitId, role: R|A|C|I|null }.
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { setRaci } from "@/server/services/operating-model";
import { fail, failFrom, ok, readJson } from "../_shared";

const Body = z.object({
  processId: z.string().min(1),
  unitId: z.string().min(1),
  role: z.enum(["R", "A", "C", "I"]).nullable(),
});

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", 401);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("invalid", 400);
  try {
    return ok(await setRaci(user, parsed.data.processId, parsed.data.unitId, parsed.data.role));
  } catch (e) {
    return failFrom(e);
  }
}
