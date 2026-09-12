// Settings > Trends and Signals: briefs and feeds CRUD plus run history.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/server/auth/audit";

function allowed(user: Awaited<ReturnType<typeof getCurrentUser>>): boolean {
  return Boolean(user && (can(user, "manage", "settings") || can(user, "manage", "foresight")));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!allowed(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const [briefs, feedRows, runs] = await Promise.all([
    db.select().from(schema.scanBriefs).orderBy(schema.scanBriefs.nameEn),
    db.select().from(schema.feeds).orderBy(schema.feeds.name),
    db.select().from(schema.scanRuns).orderBy(desc(schema.scanRuns.startedAt)).limit(20),
  ]);
  return NextResponse.json({ data: { briefs, feeds: feedRows, runs }, error: null });
}

const Body = z.object({
  kind: z.enum(["brief", "feed"]),
  id: z.string().optional(),
  remove: z.boolean().optional(),
  brief: z
    .object({
      nameEn: z.string().min(2),
      nameAr: z.string().min(2),
      queryEn: z.string().min(3),
      queryAr: z.string().default(""),
      isActive: z.boolean().default(true),
    })
    .optional(),
  feed: z
    .object({
      name: z.string().min(2),
      url: z.string().url(),
      kind: z.enum(["rss", "atom", "google_news"]).default("rss"),
      isActive: z.boolean().default(true),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!allowed(user)) return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: "invalid_body" }, { status: 400 });
  const b = parsed.data;

  if (b.kind === "brief") {
    if (b.remove && b.id) {
      await db
        .update(schema.scanBriefs)
        .set({ isActive: 0 })
        .where(eq(schema.scanBriefs.id, b.id));
    } else if (b.id && b.brief) {
      await db
        .update(schema.scanBriefs)
        .set({
          nameEn: b.brief.nameEn,
          nameAr: b.brief.nameAr,
          queryEn: b.brief.queryEn,
          queryAr: b.brief.queryAr || null,
          isActive: b.brief.isActive ? 1 : 0,
        })
        .where(eq(schema.scanBriefs.id, b.id));
    } else if (b.brief) {
      await db.insert(schema.scanBriefs).values({
        id: newId(),
        nameEn: b.brief.nameEn,
        nameAr: b.brief.nameAr,
        queryEn: b.brief.queryEn,
        queryAr: b.brief.queryAr || null,
        isActive: b.brief.isActive ? 1 : 0,
        createdBy: user!.id,
        createdAt: nowIso(),
      });
    }
  } else {
    if (b.remove && b.id) {
      await db.update(schema.feeds).set({ isActive: 0 }).where(eq(schema.feeds.id, b.id));
    } else if (b.id && b.feed) {
      await db
        .update(schema.feeds)
        .set({
          name: b.feed.name,
          url: b.feed.url,
          kind: b.feed.kind,
          isActive: b.feed.isActive ? 1 : 0,
        })
        .where(eq(schema.feeds.id, b.id));
    } else if (b.feed) {
      await db.insert(schema.feeds).values({
        id: newId(),
        name: b.feed.name,
        url: b.feed.url,
        kind: b.feed.kind,
        isActive: b.feed.isActive ? 1 : 0,
        createdAt: nowIso(),
      });
    }
  }
  await audit(user!.id, "edit", "scan_settings", b.kind, { id: b.id, remove: b.remove });
  return NextResponse.json({ data: { ok: true }, error: null });
}
