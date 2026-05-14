import { routing } from "@/i18n/routing";
import createMiddleware from "next-intl/middleware";

export default createMiddleware(routing);

export const config = {
  // Match every path except API, Next assets, and files with extension.
  // /api/auth/* must NOT be touched (Auth.js handles it directly).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
