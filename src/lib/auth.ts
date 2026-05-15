import { dlog } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { checkSignupLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { db } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";
import { resolveAvailableUsername, slugifyName } from "@/server/users/username";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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
    }),
  ],
  session: { strategy: "database" },
  trustHost: env.NODE_ENV !== "production" || env.AUTH_TRUST_HOST,
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
