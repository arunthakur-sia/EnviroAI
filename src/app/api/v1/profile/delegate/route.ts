// CR08 9.3: "Delegate my messages to" on the profile. One person, optional
// date range; delegation only adds a recipient.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getDelegate, MessagingError, setDelegate } from "@/server/services/messaging";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ data: await getDelegate(user), error: null });
}

const Body = z.object({
  delegateUserId: z.string().min(1).nullable(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  try {
    const info = await setDelegate(user, parsed.data);
    return NextResponse.json({ data: info, error: null });
  } catch (e) {
    if (e instanceof MessagingError) {
      return NextResponse.json({ data: null, error: e.code }, { status: e.status });
    }
    throw e;
  }
}
