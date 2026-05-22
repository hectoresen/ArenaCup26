"use client";

import { adjustPointsAction } from "@/server/admin/actions/adjust-points";
import { banUserAction, unbanUserAction } from "@/server/admin/actions/ban-user";
import { revokeUserSessionsAction } from "@/server/admin/actions/revoke-sessions";
import { useState, useTransition } from "react";

const BAN_DURATIONS = [
  { label: "24 horas", hours: 24 },
  { label: "7 días", hours: 24 * 7 },
  { label: "30 días", hours: 24 * 30 },
  { label: "Permanente", hours: null },
] as const;

type Feedback = { kind: "ok" | "err"; text: string } | null;

export function UserActions({
  userId,
  userName,
  isBanned,
  isSelf,
  isBot,
}: {
  userId: string;
  userName: string | null;
  isBanned: boolean;
  isSelf: boolean;
  isBot: boolean;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-sm uppercase tracking-[0.14em] text-slate-300">Acciones</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {isBanned ? (
          <UnbanCard userId={userId} userName={userName} />
        ) : (
          <BanCard userId={userId} userName={userName} disabled={isSelf} />
        )}
        <AdjustPointsCard userId={userId} userName={userName} isBot={isBot} />
        <RevokeSessionsCard userId={userId} userName={userName} isSelf={isSelf} />
      </div>
    </section>
  );
}

function BanCard({
  userId,
  userName,
  disabled,
}: {
  userId: string;
  userName: string | null;
  disabled: boolean;
}) {
  const [hours, setHours] = useState<number | null>(24);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const until =
        hours === null ? "permanent" : new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const r = await banUserAction({
        userId,
        until,
        reason: reason.trim() || null,
      });
      if (r.ok) {
        setFeedback({ kind: "ok", text: "Usuario baneado." });
        setConfirm(false);
      } else {
        setFeedback({ kind: "err", text: `Error: ${r.error}` });
      }
    });
  }

  return (
    <Card title="Banear usuario" tone="amber">
      <p className="text-xs text-slate-400">
        Bloquea el acceso de <strong>{userName ?? "este usuario"}</strong>. Puedes elegir duración
        temporal o permanente. La sesión activa se mantiene hasta que cierre o forces logout.
      </p>
      <div className="space-y-2">
        <label
          htmlFor={`ban-duration-${userId}`}
          className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
        >
          Duración
        </label>
        <select
          id={`ban-duration-${userId}`}
          value={hours === null ? "perm" : String(hours)}
          onChange={(e) => setHours(e.target.value === "perm" ? null : Number(e.target.value))}
          className="w-full cursor-pointer rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-gold focus:outline-none"
        >
          {BAN_DURATIONS.map((d) => (
            <option key={d.label} value={d.hours === null ? "perm" : String(d.hours)}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label
          htmlFor={`ban-reason-${userId}`}
          className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
        >
          Motivo (opcional)
        </label>
        <input
          id={`ban-reason-${userId}`}
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Spam, abuso, multi-cuenta…"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
        />
      </div>
      {disabled ? (
        <p className="text-xs text-slate-500">No puedes banearte a ti mismo desde el panel.</p>
      ) : confirm ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="cursor-pointer rounded-md border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
          >
            {pending ? "Aplicando…" : "Confirmar ban"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="cursor-pointer text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="cursor-pointer rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/20"
        >
          Banear…
        </button>
      )}
      <FeedbackLine feedback={feedback} />
    </Card>
  );
}

function UnbanCard({ userId, userName }: { userId: string; userName: string | null }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const r = await unbanUserAction({ userId });
      if (r.ok) setFeedback({ kind: "ok", text: "Usuario desbaneado." });
      else setFeedback({ kind: "err", text: `Error: ${r.error}` });
    });
  }

  return (
    <Card title="Desbanear usuario" tone="emerald">
      <p className="text-xs text-slate-400">
        Reabre el acceso de <strong>{userName ?? "este usuario"}</strong>.
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="cursor-pointer rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
      >
        {pending ? "Aplicando…" : "Desbanear"}
      </button>
      <FeedbackLine feedback={feedback} />
    </Card>
  );
}

