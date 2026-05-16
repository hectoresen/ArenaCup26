import { routing } from "@/i18n/routing";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE_SECONDS,
} from "@/server/invitations/cookie-constants";

const intlMiddleware = createMiddleware(routing);

// `cookie-constants.ts` define INVITE_COOKIE + max-age en un módulo
// Edge-safe (sin imports a Drizzle) para que middleware, auth callback
// y banner referencien siempre el mismo nombre. Cookie httpOnly, secure
// en prod, sameSite=lax (sobrevive el round-trip a accounts.google.com).

export default function middleware(request: NextRequest) {
  // 1) Intercepta `?invite=<token>` antes de delegar al middleware
  //    de i18n. Persistimos el token en cookie httpOnly y redirigimos
  //    a la URL limpia — así un refresh no re-escribe la cookie y la
  //    URL compartible queda como el host raíz.
  const inviteToken = request.nextUrl.searchParams.get("invite");
  if (inviteToken && inviteToken.length > 0 && inviteToken.length <= 64) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("invite");
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set(INVITE_COOKIE, inviteToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });
    return response;
  }

  return intlMiddleware(request);
}

export const config = {
  // Match every path except API, Next assets, and files with extension.
  // /api/auth/* must NOT be touched (Auth.js handles it directly).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
