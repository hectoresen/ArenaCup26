import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export type MatchesView = "todos" | "bracket";

type Props = {
  active: MatchesView;
};

/**
 * Tabs internas de `/partidos`. Cambia el querystring `?vista=` para
 * preservar back/forward del navegador y permitir compartir URL
 * directa al bracket. Sin estado cliente — son `<Link>` puros.
 */
export function MatchesTabs({ active }: Props) {
  const t = useTranslations("matches.tabs");
  return (
    <nav
      aria-label={t("ariaLabel")}
      className="mb-5 inline-flex items-center gap-1 rounded-full border-2 border-border bg-card p-1"
    >
      <TabLink view="todos" active={active} label={t("todos")} />
      <TabLink view="bracket" active={active} label={t("bracket")} />
    </nav>
  );
}

function TabLink({
  view,
  active,
  label,
}: {
  view: MatchesView;
  active: MatchesView;
  label: string;
}) {
  const isActive = view === active;
  // "Todos" no añade param (default); "Bracket" sí.
  const href = view === "todos" ? "/partidos" : "/partidos?vista=bracket";
  return (
    <Link
      href={href as never}
      aria-current={isActive ? "page" : undefined}
      className={`cursor-pointer rounded-full px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] no-underline transition-colors ${
        isActive
          ? "bg-gold text-black"
          : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
