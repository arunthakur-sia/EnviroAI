import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// CR05 6.4: while a Super Admin previews as another role or user, the app is
// strictly read-only: every mutating API call is refused here, before any
// handler runs. Ending the preview and logging out stay possible.
const PREVIEW_WRITE_ALLOWLIST = ["/api/v1/preview", "/api/v1/auth/logout"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api")) {
    const method = req.method.toUpperCase();
    // an empty cookie value is a deleted preview, not an active one
    const previewing = Boolean(req.cookies.get("nexus_preview")?.value);
    if (
      previewing &&
      method !== "GET" &&
      method !== "HEAD" &&
      method !== "OPTIONS" &&
      !PREVIEW_WRITE_ALLOWLIST.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.json(
        { data: null, error: "preview_read_only" },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }
  return intl(req);
}

export const config = {
  // pages for next-intl, plus api routes for the preview write guard
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/api/:path*"],
};
