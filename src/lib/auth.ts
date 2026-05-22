import { dlog } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { checkSignupLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { db } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";
import { INVITE_COOKIE } from "@/server/invitations/cookie-constants";
import { redeemInvitationForUser } from "@/server/invitations/redemption";
import { resolveAvailableUsername, slugifyName } from "@/server/users/username";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies, headers } from "next/headers";

/**
 * Auth.js v5 configuration.
 *
 * Wires the Google provider and the Drizzle adapter. Al primer
 * login (`events.createUser`) auto-generamos un username a partir
 * del nombre del provider con sufijo numérico si colisiona. El
 * usuario puede cambiarlo después (capability `add-username-edit`,
 * pendiente).
 *
 * El callback `session` añade `id` y `username` al `session.user`
 * para que el resto de la app pueda construir URLs de perfil sin
 * volver a consultar BD.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // Forzar el selector de cuentas en cada login. Sin esto,
          // Google re-autentica silenciosamente con la última cuenta
          // usada → el user no puede elegir otra sin cerrar sesión
          // en accounts.google.com manualmente. Coste UX: 1 click
          // extra; beneficio: control claro en máquinas compartidas
          // y testing multi-cuenta. Decisión 2026-05-15.
          prompt: "select_account",
        },
      },
    }),
  ],
  session: { strategy: "database" },
  trustHost: env.NODE_ENV !== "production" || env.AUTH_TRUST_HOST,
  // Cookies cross-subdomain (`domain=.arenacup26.com`) para todo el
  // flow Auth.js. El OAuth flow corre en www (AUTH_URL=www) pero los
  // Server Actions de signIn pueden arrancar desde admin.* — el
  // browser persiste cookies en admin que luego www tiene que leer
  // en `/api/auth/callback/google`. Si solo sessionToken es
  // cross-domain, los checks PKCE/state/csrf fallan con
  // `InvalidCheck: pkceCodeVerifier could not be parsed` porque la
  // cookie está scoped al subdomain de origen.
  //
  // Usamos prefix `__Secure-` (no `__Host-`) en TODAS porque
  // `__Host-` prohíbe `domain=` por spec — incompatible con
  // multi-subdomain. La protección que pierdes (`__Host-` impide
  // que un subdomain comprometido inyecte cookies a otro) es
  // aceptable: controlamos todos los subdominios bajo arenacup26.com.
  cookies:
    env.NODE_ENV === "production"
      ? (() => {
          const sharedOptions = {
            domain: ".arenacup26.com",
            httpOnly: true,
            sameSite: "lax" as const,
            secure: true,
            path: "/",
          };
          // Names únicos prefix `ac26-` para evitar colisión con las
          // cookies viejas `__Secure-authjs.*` que algunos users tienen
          // host-only (del deploy previo al multi-host). Si reutilizamos
          // el name, el browser envía la cookie host-only vieja (más
          // específica por RFC 6265) y Auth.js no encuentra la session
          // nueva → "login que vuelve al ranking sin loguearse".
          // Las cookies viejas quedan huérfanas hasta expirar.
          return {
            sessionToken: {
              name: "__Secure-ac26-session",
              options: sharedOptions,
            },
            callbackUrl: {
              name: "__Secure-ac26-callback-url",
              options: sharedOptions,
            },
            csrfToken: {
              name: "__Secure-ac26-csrf-token",
              options: sharedOptions,
            },
            pkceCodeVerifier: {
              name: "__Secure-ac26-pkce",
              options: { ...sharedOptions, maxAge: 900 },
            },
            state: {
              name: "__Secure-ac26-state",
              options: { ...sharedOptions, maxAge: 900 },
            },
            nonce: {
              name: "__Secure-ac26-nonce",
              options: sharedOptions,
            },
          };
        })()
      : undefined,
  events: {
    async createUser({ user }) {
      // user.id viene siempre (DrizzleAdapter lo asigna antes del evento).
      if (!user.id) return;
      const base = slugifyName(user.name);
      const username = await resolveAvailableUsername(base, async (candidate) => {
        const found = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, candidate))
          .limit(1);
        return found.length > 0;
      });
      await db.update(users).set({ username }).where(eq(users.id, user.id));

      // Redime el token de invitación si el visitor llegó con uno.
      // El middleware persistió el token en una cookie httpOnly al
      // detectar `?invite=` en la URL antes del OAuth; aquí cerramos
      // el ciclo: insertamos redemption + auto-friendship + bump del
      // counter del link. Si algo falla, no rompemos el signup —
      // simplemente el user no queda emparejado con el inviter.
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get(INVITE_COOKIE)?.value;
        if (token) {
          const result = await redeemInvitationForUser(db, user.id, token, user.name ?? null);
          dlog("ranking", "invite redemption attempted on createUser", {
            userId: user.id,
            ok: result.ok,
            code: result.ok ? null : result.code,
          });
          // Limpia la cookie independientemente del resultado: si fue
          // OK, su trabajo terminó; si falló, no queremos reintentar
          // en un re-login (es un fallo definitivo: token inválido,
          // revocado, agotado o auto-redeem).
          cookieStore.delete(INVITE_COOKIE);
        }
      } catch (err) {
        dlog("ranking", "invite redemption error on createUser", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    },
  },
  callbacks: {
    async signIn({ user }) {
      // Solo aplica rate-limit al PRIMER login de un user (cuando el
      // adapter aún no le ha asignado id porque va a crearlo). Logins
      // sucesivos de un user existente no crean fila nueva en `users`
      // y por tanto no son interesantes para el limiter de signup.
      const isFirstLogin = !user.id;
      if (!isFirstLogin) return true;

      try {
        const ip = getRequestIp(await headers());
        const rl = await checkSignupLimit(ip);
        if (!rl.ok) {
          dlog("ranking", "signup rate-limited", { ip: ip.slice(0, 8) });
          return false; // bloquea el flow de OAuth con error genérico
        }
      } catch (err) {
        // Si el rate-limit falla por cualquier motivo, permitimos —
        // mejor un signup de más que cortar a un usuario legítimo
        // por un problema de infra interna.
        dlog("ranking", "signup limit check failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
      return true;
    },
    async session({ session, user }) {
      if (!session.user) return session;
      session.user.id = user.id;

      const found = await db
        .select({ username: users.username, name: users.name })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      let username = found[0]?.username ?? null;

      // Backfill: usuarios anteriores al despliegue de auto-gen
      // (preregistrados sin pasar por `events.createUser`) llegan con
      // username = null. En la primera carga de sesión les asignamos
      // uno. Idempotente: si ya existe, no hace nada.
      if (username === null) {
        const base = slugifyName(found[0]?.name ?? user.name ?? null);
        username = await resolveAvailableUsername(base, async (candidate) => {
          const taken = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, candidate))
            .limit(1);
          return taken.length > 0;
        });
        await db.update(users).set({ username }).where(eq(users.id, user.id));
      }

      session.user.username = username;
      return session;
    },
  },
});
