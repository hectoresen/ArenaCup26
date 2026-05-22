import { getMaintenanceMode } from "./settings";

/**
 * Error que las server actions de mutación levantan cuando hay
 * mantenimiento activo. El caller (form action) lo captura y
 * muestra un toast/error amigable. Tag exportable para `instanceof`.
 */
export class MaintenanceModeError extends Error {
  readonly kind = "maintenance_mode";
  constructor(message = "El servicio está en mantenimiento. Vuelve en unos minutos.") {
    super(message);
    this.name = "MaintenanceModeError";
  }
}

/**
 * Llamar al inicio de cualquier server action que MUTE estado del
 * dominio (predecir, cambiar nombre/avatar, enviar friend request,
 * crear/unirse a grupos…). Lanza `MaintenanceModeError` si el modo
 * está activo. Reads (ranking, perfiles, historial) NO se bloquean.
 *
 * Lecturas de admin (incluyendo este guardrail desde el toggle del
 * admin) NO deberían bloquearse — el admin necesita poder desactivar
 * el modo aunque esté activo. Llamar este guard solo en actions de
 * dominio público, no en server actions admin.
 */
export async function assertNotInMaintenance(): Promise<void> {
  const m = await getMaintenanceMode();
  if (m.enabled) {
    throw new MaintenanceModeError(
      m.message ?? "El servicio está en mantenimiento. Vuelve en unos minutos.",
    );
  }
}
