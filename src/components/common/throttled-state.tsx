/**
 * Pantalla "demasiadas peticiones". Pensada para renderizar en SSR
 * cuando el rate-limit de un read público bloquea la request.
 *
 * Limitación HTTP: como es un Server Component normal, el status
 * code de la respuesta queda en 200. Para devolver un 429 real
 * habría que mover el chequeo a middleware (cuya Edge runtime
 * complica importar @upstash/redis). Aceptable por ahora — la UX
 * es clara incluso sin el status correcto, y los bots de scrapeo
 * no van a parsear el HTML.
 */
export function ThrottledState() {
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-9">
      <article
        aria-label="Demasiadas peticiones"
        className="relative max-w-md overflow-hidden rounded-3xl border-2 border-border bg-card px-6 py-12 text-center"
      >
        <span aria-hidden="true" className="block text-5xl">
          🐢
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight text-foreground">
          Demasiadas peticiones
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] font-bold leading-relaxed text-muted">
          Has hecho muchas requests en poco tiempo. Espera unos segundos y vuelve a intentarlo.
        </p>
      </article>
    </main>
  );
}
