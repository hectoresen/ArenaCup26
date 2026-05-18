"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteGroup,
  transferAdmin,
  updateGroup,
} from "@/server/groups/actions";
import { cancelGroupInvitation, createGroupInvitation } from "@/server/groups/invitations";
import { createGroupLink, revokeGroupLink } from "@/server/groups/links";
import { expelMember } from "@/server/groups/membership";
import type {
  GroupDetail,
  GroupInvitationRow,
  GroupLinkRow,
  GroupMemberRow,
} from "@/server/groups/types";
import { MAX_LINKS_PER_GROUP } from "@/server/groups/caps";

type Friend = {
  id: string;
  name: string | null;
  username: string | null;
};

type Props = {
  group: GroupDetail;
  /** Miembros activos (incluido admin). */
  members: GroupMemberRow[];
  /** Invitaciones pending salientes. */
  pendingInvitations: Array<GroupInvitationRow & { inviteeName: string | null; inviteeUsername: string | null }>;
  /** Links de invitación (incluye revocados para histórico). */
  links: GroupLinkRow[];
  /** Friends del viewer que se pueden invitar (no son ya members ni pending). */
  invitableFriends: Friend[];
}

/**
 * Panel admin del grupo. Solo se renderiza si `group.viewerIsAdmin`.
 * Agrupa todas las acciones que el admin puede hacer en accordion
 * para no saturar la pantalla:
 *  - Invitar amigos (modal con lista).
 *  - Generar / revocar links de invitación.
 *  - Expulsar miembros.
 *  - Transferir admin.
 *  - Editar nombre/color/visibility/maxMembers.
 *  - Borrar grupo (con confirm).
 */
export function GroupAdminPanel({
  group,
  members,
  pendingInvitations,
  links,
  invitableFriends,
}: Props) {
  return (
    <section className="mt-6 space-y-3">
      <header className="flex items-center gap-2.5">
        <span aria-hidden="true" className="text-[14px] leading-none text-gold">◈</span>
        <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
          Panel admin
        </h2>
      </header>

      <InvitePanel groupId={group.id} friends={invitableFriends} pending={pendingInvitations} />
      <LinksPanel groupId={group.id} links={links} />
      <MembersPanel groupId={group.id} groupName={group.name} members={members} />
      <DangerZone group={group} />
    </section>
  );
}

