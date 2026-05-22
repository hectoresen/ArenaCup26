import { DiscoverGroupCard } from "@/components/groups/discover-group-card";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { getDiscoverableGroups } from "@/server/groups/queries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

type SearchParams = Promise<{
  q?: string;
  offset?: string;
  type?: string;
  avail?: string;
}>;

export default async function DescubrirGruposPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "groups" });
  const td = await getTranslations({ locale, namespace: "groups.discover" });
  const tf = await getTranslations({ locale, namespace: "groups.discover.filters" });

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const sp = await searchParams;
  const search = (sp.q ?? "").trim();
  const offsetN = Math.max(0, Number(sp.offset ?? "0") || 0);
  const visibility = sp.type === "public" || sp.type === "private" ? sp.type : undefined;
  const availability = sp.avail === "open" || sp.avail === "full" ? sp.avail : undefined;

  const items = await getDiscoverableGroups(db, session.user.id, {
    search,
    offset: offsetN,
    limit: 30,
    visibility,
    availability,
  });

  const buildHref = (next: {
    type?: "public" | "private" | "all";
    avail?: "open" | "full" | "all";
  }): string => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    const t = next.type ?? visibility ?? "all";
    const a = next.avail ?? availability ?? "all";
    if (t !== "all") params.set("type", t);
    if (a !== "all") params.set("avail", a);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

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

      <form method="GET" className="mb-4">
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
        {visibility && <input type="hidden" name="type" value={visibility} />}
        {availability && <input type="hidden" name="avail" value={availability} />}
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
        <FilterGroup
          label={tf("typeLabel")}
          options={[
            { value: "all", label: tf("typeAll"), active: !visibility },
            { value: "public", label: tf("typePublic"), active: visibility === "public" },
            { value: "private", label: tf("typePrivate"), active: visibility === "private" },
          ]}
          buildHref={(value) => buildHref({ type: value as "public" | "private" | "all" })}
        />
        <FilterGroup
          label={tf("availabilityLabel")}
          options={[
            { value: "all", label: tf("availabilityAll"), active: !availability },
            { value: "open", label: tf("availabilityOpen"), active: availability === "open" },
            { value: "full", label: tf("availabilityFull"), active: availability === "full" },
          ]}
          buildHref={(value) => buildHref({ avail: value as "open" | "full" | "all" })}
        />
      </div>

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

function FilterGroup({
  label,
  options,
  buildHref,
}: {
  label: string;
  options: { value: string; label: string; active: boolean }[];
  buildHref: (value: string) => string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <Link
            key={o.value}
            href={(buildHref(o.value) || "/social/grupos/descubrir") as never}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-bold no-underline transition-colors ${
              o.active
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-border bg-card text-muted hover:border-gold/30 hover:text-foreground"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
