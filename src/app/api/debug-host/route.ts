import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Debug temporal — devuelve los headers que el server ve. Usado para
 * diagnosticar por qué Auth.js v5 + trustHost=true no detecta el host
 * desde X-Forwarded-Host en Railway multi-domain. Borrar cuando se
 * resuelva el flow de admin signin.
 */
export async function GET() {
  const h = await headers();
  const interesting = {
    host: h.get("host"),
    "x-forwarded-host": h.get("x-forwarded-host"),
    "x-forwarded-proto": h.get("x-forwarded-proto"),
    "x-forwarded-for": h.get("x-forwarded-for"),
    "x-railway-edge": h.get("x-railway-edge"),
    "x-railway-request-id": h.get("x-railway-request-id"),
    origin: h.get("origin"),
    referer: h.get("referer"),
    "user-agent": h.get("user-agent")?.slice(0, 60),
    env_AUTH_URL: process.env.AUTH_URL ?? null,
    env_NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    env_AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? null,
    env_PORT: process.env.PORT ?? null,
    env_HOSTNAME: process.env.HOSTNAME ?? null,
  };
  return NextResponse.json(interesting, { status: 200 });
}
