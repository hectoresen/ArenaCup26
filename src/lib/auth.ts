import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";

/**
 * Auth.js v5 configuration.
 *
 * Wires the Google provider and the Drizzle adapter. Onboarding
 * (username, country) lands in a follow-up proposal once the UI mockup
 * exists. For now, after a successful sign-in the user is redirected
 * back to the home page (default behavior).
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
  // En dev confiamos siempre del Host header (localhost). En producción solo
  // si AUTH_TRUST_HOST=true (necesario fuera de Vercel; Vercel lo detecta solo
  // si no pasamos nada, pero aquí lo hacemos explícito para no depender del
  // entorno).
  trustHost: env.NODE_ENV !== "production" || env.AUTH_TRUST_HOST,
});
