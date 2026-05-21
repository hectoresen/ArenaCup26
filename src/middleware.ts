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
 * Detección de subdomain admin. En producción es `admin.arenacup26.com`;
 * en dev local (`admin.localhost:3000` requiere /etc/hosts) seguimos
 * el mismo patrón. Cualquier host que empiece por `admin.` enruta a
 * `/admin/*`. El acceso al panel sigue gateado por `checkAdmin` en el
 * layout — el subdomain solo organiza rutas, no es seguridad.
 */
function isAdminHost(host: string): boolean {
  return host.startsWith("admin.");
}

export default function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const pathname = request.nextUrl.pathname;

  // 0) Subdomain admin → rewrite a `/admin/*`. La auth gate vive en el
  //    layout del route group (Server Component que llama `checkAdmin`).
  if (isAdminHost(host)) {
    if (!pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = `/admin${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
    // Ya en /admin/* desde rewrite previo o navegación interna — pasa.
    return NextResponse.next();
  }

  // 1) Dominio público (www / naked) NO debe servir `/admin`. Si
  //    alguien escribe `arenacup26.com/admin` (o probe vector tipo
  //    `/admin/users`), devolvemos 404 puro — la existencia del admin
  //    solo se infiere desde el subdomain dedicado.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return new NextResponse(null, { status: 404 });
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
