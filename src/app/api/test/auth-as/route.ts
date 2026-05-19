import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { dlog } from "@/lib/debug-log";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Endpoint **solo-test** que crea una sesión de Auth.js para un user
 * concreto sin pasar por Google OAuth. Diseñado para Playwright E2E.
 *
 * Hard-gated triple:
 *  1. `process.env.NODE_ENV !== "production"` (Railway prod siempre
 *     es `production`).
 *  2. `env.E2E_AUTH_ENABLED === true`.
 *  3. Header `x-e2e-secret` debe matchear `env.E2E_AUTH_SECRET`
 *     (compare timing-safe).
 *
 * Si cualquiera falla, devolvemos 404 (Not Found) sin filtrar
 * existencia del endpoint. En producción Railway ni siquiera setea
 * las E2E_* envs, así que el bloque devuelve 404 inmediato.
 *
 * Body: `{ "userId": "<uuid>" }` o `{ "username": "<slug>" }`. Si
 * pasa username, lo resuelve a userId. Devuelve `{ ok: true, sessionToken }`
 * y setea la cookie `authjs.session-token` (o `__Secure-...` si
 * https).
 *
 * Sesión válida 30 días desde la creación — más que suficiente para
 * cualquier suite E2E.
 */
export async function POST(req: Request) {
  // Gate 1: nunca en prod.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }
  // Gate 2: feature flag.
  if (!env.E2E_AUTH_ENABLED || !env.E2E_AUTH_SECRET) {
    return new NextResponse("Not Found", { status: 404 });
  }
  // Gate 3: secret header.
  const provided = req.headers.get("x-e2e-secret");
  if (!provided || !timingSafeEqual(provided, env.E2E_AUTH_SECRET)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let body: { userId?: string; username?: string };
  try {
    body = (await req.json()) as { userId?: string; username?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let userId: string | null = body.userId ?? null;
  if (!userId && body.username) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, body.username))
      .limit(1);
    userId = rows[0]?.id ?? null;
  }
  if (!userId) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Sanity: el user debe existir.
  const exists = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!exists[0]) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Crear session row.
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

  await db.insert(sessions).values({
    sessionToken,
    userId,
    expires,
  });

  // Set cookie con mismo nombre que Auth.js usa por defecto.
  const cookieName =
    process.env.NODE_ENV === "development"
      ? "authjs.session-token"
      : "__Secure-authjs.session-token";
  const cookieStore = await cookies();
  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV !== "development",
    expires,
    path: "/",
  });

  dlog("ranking", "E2E bypass: session created", { userId });
  return NextResponse.json({ ok: true, userId, sessionToken });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
