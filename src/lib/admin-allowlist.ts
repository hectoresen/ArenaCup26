/**
 * Allowlist hardcoded de emails con permiso para entrar al panel
 * `admin.arenacup26.com`. Defense-in-depth con `users.is_admin`:
 *
 *  - Para entrar al admin, el user necesita **ambos**:
 *      1. `users.is_admin = true` en BD (setea Hector a mano vía psql).
 *      2. Email en este Set (commit en git, traceable).
 *
 * Si alguien lograse setear `is_admin=true` para un email no
 * autorizado (SQL injection futura, bug en alguna server action),
 * el admin sigue protegido porque la auth gate también valida la
 * allowlist. Y al revés: añadir un email aquí sin tocar BD tampoco
 * concede acceso.
 *
 * Para añadir un admin:
 *  1. Añadir email aquí + PR para que quede en git history.
 *  2. `UPDATE users SET is_admin = true WHERE email = '...'` en
 *     prod (via railway-connect o psql con DATABASE_PUBLIC_URL).
 *
 * Para revocar: misma ruta inversa (remover de Set + `is_admin=false`).
 */
export const ADMIN_EMAILS: ReadonlySet<string> = new Set([
  "inforeshector@gmail.com",
]);

/**
 * `true` si el email del session está en la allowlist. No comprueba
 * `is_admin` (eso lo hace la utility `requireAdmin` en server).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
