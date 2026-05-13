import { setRequestLocale } from "next-intl/server";

/**
 * Placeholder de la ruta `/inicio`. La implementación real (hero,
 * live, próximos, progreso, mini-leaderboard) aterriza con la
 * capability `add-home-dashboard`. Esta página solo existe para que
 * el shell tenga un destino válido y los tests del layout `(app)`
 * puedan validarse end-to-end.
 */
export default async function InicioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <section className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm font-bold text-muted">Panel del usuario — próximamente.</p>
    </section>
  );
}
