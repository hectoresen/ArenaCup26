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

  // Provider de match data: hacemos un ping real a un endpoint barato
  // del provider (status) con timeout corto. Es necesario porque
  // checks anteriores solo verificaban env vars y devolvían "ok"
  // incluso con la cuenta suspendida o IP allowlist bloqueando
  // (incidente 2026-05-18). Con Pro $19 / 7500 req/día el coste de
  // pollear esto cada minuto es despreciable (~1440 req/día).
  services.match_data = await checkMatchDataProvider();

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

/**
 * Ping real a api-football. Llama a `/status` (endpoint trivial que
 * devuelve uso de quota) con timeout 3s. Si la key no está set
 * devolvemos `degraded` directamente (no hay nada que pingear).
 */
async function checkMatchDataProvider(): Promise<"ok" | "degraded" | "down"> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return "degraded";

  const base = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${base}/status`, {
      headers: { "x-apisports-key": key },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return "down";
    const body = (await res.json()) as { errors?: unknown };
    const hasErrors = Array.isArray(body.errors)
      ? body.errors.length > 0
      : body.errors && Object.keys(body.errors).length > 0;
    return hasErrors ? "down" : "ok";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}
