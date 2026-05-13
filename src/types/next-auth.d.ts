import "next-auth";

/**
 * Extiende los tipos de `next-auth` para que `session.user` exponga
 * los campos propios del dominio (`id`, `username`). El callback
 * `session` en `src/lib/auth.ts` los puebla desde la BD.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
