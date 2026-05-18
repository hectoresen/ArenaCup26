import type { GroupSummary } from "@/server/groups/types";
import { Link } from "@/i18n/navigation";
import { GroupAvatar } from "./group-avatar";

type Props = {
  group: GroupSummary;
};

/**
 * Tarjeta clicable que enlaza al detalle del grupo. Muestra avatar
 * con color, nombre, count de miembros y badge si el viewer es admin.
 * Usado en `/social` (sección "Mis grupos") y en `/social/grupos/descubrir`
 * (sin badge admin, esos siempre son externos).
 */
export function GroupCard({ group }: Props) {
  return (
    <Link
      href={`/social/grupos/${group.id}`}
      className="group flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-3 transition-colors hover:border-gold/40 hover:bg-card-hover"
    >
      <GroupAvatar color={group.color} name={group.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] leading-tight text-foreground">
            {group.name}
          </span>
          {group.viewerRole === "admin" && (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-gold">
              Admin
            </span>
          )}
          {group.visibility === "public" && group.viewerRole === null && (
            <span className="rounded-full border border-border bg-card-hover/60 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-muted">
              Público
            </span>
          )}
        </div>
        <div className="text-[12px] font-bold text-muted">
          {group.memberCount} {group.memberCount === 1 ? "miembro" : "miembros"}
          {group.maxMembers ? ` · cap ${group.maxMembers}` : ""}
        </div>
      </div>
      <span aria-hidden="true" className="font-display text-base text-muted transition-transform group-hover:translate-x-0.5">
        ›
      </span>
    </Link>
  );
}