function InvitePanel({
  groupId,
  friends,
  pending,
}: {
  groupId: string;
  friends: Friend[];
  pending: Array<GroupInvitationRow & { inviteeName: string | null; inviteeUsername: string | null }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function invite(friendId: string) {
    setPendingIds((s) => new Set(s).add(friendId));
    startTransition(async () => {
      const res = await createGroupInvitation({ groupId, inviteeId: friendId });
      if (!res.ok) {
        setPendingIds((s) => {
          const next = new Set(s);
          next.delete(friendId);
          return next;
        });
      } else {
        router.refresh();
      }
    });
  }

  function cancel(invitationId: string) {
    startTransition(async () => {
      const res = await cancelGroupInvitation({ invitationId });
      if (res.ok) router.refresh();
    });
  }

  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-2xl border-2 border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 font-display text-[14px] text-foreground">
        Invitar amigos
        {pending.length > 0 && (
          <span className="ml-2 rounded-full bg-card-hover px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted">
            {pending.length} pending
          </span>
        )}
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-4">
        {friends.length === 0 ? (
          <p className="text-[12px] font-bold text-muted">
            No tienes amigos disponibles para invitar. Comparte un link
            de invitación con quien quieras.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold text-foreground">
                    {f.name ?? f.username ?? "Sin nombre"}
                  </div>
                  {f.username && (
                    <div className="text-[11px] text-muted">@{f.username}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => invite(f.id)}
                  disabled={pendingIds.has(f.id) || isPending}
                  className="rounded-full bg-gold px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-background hover:bg-gold-deep disabled:opacity-50"
                >
                  Invitar
                </button>
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <div className="border-t border-border pt-3">
            <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.1em] text-muted">
              Pending
            </h3>
            <ul className="space-y-1.5">
              {pending.map((p) => (
                <li key={p.invitationId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
                    {p.inviteeName ?? p.inviteeUsername ?? "Sin nombre"}
                  </div>
                  <button
                    type="button"
                    onClick={() => cancel(p.invitationId)}
                    disabled={isPending}
                    className="rounded-full border border-border bg-card-hover px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-muted hover:border-red-500/40 hover:text-foreground disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function LinksPanel({ groupId, links }: { groupId: string; links: GroupLinkRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [maxUses, setMaxUses] = useState(0);
  const activeLinks = links.filter((l) => !l.revokedAt);
  const atCap = activeLinks.length >= MAX_LINKS_PER_GROUP;

  function generate() {
    if (atCap) return;
    startTransition(async () => {
      const res = await createGroupLink({ groupId, maxUses });
      if (res.ok && res.url) {
        try {
          await navigator.clipboard?.writeText(res.url);
        } catch {
          // ignore — el link estará visible en la lista igualmente
        }
        router.refresh();
      }
    });
  }

  function revoke(linkId: string) {
    startTransition(async () => {
      const res = await revokeGroupLink({ linkId });
      if (res.ok) router.refresh();
    });
  }

  return (
    <details className="rounded-2xl border-2 border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 font-display text-[14px] text-foreground">
        Links de invitación
        <span className="ml-2 rounded-full bg-card-hover px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted">
          {activeLinks.length}/{MAX_LINKS_PER_GROUP} activos
        </span>
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-muted">
              Usos máximos (0 = ilimitado)
            </span>
            <input
              type="number"
              min={0}
              max={1000}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border-2 border-border bg-card-hover px-3 py-2 text-[14px] text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={atCap || isPending}
            className="rounded-full bg-gold px-4 py-2 text-[12px] font-black uppercase tracking-[0.1em] text-background hover:bg-gold-deep disabled:opacity-50"
          >
            Generar link
          </button>
        </div>
        {atCap && (
          <p className="text-[11px] font-bold text-warm">
            Has alcanzado el cap de {MAX_LINKS_PER_GROUP} links activos.
            Revoca uno para crear otro.
          </p>
        )}
        {links.length === 0 ? (
          <p className="text-[12px] font-bold text-muted">
            No tienes links de invitación. Genera uno para compartir.
          </p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const exhausted = l.maxUses > 0 && l.uses >= l.maxUses;
              return (
                <li key={l.linkId} className="rounded-xl border border-border bg-card-hover/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-bold text-muted">
                      {l.url}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(l.url)}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-foreground hover:border-gold/40"
                      >
                        Copiar
                      </button>
                      {!l.revokedAt && (
                        <button
                          type="button"
                          onClick={() => revoke(l.linkId)}
                          disabled={isPending}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted hover:border-red-500/40 hover:text-foreground disabled:opacity-50"
                        >
                          Revocar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-muted">
                    {l.uses} usos · {l.maxUses === 0 ? "ilimitado" : `cap ${l.maxUses}`}
                    {l.revokedAt ? " · revocado" : exhausted ? " · agotado" : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

function MembersPanel({
  groupId,
  groupName,
  members,
}: {
  groupId: string;
  groupName: string;
  members: GroupMemberRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);

  function expel(memberUserId: string) {
    startTransition(async () => {
      const res = await expelMember({ groupId, memberUserId });
      if (res.ok) {
        setConfirmId(null);
        router.refresh();
      }
    });
  }

  function transfer(newAdminUserId: string) {
    startTransition(async () => {
      const res = await transferAdmin({ groupId, newAdminUserId });
      if (res.ok) {
        setTransferId(null);
        router.refresh();
      }
    });
  }

  return (
    <details className="rounded-2xl border-2 border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 font-display text-[14px] text-foreground">
        Gestionar miembros
      </summary>
      <div className="space-y-2 border-t border-border px-4 py-4">
        {members.length === 0 ? (
          <p className="text-[12px] font-bold text-muted">Sin miembros aún.</p>
        ) : (
          members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card-hover/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-foreground">
                  {m.name}
                  {m.role === "admin" && (
                    <span className="ml-1.5 rounded-full border border-gold/40 bg-gold/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.1em] text-gold">
                      Admin
                    </span>
                  )}
                </div>
                {m.username && (
                  <div className="text-[11px] text-muted">@{m.username}</div>
                )}
              </div>
              {m.role !== "admin" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferId(m.userId)}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-foreground hover:border-gold/40"
                  >
                    Hacer admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(m.userId)}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted hover:border-red-500/40 hover:text-foreground"
                  >
                    Expulsar
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {confirmId && (
          <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-3">
            <p className="mb-2 text-[12px] font-bold text-foreground">
              ¿Expulsar a este miembro? Recibirá una notificación.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => expel(confirmId)}
                disabled={isPending}
                className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-white hover:bg-red-600 disabled:opacity-50"
              >
                Expulsar
              </button>
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {transferId && (
          <div className="rounded-2xl border-2 border-gold/40 bg-gold/[0.06] p-3">
            <p className="mb-2 text-[12px] font-bold text-foreground">
              ¿Hacer admin a este miembro? Tú pasarás a ser miembro normal.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => transfer(transferId)}
                disabled={isPending}
                className="rounded-full bg-gold px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-background hover:bg-gold-deep disabled:opacity-50"
              >
                Transferir
              </button>
              <button
                type="button"
                onClick={() => setTransferId(null)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function DangerZone({ group }: { group: GroupDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [visibility, setVisibility] = useState(group.visibility);
  const [maxMembers, setMaxMembers] = useState(group.maxMembers);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateGroup({
        groupId: group.id,
        name: name.trim().length >= 3 ? name.trim() : undefined,
        visibility,
        maxMembers,
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(
          res.code === "max_members_below_count"
            ? "El cap no puede ser menor que el número actual de miembros"
            : "No se pudo actualizar el grupo",
        );
      }
    });
  }

  function destroy() {
    startTransition(async () => {
      const res = await deleteGroup(group.id);
      if (res.ok) {
        router.push("/social");
        router.refresh();
      }
    });
  }

  return (
    <details className="rounded-2xl border-2 border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 font-display text-[14px] text-foreground">
        Ajustes & cierre
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-4">
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border-2 border-border bg-card-hover px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-foreground hover:border-gold/40"
          >
            Editar nombre / visibilidad / cap
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-muted">Nombre</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="w-full rounded-xl border-2 border-border bg-card-hover px-3 py-2 text-[14px] text-foreground"
              />
            </label>
            <fieldset>
              <legend className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-muted">Visibilidad</legend>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "public" | "private")}
                className="w-full rounded-xl border-2 border-border bg-card-hover px-3 py-2 text-[14px] text-foreground"
              >
                <option value="private">Privado</option>
                <option value="public">Público</option>
              </select>
            </fieldset>
            <label className="block">
              <span className="mb-1 flex items-baseline justify-between text-[11px] font-black uppercase tracking-[0.1em] text-muted">
                Cap miembros <span className="text-foreground">{maxMembers}</span>
              </span>
              <input
                type="range"
                min={5}
                max={100}
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full accent-gold"
              />
            </label>
            {error && (
              <div className="rounded-xl border-2 border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-300">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className="rounded-full bg-gold px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-background hover:bg-gold-deep disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(group.name);
                  setVisibility(group.visibility);
                  setMaxMembers(group.maxMembers);
                  setError(null);
                }}
                className="rounded-full border border-border bg-card-hover px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-3">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-full border-2 border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-red-300 hover:bg-red-500/20"
            >
              Borrar grupo
            </button>
          ) : (
            <div className="rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-3">
              <p className="mb-2 text-[12px] font-bold text-foreground">
                ¿Borrar el grupo "{group.name}"? Esta acción no se puede deshacer.
                Todos los miembros recibirán una notificación.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={destroy}
                  disabled={isPending}
                  className="rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Borrar definitivamente
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
