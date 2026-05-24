"use server";

import { checkAdmin } from "@/lib/admin-auth";
import { dlog } from "@/lib/debug-log";
import { logAdminAction } from "@/server/admin/audit";
import {
  TargetSchema,
  estimateTargetRecipients,
  sendTargetedBroadcast,
} from "@/server/admin/targeted-broadcast";
import { z } from "zod";

const BroadcastSchema = z.object({
  title: z.string().trim().min(1, "title-required").max(140, "title-too-long"),
  body: z.string().trim().max(500, "body-too-long").nullable(),
  target: TargetSchema,
});

export type SendBroadcastResult =
  | { ok: true; recipients: number; notFoundIdentifiers: string[] }
  | { ok: false; error: string };

export async function sendBroadcast(input: unknown): Promise<SendBroadcastResult> {
  dlog("ranking", "sendBroadcast invoked", {
    kind: (input as { target?: { kind?: string } })?.target?.kind,
  });
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = BroadcastSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid-input" };
  }

  const body = parsed.data.body?.length ? parsed.data.body : null;
  const result = await sendTargetedBroadcast({
    title: parsed.data.title,
    body,
    target: parsed.data.target,
  });

  await logAdminAction({
    adminUserId: check.user.id,
    action: "broadcast_sent",
    payload: {
      title: parsed.data.title,
      body,
      target: parsed.data.target,
      recipients: result.recipients,
      notFoundCount: result.notFoundIdentifiers.length,
    },
  });

  return {
    ok: true,
    recipients: result.recipients,
    notFoundIdentifiers: result.notFoundIdentifiers,
  };
}

export type PreviewResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Devuelve cuántos users coincidirían con el target sin enviar.
 * Llamado por el cliente al cambiar filtros, para que la UI muestre
 * "Se enviará a N usuarios" antes de pulsar Enviar.
 */
export async function previewBroadcastTarget(input: unknown): Promise<PreviewResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = TargetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid-input" };

  const count = await estimateTargetRecipients(parsed.data);
  return { ok: true, count };
}
