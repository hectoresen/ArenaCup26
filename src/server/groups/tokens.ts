import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Genera un token de invitación de grupo. Mismo formato que los
 * tokens de invitación a la app (`server/invitations/redemption.ts`):
 * base64url de 16 bytes ≈ 22 chars URL-safe. Suficiente entropía
 * para no preocuparse por colisiones (2^128 espacio).
 */
export function generateGroupLinkToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * URL completa del invite link, construida desde el token y el
 * `NEXT_PUBLIC_APP_URL`. Pure function — centralizada aquí para
 * que cualquier consumer (admin panel, share button, push body)
 * emita exactamente el mismo formato.
 */
export function buildGroupInviteUrl(token: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/social/grupos/unirse/${encodeURIComponent(token)}`;
}
