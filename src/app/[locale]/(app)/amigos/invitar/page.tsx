import { InvitationsManager } from "@/components/invitations/invitations-manager";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import {
  countRedeemedInvitations,
  getInvitations,
} from "@/server/invitations/queries";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Gestión de links de invitación del usuario:
 *  - Lista de los links activos + cuántas veces se han redimido.
 *  - Botón "Generar nuevo link" (server action).
 *  - Botón "Rescindir" por fila para invalidar uno sin borrar histórico.
 *
 * El warning principal (auto-amistad al redimir) se muestra arriba
 * antes del listado.
 */
export default async function InvitarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const [list, redeemed] = await Promise.all([
    getInvitations(db, session.user.id),
    countRedeemedInvitations(db, session.user.id),
  ]);

  return <InvitarLayout invitations={list} redeemed={redeemed} />;
}

function InvitarLayout({
  invitations,
  redeemed,
}: {
  invitations: Awaited<ReturnType<typeof getInvitations>>;
  redeemed: number;
}) {
  const t = useTranslations("invite");
  return (
    <>
      <header className="mb-5">
        <Link
          href="/amigos"
          className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-extrabold text-gold no-underline transition-[gap] hover:gap-2.5"
        >
          <span aria-hidden="true">←</span> {t("backToFriends")}
        </Link>
        <h1 className="mb-1 font-display text-[26px] leading-none text-foreground">
          {t("title")}
        </h1>
        <p className="text-[13px] font-bold text-muted">
          {redeemed === 0
            ? t("subtitleEmpty")
            : t("subtitleCount", { count: redeemed })}
        </p>
      </header>

      <aside
        role="note"
        aria-label={t("warning.title")}
        className="mb-6 rounded-2xl border-2 border-warm/30 bg-warm/[0.06] px-4 py-3"
      >
        <div className="mb-1 flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.1em] text-warm">
          <span aria-hidden="true">⚠️</span>
          {t("warning.title")}
        </div>
        <p className="text-[12px] font-bold leading-snug text-foreground/90">
          {t("warning.body")}
        </p>
      </aside>

      <InvitationsManager invitations={invitations} />
    </>
  );
}
