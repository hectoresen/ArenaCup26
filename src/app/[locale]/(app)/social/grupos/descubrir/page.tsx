import { DiscoverGroupCard } from "@/components/groups/discover-group-card";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getDiscoverableGroups } from "@/server/groups/queries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

export default async function DescubrirGruposPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "groups" });
  const td = await getTranslations({ locale, namespace: "groups.discover" });

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const { q, offset } = await searchParams;
  const search = (q ?? "").trim();
  const offsetN = Math.max(0, Number(offset ?? "0") || 0);

  const items = await getDiscoverableGroups(db, session.user.id, {
    search,
    offset: offsetN,
    limit: 30,
  });

  return (
    <>
      <header className="mb-5">
        <Link href="/social" className="text-[12px] font-bold text-muted hover:text-foreground">
          {t("backToSocial")}
        </Link>
        <h1 className="mt-2 font-display text-[26px] leading-none text-foreground">
          {td("headerTitle")}
        </h1>
        <p className="mt-1 text-[13px] font-bold text-muted">{td("headerSubtitle")}</p>
      </header>

      <form method="GET" className="mb-5">
        <label className="block">
          <span className="sr-only">{td("searchPlaceholder")}</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={td("searchPlaceholder")}
            className="w-full rounded-2xl border-2 border-border bg-card px-4 py-3 text-[15px] text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
          />
        </label>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-4 py-6 text-center text-[13px] font-bold text-muted">
          {search ? td("searchEmpty", { q: search }) : td("empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((g) => (
            <DiscoverGroupCard key={g.id} group={g} />
          ))}
        </div>
      )}
    </>
  );
}
