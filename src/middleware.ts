import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// CR05 6.4: while a Super Admin previews as another role or user, the app is
// strictly read-only: every mutating API call is refused here, before any
// handler runs. Ending the preview and logging out stay possible.
const PREVIEW_WRITE_ALLOWLIST = ["/api/v1/preview", "/api/v1/auth/logout"];

/* CR08 Phase B: two routes that only ever redirect. They used to be pages
   whose body called redirect(), which answers 307 only while nothing above
   them streams; once their segment gained a loading skeleton the redirect
   arrived inside a 200 instead. Doing it here keeps the real status code and
   costs nothing. */
const REDIRECTS: [RegExp, string][] = [
  [/^\/(en|ar)\/foresight(\/.*)?$/, "/trends"],
  [/^\/(en|ar)\/lessons\/new$/, "/add"],
];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  /* The platform's health check answers before anything else here: it has no
     session, no locale and no preview to consider, and a middleware that grew
     a bug would otherwise be able to report a healthy container as sick and
     have it restarted. */
  if (pathname === "/api/health") return NextResponse.next();
  /* The one-time restore page and its routes live outside the locale tree:
     they run before anyone can sign in and must not be rewritten to /en/... .
     They gate themselves on SETUP_TOKEN and answer 404 without it. */
  if (pathname === "/setup" || pathname.startsWith("/setup/") || pathname.startsWith("/api/setup/")) {
    return NextResponse.next();
  }
  for (const [pattern, to] of REDIRECTS) {
    const m = pattern.exec(pathname);
    if (m) {
      const url = req.nextUrl.clone();
      url.pathname = `/${m[1]}${to}`;
      return NextResponse.redirect(url, 307);
    }
  }
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
