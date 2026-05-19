import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { GroupColor } from "@/server/db/schema";

export type RankingScope = "global" | "amigos" | "grupos";

export type GroupNavEntry = {
  groupId: string;
  groupName: string;
  groupColor: GroupColor;
};

type Props = {
  scope: RankingScope;
  /** Solo relevante cuando `scope === "grupos"`. ID del grupo activo. */
  activeGroupId: string | null;
  groups: GroupNavEntry[];
  hasFriends: boolean;
};

/**
 * Nav principal de `/ranking` con 3 tabs: Global · Amigos · Grupos.
 * Cuando `scope === "grupos"` se renderiza un sub-nav con pills por
 * cada grupo del viewer + CTA "+ Nuevo". Labels en i18n.
 */
export function RankingNav({ scope, activeGroupId, groups, hasFriends }: Props) {
  const t = useTranslations("groups.ranking");
  return (
    <div className="mb-4 w-full">
      <nav
        aria-label={t("scopeAria")}
        className="inline-flex items-center gap-1 rounded-full border-2 border-border bg-card p-1"
      >
        <NavPill href="/ranking" active={scope === "global"} label={t("tabGlobal")} />
        {hasFriends && (
          <NavPill
            href="/ranking?scope=amigos"
            active={scope === "amigos"}
            label={t("tabFriends")}
          />
        )}
        <NavPill
          href="/ranking?scope=grupos"
          active={scope === "grupos"}
          label={t("tabGroups")}
        />
      </nav>

      {scope === "grupos" && groups.length > 0 && (
        <div className="mt-3 -mx-1 overflow-x-auto">
          <div className="flex gap-2 px-1">
            {groups.map((g) => {
              const isActive = activeGroupId === g.groupId;
              return (
                <Link
                  key={g.groupId}
                  href={`/ranking?scope=grupos&g=${g.groupId}`}
                  scroll={false}
                  className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] no-underline transition-colors ${
                    isActive
                      ? "border-transparent bg-gold text-background"
                      : "border-border bg-card text-muted hover:border-gold/40 hover:text-foreground"
                  }`}
                >
                  {g.groupName}
                </Link>
              );
            })}
            <Link
              href="/social/grupos/nuevo"
              className="shrink-0 rounded-full border-2 border-dashed border-gold/50 bg-gold/[0.06] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-gold no-underline hover:bg-gold/[0.12]"
            >
              {t("newShort")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NavPill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href as never}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={`cursor-pointer rounded-full px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] no-underline transition-colors ${
        active ? "bg-gold text-black" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
