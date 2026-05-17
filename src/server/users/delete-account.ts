"use server";

import { eq } from "drizzle-orm";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { dlog } from "@/lib/debug-log";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { DELETE_CONFIRMATION_PHRASE } from "./delete-account-constants";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "confirmation_mismatch" };

/**
 * Borra la cuenta del user actual y todos sus datos asociados.
 *
 * Eficiencia + seguridad: `DELETE FROM users WHERE id = $1` cascadea
 * a todas las tablas con FK `onDelete: 'cascade'` (predictions,
 * friendships, push_subscriptions, ranking_snapshots, etc.), por lo
 * que un único statement borra todo el footprint del usuario.
 *
 * Defensa: requiere que `confirm` coincida exactamente con la frase
 * canónica (constante exportada para que la UI muestre la misma) —
 * evita borrar cuentas por error.
 *
 * Tras el delete, llamamos a `signOut` (Auth.js v5) y devolvemos
 * `ok: true`. El caller cliente debe redirigir a `/` tras el éxito.
 *
 * RGPD: cumple el derecho al borrado (art. 17). El plazo de 30 días
 * citado en `/legal/privacy` es para procesar peticiones por email —
 * cuando el user lo hace self-service desde la UI es inmediato.
 */
export async function deleteAccount(confirm: string): Promise<DeleteAccountResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, code: "unauthorized" };

  if (confirm.trim() !== DELETE_CONFIRMATION_PHRASE) {
    return { ok: false, code: "confirmation_mismatch" };
  }

  const userId = session.user.id;
  await db.delete(users).where(eq(users.id, userId));
  dlog("ranking", "account deleted by user", { userId });

  // signOut limpia la cookie de sesión. Pasamos redirect: false
  // para que el cliente controle la navegación (mostrar un toast
  // breve + redirect explícito a /).
  await signOut({ redirect: false });

  return { ok: true };
}
