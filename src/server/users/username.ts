/**
 * Genera un slug de username a partir del nombre del provider (Google).
 *
 * Reglas:
 * - NFD + strip de diacríticos: "Cárlös" → "carlos".
 * - Lowercase, espacios y separadores → `-`.
 * - Solo `[a-z0-9-]`; cualquier otro caracter se descarta.
 * - Colapsa múltiples `-` y trim de bordes.
 * - Máximo 20 chars (límite del schema).
 * - Si tras la limpieza queda vacío, devuelve "user".
 *
 * Pure function — sin BD ni I/O. La colisión la resuelve el caller
 * via `resolveAvailableUsername`.
 */
export function slugifyName(name: string | null | undefined): string {
  if (!name) return "user";
  const slug = name
    .normalize("NFD")
    // Strip combining diacritical marks (U+0300..U+036F).
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20)
    .replace(/-$/g, ""); // borrar trailing "-" tras slice
  return slug.length > 0 ? slug : "user";
}

/**
 * Devuelve un username disponible a partir de un slug base. Si el slug
 * ya existe, intenta con sufijos numéricos `-2`, `-3`, …
 *
 * - `isTaken(candidate)` → `Promise<boolean>` lee de BD u otra fuente.
 *   Inyectable para tests offline.
 * - Cap defensivo de 100 intentos para evitar loops infinitos en
 *   condiciones extrañas (concurrencia, BD vacía). Si se agotan,
 *   se devuelve el último candidato igualmente; el insert posterior
 *   fallará por unique constraint y el caller decidirá qué hacer.
 *
 * El sufijo respeta el límite de 20 chars del schema cortando el
 * prefix cuando sea necesario.
 */
export async function resolveAvailableUsername(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base;

  const MAX_LENGTH = 20;
  for (let n = 2; n < 100; n++) {
    const suffix = `-${n}`;
    const allowed = MAX_LENGTH - suffix.length;
    const candidate = `${base.slice(0, allowed).replace(/-+$/g, "")}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Último recurso: timestamp corto. Garantiza unicidad práctica.
  const fallback = `user-${Date.now().toString(36).slice(-6)}`;
  return fallback.slice(0, MAX_LENGTH);
}
