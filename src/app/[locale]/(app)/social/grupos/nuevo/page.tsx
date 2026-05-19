import { CreateGroupForm } from "@/components/groups/create-group-form";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { MAX_GROUPS_PER_USER, countActiveGroupsForUser } from "@/server/groups/caps";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

export default async function NuevoGrupoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "groups" });
  const tc = await getTranslations({ locale, namespace: "groups.create" });

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const activeCount = await countActiveGroupsForUser(db, session.user.id);

  return (
    <>
      <header className="mb-5">
        <Link href="/social" className="text-[12px] font-bold text-muted hover:text-foreground">
          {t("backToSocial")}
        </Link>
        <h1 className="mt-2 font-display text-[26px] leading-none text-foreground">
          {tc("headerTitle")}
        </h1>
        <p className="mt-1 text-[13px] font-bold text-muted">
          {tc("headerSubtitle")}
        </p>
      </header>

      {activeCount >= MAX_GROUPS_PER_USER ? (
        <div className="rounded-2xl border-2 border-dashed border-warm/40 bg-warm/[0.06] px-4 py-5">
          <p className="text-[13px] font-bold text-foreground">
            {tc("atCap", { count: activeCount, max: MAX_GROUPS_PER_USER })}
          </p>
        </div>
      ) : (
        <CreateGroupForm />
      )}
    </>
  );
}
