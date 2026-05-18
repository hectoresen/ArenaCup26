import { GroupAvatar } from "@/components/groups/group-avatar";
import { JoinViaLinkButton } from "@/components/groups/join-via-link-button";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { previewGroupLink } from "@/server/groups/queries";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Landing pública de invite link. Muestra preview del grupo + botón
 * de unión. Si el viewer no está autenticado, le redirigimos a
 * `/login` con `next=` para que vuelva tras login (el token sigue
 * siendo válido).
 *
 * Si el link es inválido/revocado/agotado, mostramos copy claro y CTA
 * de vuelta a /social.
 */
export default async function UnirseGrupoPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) {
    const next = encodeURIComponent(`/${locale}/social/grupos/unirse/${token}`);
    redirect(`/${locale}/login?next=${next}`);
  }

  const preview = await previewGroupLink(db, token);

  if (!preview.ok) {
    return (
      <div className="mx-auto mt-12 max-w-md text-center">
        <div className="rounded-2xl border-2 border-dashed border-warm/40 bg-warm/[0.06] px-4 py-6">
          <p className="font-display text-[15px] text-foreground">
            {preview.code === "revoked"
              ? "Este link ha sido revocado"
              : preview.code === "exhausted"
                ? "Este link ya no tiene usos disponibles"
                : preview.code === "group_deleted"
                  ? "El grupo de este link ya no existe"
                  : "Link de invitación inválido"}
          </p>
          <p className="mt-2 text-[12px] font-bold text-muted">
            Pídele al admin del grupo que te genere uno nuevo.
          </p>
        </div>
        <Link
          href="/social"
          className="mt-4 inline-block rounded-full border-2 border-border bg-card px-4 py-2 text-[12px] font-black uppercase tracking-[0.1em] text-foreground hover:border-gold/40"
        >
          Volver a Social
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
            {preview.memberCount} de {preview.maxMembers} miembros
          </p>
        </div>
      </header>

      <p className="mb-5 rounded-2xl border-2 border-border bg-card/40 px-4 py-3 text-center text-[13px] font-bold text-muted">
        Al unirte verás un ranking privado solo con los miembros de este
        grupo. Tus puntos son los mismos del torneo.
      </p>

      <JoinViaLinkButton token={token} groupId={preview.groupId} />

      <Link
        href="/social"
        className="mt-4 block text-center text-[12px] font-bold text-muted hover:text-foreground"
      >
        Cancelar
      </Link>
    </div>
  );
}
