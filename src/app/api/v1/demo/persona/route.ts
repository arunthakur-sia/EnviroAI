// The NCEC demo persona switcher (ui-plan.md s4). Lets any signed-in user
// pick which NCEC layer they read at, since real SSO and the grant workflow
// are out of scope for Step 1. This route, and the cookie it sets, are the
// only place demo mode is reachable from outside src/server/ncec/demo/.
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/server/auth/session";
import { isDemoModeEnabled, isDemoPersonaKey } from "@/server/ncec/demo/personas";
import { DEMO_PERSONA_COOKIE } from "@/server/ncec/principal";

export const dynamic = "force-dynamic";

function secureCookie(): boolean {
  return (
    process.env.SESSION_COOKIE_SECURE === "1" ||
    (process.env.SESSION_COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production")
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!isDemoModeEnabled()) return NextResponse.json({ data: { persona: "l1", enabled: false }, error: null });

  const raw = (await cookies()).get(DEMO_PERSONA_COOKIE)?.value;
  let persona: "l1" | "l2" | "l3" = "l1";
  try {
    const v = JSON.parse(raw ?? "{}");
    if (isDemoPersonaKey(v.persona)) persona = v.persona;
  } catch {
    /* default l1 on a broken cookie */
  }
  return NextResponse.json({ data: { persona, enabled: true }, error: null });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  if (!isDemoModeEnabled()) return NextResponse.json({ data: null, error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const persona = body?.persona;
  if (!isDemoPersonaKey(persona)) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });

  const store = await cookies();
  // every switch to l3 restarts the 30-day demo grant from now (decision #11)
  const value = persona === "l3" ? { persona, l3StartedAt: new Date().toISOString() } : { persona };
  store.set(DEMO_PERSONA_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie(),
    maxAge: 60 * 60 * 24 * 31,
  });
  return NextResponse.json({ data: { persona }, error: null });
}
