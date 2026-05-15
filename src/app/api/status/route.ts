import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db/client";

/**
 * Endpoint de health check público. Devuelve estado de los
 * componentes que conoce: base de datos (ping rápido) y env vars
 * críticas. Sin payload sensible: solo `ok|degraded|down` por
 * servicio y timestamp.
 *
 * Usable como upstream para uptime monitors externos (Better Uptime,
 * Hetrix, ...) o como fuente de la página `/status` interna.
 */
export async function GET() {
  const checkedAt = new Date().toISOString();
  const services: Record<string, "ok" | "degraded" | "down"> = {};

  // DB: query trivial para verificar conexión + driver alive.
  try {
    const started = Date.now();
    await db.execute(sql`select 1`);
    const elapsed = Date.now() - started;
    services.database = elapsed < 500 ? "ok" : "degraded";
  } catch {
    services.database = "down";
  }

  // Auth: lo damos por ok si AUTH_SECRET está set (Auth.js dependerá
  // de Google, que no podemos verificar sin OAuth flow; reportar
  // "auth_config_present" es suficiente para el health check).
  services.auth = process.env.AUTH_SECRET ? "ok" : "down";

  // Provider de match data: solo verificamos config presente — un
  // ping real a api-football consumiría free tier en cada call al
  // health check. Cualquier monitor real debería pollear con
  // frecuencia ≤1/min.
  services.match_data = process.env.API_FOOTBALL_KEY ? "ok" : "degraded";

  const overall: "ok" | "degraded" | "down" = Object.values(services).every((s) => s === "ok")
    ? "ok"
    : Object.values(services).some((s) => s === "down")
      ? "down"
      : "degraded";

  return NextResponse.json(
    {
      status: overall,
      checkedAt,
      services,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
