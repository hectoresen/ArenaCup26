"use client";

import { useState } from "react";
import { GroupRankingList } from "@/components/groups/group-ranking-list";
import { Link } from "@/i18n/navigation";
import { GROUP_COLOR_STYLES } from "@/lib/group-colors";
import type { GroupColor } from "@/server/db/schema";
import type { GroupRankingEntry } from "@/server/groups/types";

export type GroupTabData = {
  groupId: string;
  groupName: string;
  groupColor: GroupColor;
  ranking: GroupRankingEntry[];
};

type Props = {
  /** Renderizable del ranking global. Lo pasamos como children para
   * no duplicar imports de `LeaderboardView` aquí — el server component
   * compone `<RankingScopeTabs globalContent={<LeaderboardView ... />} ... />`.
   */
  globalContent: React.ReactNode;
  groups: GroupTabData[];
  viewerUserId: string | null;
};

/**
 * Selector horizontal arriba de `/ranking` para alternar entre el
 * ranking global y los rankings de los grupos del viewer.
 *
 * - Si el viewer tiene grupos → tabs `[Global][Grupo X][Grupo Y]…`.
 * - Si no tiene grupos → solo `[Global]` + CTA `+ Crear grupo` que
 *   linka a `/social/grupos/nuevo`. Así la feature es **descubrible**
 *   sin necesidad de que el user llegue por casualidad a /social.
 *
 * Las "tabs" son scrolleables horizontalmente en móvil (overflow-x).
 * Cada tab de grupo se pinta con el color del grupo cuando está
 * activa, replicando la identidad visual del detalle.
 */
export function RankingScopeTabs({ globalContent, groups, viewerUserId }: Props) {
  const [active, setActive] = useState<"global" | string>("global");
  const activeGroup = active === "global" ? null : groups.find((g) => g.groupId === active);

  return (
    <div className="w-full">
      <div className="mb-4 -mx-1 overflow-x-auto">
        <div className="flex gap-2 px-1">
          <TabButton
            label="Global"
            active={active === "global"}
            onClick={() => setActive("global")}
          />
          {groups.map((g) => {
            const styles = GROUP_COLOR_STYLES[g.groupColor];
            const isActive = active === g.groupId;
            return (
              <button
                key={g.groupId}
                type="button"
                onClick={() => setActive(g.groupId)}
                className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[12px] font-black uppercase tracking-[0.1em] transition-colors ${
                  isActive
                    ? `${styles.bg} ${styles.text} border-transparent`
                    : "border-border bg-card text-muted hover:border-gold/40 hover:text-foreground"
                }`}
              >
                {g.groupName}
              </button>
            );
          })}
          <Link
            href={groups.length === 0 ? "/social/grupos/nuevo" : "/social"}
            className="shrink-0 rounded-full border-2 border-dashed border-gold/50 bg-gold/[0.06] px-3.5 py-1.5 text-[12px] font-black uppercase tracking-[0.1em] text-gold hover:bg-gold/[0.12]"
          >
            {groups.length === 0 ? "+ Crear grupo" : "+ Nuevo / unirse"}
          </Link>
        </div>
      </div>

      {activeGroup ? (
        <div className="mx-auto w-full max-w-[510px]">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
              {activeGroup.groupName}
            </h2>
            <span className="text-[11px] font-bold text-muted">
              {activeGroup.ranking.length}{" "}
              {activeGroup.ranking.length === 1 ? "miembro" : "miembros"}
            </span>
          </header>
          <GroupRankingList entries={activeGroup.ranking} viewerUserId={viewerUserId} />
        </div>
      ) : (
        globalContent
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[12px] font-black uppercase tracking-[0.1em] transition-colors ${
        active
          ? "border-transparent bg-gold text-background"
          : "border-border bg-card text-muted hover:border-gold/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
