import createIntlProxy from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// Runs before every page request: resolves which locale ("nl"/"en") a
// request should use and redirects/rewrites accordingly. Named `proxy` per
// Next.js 16's file convention (the older `middleware` name still works but
// is deprecated). See https://nextjs.org/docs/app/api-reference/file-conventions/proxy
export default createIntlProxy(routing);

export const config = {
  // Run on every path except static assets, images and API routes - those
  // don't need locale resolution and auth webhooks (e.g. Mollie) must not
  // be redirected.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
