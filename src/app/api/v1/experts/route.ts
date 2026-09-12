import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { createExternalExpert, listExperts } from "@/server/services/experts";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const experts = await listExperts(user, {
    q: sp.get("q") ?? undefined,
    type: sp.get("type") ?? undefined,
    domain: sp.get("domain") ?? undefined,
    availability: sp.get("availability") ?? undefined,
  });
  return NextResponse.json({ data: experts, error: null });
}

const Body = z.object({
  nameEn: z.string().min(2),
  nameAr: z.string().min(2),
  type: z.enum(["government", "academic", "consultant", "international"]),
  organisationEn: z.string().optional(),
  organisationAr: z.string().optional(),
  positionEn: z.string().optional(),
  positionAr: z.string().optional(),
  bioEn: z.string().optional(),
  bioAr: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  nationality: z.string().optional(),
  yearsExperience: z.number().optional(),
  availability: z.enum(["available", "limited", "unavailable"]).optional(),
  domainCodes: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await createExternalExpert(user, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 400 }
    );
  }
  return NextResponse.json({ data: { id: result.id }, error: null });
}
