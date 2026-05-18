import { CreateGroupForm } from "@/components/groups/create-group-form";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { MAX_GROUPS_PER_USER, countActiveGroupsForUser } from "@/server/groups/caps";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

/**
 * Página de creación de grupo. SSR check del cap del user: si está
 * al máximo, en lugar del formulario muestra mensaje + CTA para
 * volver a /social. Evita renderizar el form solo para que la action
 * lo rechace al submit.
 */
export default async function NuevoGrupoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}`);

  const activeCount = await countActiveGroupsForUser(db, session.user.id);

  return (
    <>
      <header className="mb-5">
        <Link href="/social" className="text-[12px] font-bold text-muted hover:text-foreground">
          ← Volver a Social
        </Link>
        <h1 className="mt-2 font-display text-[26px] leading-none text-foreground">
          Crear grupo
        </h1>
        <p className="mt-1 text-[13px] font-bold text-muted">
          Compite con tus amigos en un ranking privado. Los puntos son los
          mismos del torneo — el grupo solo filtra a quién ves.
        </p>
      </header>

      {activeCount >= MAX_GROUPS_PER_USER ? (
        <div className="rounded-2xl border-2 border-dashed border-warm/40 bg-warm/[0.06] px-4 py-5">
          <p className="text-[13px] font-bold text-foreground">
            Ya estás en {activeCount} grupos activos (máximo {MAX_GROUPS_PER_USER}).
            Abandona uno desde su página antes de crear otro.
          </p>
        </div>
      ) : (
        <CreateGroupForm />
      )}
    </>
  );
}