function AdjustPointsCard({
  userId,
  userName,
  isBot,
}: {
  userId: string;
  userName: string | null;
  isBot: boolean;
}) {
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  function submit() {
    setFeedback(null);
    const deltaNum = Number.parseInt(delta, 10);
    if (Number.isNaN(deltaNum) || deltaNum === 0) {
      setFeedback({ kind: "err", text: "Delta debe ser un entero no cero." });
      return;
    }
    if (reason.trim().length === 0) {
      setFeedback({ kind: "err", text: "Motivo obligatorio." });
      return;
    }
    startTransition(async () => {
      const r = await adjustPointsAction({
        userId,
        delta: deltaNum,
        reason: reason.trim(),
      });
      if (r.ok) {
        setFeedback({ kind: "ok", text: `${deltaNum > 0 ? "+" : ""}${deltaNum} pts aplicados.` });
        setDelta("0");
        setReason("");
      } else {
        setFeedback({ kind: "err", text: `Error: ${r.error}` });
      }
    });
  }

  return (
    <Card title="Ajustar puntos" tone="gold">
      <p className="text-xs text-slate-400">
        Delta de puntos para <strong>{userName ?? "este usuario"}</strong>
        {isBot && " (bot)"}. Positivo suma, negativo resta. Queda registrado en point_events como{" "}
        <code className="rounded bg-slate-800 px-1 text-[10px]">manual_adjustment</code>.
      </p>
      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <div>
          <label
            htmlFor={`points-delta-${userId}`}
            className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
          >
            Delta
          </label>
          <input
            id={`points-delta-${userId}`}
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            min={-10000}
            max={10000}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-100 focus:border-gold focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor={`points-reason-${userId}`}
            className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400"
          >
            Motivo
          </label>
          <input
            id={`points-reason-${userId}`}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Compensación por bug, premio…"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold focus:outline-none"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="cursor-pointer rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
      >
        {pending ? "Aplicando…" : "Aplicar ajuste"}
      </button>
      <FeedbackLine feedback={feedback} />
    </Card>
  );
}

function RevokeSessionsCard({
  userId,
  userName,
  isSelf,
}: {
  userId: string;
  userName: string | null;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const r = await revokeUserSessionsAction({ userId });
      if (r.ok) {
        setFeedback({
          kind: "ok",
          text:
            r.revoked === 0 ? "No había sesiones activas." : `${r.revoked} sesión(es) cerrada(s).`,
        });
        setConfirm(false);
      } else {
        setFeedback({ kind: "err", text: `Error: ${r.error}` });
      }
    });
  }

  return (
    <Card title="Forzar logout" tone="rose">
      <p className="text-xs text-slate-400">
        Borra todas las sesiones de <strong>{userName ?? "este usuario"}</strong>. Le obliga a
        re-autenticar.{" "}
        {isSelf && (
          <span className="font-bold text-rose-300">Esto te cerraría tu propia sesión.</span>
        )}
      </p>
      {confirm ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="cursor-pointer rounded-md border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-100 transition-colors hover:bg-rose-500/30 disabled:opacity-50"
          >
            {pending ? "Aplicando…" : "Confirmar logout"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="cursor-pointer text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="cursor-pointer rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 transition-colors hover:bg-rose-500/20"
        >
          Cerrar sesiones…
        </button>
      )}
      <FeedbackLine feedback={feedback} />
    </Card>
  );
}

function Card({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "amber" | "emerald" | "gold" | "rose";
  children: React.ReactNode;
}) {
  const border = {
    amber: "border-amber-500/30",
    emerald: "border-emerald-500/30",
    gold: "border-gold/30",
    rose: "border-rose-500/30",
  }[tone];
  return (
    <div className={`space-y-3 rounded-xl border ${border} bg-slate-900 p-4`}>
      <div className="font-display text-xs uppercase tracking-[0.14em] text-slate-300">{title}</div>
      {children}
    </div>
  );
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      className={
        feedback.kind === "ok"
          ? "text-xs font-bold text-emerald-300"
          : "text-xs font-bold text-rose-300"
      }
    >
      {feedback.text}
    </p>
  );
}
