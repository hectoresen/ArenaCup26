import { getMaintenanceMode } from "@/server/admin/settings";

/**
 * Banner sticky en la parte superior cuando el modo mantenimiento
 * está activo. SSR-only — el server lee el estado y, si está apagado,
 * no monta nada en el HTML. Coste: 1 query por request.
 *
 * No tiene botón de cerrar — el banner debe seguir visible durante
 * toda la sesión hasta que el admin lo desactive.
 */
export async function MaintenanceBanner() {
  const m = await getMaintenanceMode();
  if (!m.enabled) return null;

  const message =
    m.message ?? "Estamos haciendo mejoras. Algunas acciones están pausadas temporalmente.";

  return (
    <output className="sticky top-0 z-40 block border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs font-bold text-amber-200 backdrop-blur">
      <span aria-hidden className="me-1">
        ⚠
      </span>
      {message}
    </output>
  );
}
