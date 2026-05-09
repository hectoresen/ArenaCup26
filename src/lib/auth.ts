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
  trustHost: env.AUTH_TRUST_HOST,
  pages: {
    // No custom pages yet. Auth.js falls back to its built-in routes
    // (/api/auth/signin, /api/auth/error) which are fine for now.
  },
});
