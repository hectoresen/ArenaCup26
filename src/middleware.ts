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

/**
 * Hosts donde el path `/admin/*` puede servirse:
 *  - **Subdomain dedicado** `admin.arenacup26.com`: futuro, cuando
 *    haya slot de custom domain en el plan Railway (ahora ocupados
 *    por www + apex).
 *  - **Railway provided** `*.up.railway.app`: actual. URL fea pero
 *    no consume slot custom. Solo Hector la usa.
 *  - **Localhost**: dev local.
 *
 * Cualquier otro host (www / apex / dominio publico) sirve 404
 * cuando se accede a `/admin*` para no exponer el admin a tráfico
 * público que pueda escanear URLs.
 *
 * La auth gate real (checkAdmin) vive en el layout — esto solo
 * decide qué hosts tienen acceso al routing del admin.
 */
function isAdminHost(host: string): boolean {
  if (host.startsWith("admin.")) return true;
  if (host.endsWith(".up.railway.app")) return true;
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return true;
  return false;
}

export default function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const pathname = request.nextUrl.pathname;
  const adminHost = isAdminHost(host);

  // 0) Subdomain admin dedicado → rewrite root y subpaths a `/admin/*`.
  //    Solo aplica al subdomain `admin.*`, no al railway provided
  //    (donde el user navega explícitamente a `/admin/...`).
  if (host.startsWith("admin.") && !pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // 1) Hosts públicos (custom domains: www, apex) NO deben servir
  //    `/admin*`. Si alguien escribe `arenacup26.com/admin`, devolvemos
  //    404 puro — la existencia del admin solo es visible desde hosts
  //    autorizados (railway provided o subdomain admin).
  if (!adminHost && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return new NextResponse(null, { status: 404 });
  }

  // 2) En hosts admin, las rutas `/admin/*` se sirven tal cual.
  //    Saltamos el resto del middleware (no aplicamos i18n a /admin).
  if (adminHost && pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // 2) Intercepta `?invite=<token>` antes de delegar al middleware
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
