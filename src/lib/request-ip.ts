/**
 * Extrae la IP del cliente de las cabeceras del request actual.
 *
 * En Railway (y cualquier proxy frontal: Vercel, Cloudflare, etc.)
 * la IP real del cliente NO está en `request.connection.remoteAddress`
 * — viene en `x-forwarded-for` (puede ser una lista separada por
 * comas si hubo multiples proxies). Cogemos el primer elemento, que
 * es siempre el cliente original.
 *
 * Si no hay ningún header de IP disponible, devolvemos `"unknown"`.
 * Eso hace que el rate-limit cuente todos los anónimos contra el
 * mismo bucket — peor para usuarios legítimos detrás de NAT raros,
 * pero seguro contra atacantes.
 */
export function getRequestIp(
  headers: { get: (name: string) => string | null } | Headers,
): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
