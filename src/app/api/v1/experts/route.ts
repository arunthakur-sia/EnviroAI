import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import {
  createExternalExpert,
  listExperts,
  listExpertsGrouped,
} from "@/server/services/experts";

/* GET /api/v1/experts?view=internal|external&q=&type=&domain=&availability=
   &unit=&level=&projects=1&organisation=&country=&workedWith=1&grouped=1
   CR08 3: `grouped=1` answers { internal, external, all }; without it the
   flat list keeps its CR01 shape (with the new per-card facts added). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const filters = {
    q: sp.get("q") ?? undefined,
    view: sp.get("view") ?? undefined,
    type: sp.get("type") ?? undefined,
    domain: sp.get("domain") ?? undefined,
    availability: sp.get("availability") ?? undefined,
    unit: sp.get("unit") ?? sp.get("department") ?? undefined,
    level: sp.get("level") ?? undefined,
    projects: sp.get("projects") === "1",
    organisation: sp.get("organisation") ?? undefined,
    country: sp.get("country") ?? undefined,
    workedWith: sp.get("workedWith") === "1",
  };
  if (sp.get("grouped") === "1") {
    const { view: _view, ...rest } = filters;
    const grouped = await listExpertsGrouped(user, rest);
    return NextResponse.json({ data: grouped, error: null });
  }
  const experts = await listExperts(user, filters);
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
  country: z.string().length(2).optional().or(z.literal("")),
  yearsExperience: z.number().optional(),
  availability: z.enum(["available", "limited", "unavailable"]).optional(),
  domainCodes: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const result = await createExternalExpert(user, {
    ...parsed.data,
    country: parsed.data.country || undefined,
  });
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: result.error },
      { status: result.error === "forbidden" ? 403 : 400 }
    );
  }
  return NextResponse.json({ data: { id: result.id }, error: null });
}
