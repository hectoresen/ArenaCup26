"use server";

import { checkAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/server/admin/audit";
import { broadcastToHumans } from "@/server/admin/broadcast";
import { z } from "zod";

const BroadcastSchema = z.object({
  title: z.string().trim().min(1, "title-required").max(140, "title-too-long"),
  body: z.string().trim().max(500, "body-too-long").nullable(),
});

export type SendBroadcastResult = { ok: true; recipients: number } | { ok: false; error: string };

export async function sendBroadcast(input: unknown): Promise<SendBroadcastResult> {
  const check = await checkAdmin();
  if (!check.ok) return { ok: false, error: "no-permission" };

  const parsed = BroadcastSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid-input" };
  }

  const body = parsed.data.body?.length ? parsed.data.body : null;
  const result = await broadcastToHumans({ title: parsed.data.title, body });

  await logAdminAction({
    adminUserId: check.user.id,
    action: "broadcast_sent",
    payload: { title: parsed.data.title, body, recipients: result.recipients },
  });

  return { ok: true, recipients: result.recipients };
}
