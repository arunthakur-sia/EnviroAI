import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except api routes, next internals, and files with extensions
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
