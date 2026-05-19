import { GroupAvatar } from "@/components/groups/group-avatar";
import { JoinViaLinkButton } from "@/components/groups/join-via-link-button";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { previewGroupLink } from "@/server/groups/queries";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

export default async function UnirseGrupoPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "groups.joinLink" });

  const session = await auth();
  if (!session?.user?.id) {
    const next = encodeURIComponent(`/${locale}/social/grupos/unirse/${token}`);
    redirect(`/${locale}/login?next=${next}`);
  }

  const preview = await previewGroupLink(db, token);

  if (!preview.ok) {
    const errorMsg =
      preview.code === "revoked"
        ? t("revoked")
        : preview.code === "exhausted"
          ? t("exhausted")
          : preview.code === "group_deleted"
            ? t("groupDeleted")
            : t("invalid");
    return (
      <div className="mx-auto mt-12 max-w-md text-center">
        <div className="rounded-2xl border-2 border-dashed border-warm/40 bg-warm/[0.06] px-4 py-6">
          <p className="font-display text-[15px] text-foreground">{errorMsg}</p>
          <p className="mt-2 text-[12px] font-bold text-muted">{t("askAdmin")}</p>
        </div>
        <Link
          href="/social"
          className="mt-4 inline-block rounded-full border-2 border-border bg-card px-4 py-2 text-[12px] font-black uppercase tracking-[0.1em] text-foreground hover:border-gold/40"
        >
          {t("backToSocial")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-md">
      <header className="mb-6 flex flex-col items-center gap-3 text-center">
        <GroupAvatar color={preview.groupColor} name={preview.groupName} size="lg" />
        <div>
          <h1 className="font-display text-[24px] leading-none text-foreground">
            {preview.groupName}
          </h1>
          <p className="mt-1.5 text-[12px] font-bold text-muted">
            {t("ofMax", { count: preview.memberCount, max: preview.maxMembers })}
          </p>
        </div>
      </header>

      <p className="mb-5 rounded-2xl border-2 border-border bg-card/40 px-4 py-3 text-center text-[13px] font-bold text-muted">
        {t("blurb")}
      </p>

      <JoinViaLinkButton token={token} groupId={preview.groupId} />

      <Link
        href="/social"
        className="mt-4 block text-center text-[12px] font-bold text-muted hover:text-foreground"
      >
        {t("cancel")}
      </Link>
    </div>
  );
}
