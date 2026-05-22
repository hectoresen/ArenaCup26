import { db } from "@/server/db/client";
import { appSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

/**
 * Settings globales del sistema. Singleton key/value en `app_settings`.
 * Cada key tiene su propio schema Zod para validar tanto en lectura
 * como en escritura, así que valores corruptos en BD (manual SQL, etc)
 * fallan fuerte en vez de propagar bugs raros.
 */

const MaintenanceSchema = z.object({
  enabled: z.boolean(),
  /** Mensaje custom que muestra el banner. `null` usa el copy default. */
  message: z.string().max(280).nullable(),
});

export type MaintenanceMode = z.infer<typeof MaintenanceSchema>;

const DEFAULT_MAINTENANCE: MaintenanceMode = { enabled: false, message: null };

/**
 * Lee el estado actual del modo mantenimiento. Si no existe la fila
 * (primera vez), devuelve el default `{ enabled: false }` sin escribir
 * en BD — escribir es responsabilidad del setter.
 *
 * Hot-path: lo llama el banner global y el guardrail de cada server
 * action de mutación. Coste: 1 query indexada por PK. Si pesa, lo
 * envolvemos con `unstable_cache` en el futuro — por ahora trade-off
 * favorece simplicidad sobre micro-optimización.
 */
export async function getMaintenanceMode(): Promise<MaintenanceMode> {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "maintenance"))
    .limit(1);

  const row = rows[0];
  if (!row) return DEFAULT_MAINTENANCE;

  const parsed = MaintenanceSchema.safeParse(row.value);
  if (!parsed.success) return DEFAULT_MAINTENANCE;
  return parsed.data;
}

/**
 * Setea el estado del modo mantenimiento. Upsert por key. El caller
 * (server action admin) es responsable de validar permisos antes —
 * este módulo solo persiste.
 */
export async function setMaintenanceMode(input: {
  enabled: boolean;
  message: string | null;
  updatedBy: string;
}): Promise<void> {
  const value: MaintenanceMode = {
    enabled: input.enabled,
    message: input.message,
  };
  MaintenanceSchema.parse(value);

  await db
    .insert(appSettings)
    .values({
      key: "maintenance",
      value,
      updatedBy: input.updatedBy,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy: input.updatedBy, updatedAt: new Date() },
    });
}
