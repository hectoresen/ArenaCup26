import { routing } from "@/i18n/routing";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

/**
 * Cookie en la que persistimos el token de invitación antes del
 * OAuth. 30 días de vida — el usuario puede tardar en decidirse a
 * registrarse. HttpOnly + sameSite=lax para que sobreviva el round-trip
 * a accounts.google.com.
 */
const INVITE_COOKIE = "wm_invite_token";
const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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
      maxAge: INVITE_COOKIE_MAX_AGE,
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
