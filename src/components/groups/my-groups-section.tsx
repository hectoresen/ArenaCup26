import { useTranslations } from "next-intl";
import type { GroupSummary } from "@/server/groups/types";
import { Link } from "@/i18n/navigation";
import { GroupCard } from "./group-card";

type Props = {
  groups: GroupSummary[];
  /** Cap configurado en `caps.MAX_GROUPS_PER_USER`. */
  maxGroups: number;
};

/**
 * Sección "Mis grupos" en `/social`. Lista las cards de los grupos
 * activos del viewer + CTA para crear uno nuevo (si no está al cap).
 * Empty state explicativo si no tiene ninguno.
 */
export function MyGroupsSection({ groups, maxGroups }: Props) {
  const t = useTranslations("groups.mySection");
  const atCap = groups.length >= maxGroups;

  return (
    <section className="mt-7">
      <header className="mb-3 flex items-center gap-2.5">
        <span aria-hidden="true" className="text-[14px] leading-none text-gold">
          ◈
        </span>
        <h2 className="font-display text-[13px] uppercase tracking-[0.12em] text-gold">
          {t("title")}
        </h2>
        <span className="rounded-full border-[1.5px] border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-gold">
          {t("count", { count: groups.length, max: maxGroups })}
        </span>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-5 text-center">
          <p className="mb-3 text-[12px] font-bold text-muted">
            {t("emptyCopy")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/social/grupos/nuevo"
              className="rounded-full bg-gold px-4 py-2 text-[12px] font-black uppercase tracking-[0.1em] text-background hover:bg-gold-deep"
            >
              {t("create")}
            </Link>
            <Link
              href="/social/grupos/descubrir"
              className="rounded-full border-2 border-border bg-card px-4 py-2 text-[12px] font-black uppercase tracking-[0.1em] text-foreground hover:border-gold/40"
            >
              {t("discover")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            {!atCap && (
              <Link
                href="/social/grupos/nuevo"
                className="rounded-full bg-gold px-3.5 py-1.5 text-[12px] font-black uppercase tracking-[0.1em] text-background hover:bg-gold-deep"
              >
                {t("newShort")}
              </Link>
            )}
            <Link
              href="/social/grupos/descubrir"
              className="rounded-full border-2 border-border bg-card px-3.5 py-1.5 text-[12px] font-black uppercase tracking-[0.1em] text-foreground hover:border-gold/40"
            >
              {t("discoverPublic")}
            </Link>
          </div>
          {atCap && (
            <p className="pt-1 text-[11px] font-bold text-muted">
              {t("atCap", { max: maxGroups })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
