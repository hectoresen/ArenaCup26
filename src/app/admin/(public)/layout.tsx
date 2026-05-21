import type { ReactNode } from "react";

/**
 * Layout del subtree `/admin/(public)/*` — páginas accesibles sin
 * sesión (signin, future error pages). Define <html>/<body> propios
 * porque el segmento `/admin` no hereda del root `[locale]` layout.
 *
 * NO hace auth check. La auth gate vive en `/admin/(authed)/layout.tsx`,
 * que se aplica solo a `/admin/(authed)/*`. Route groups con paréntesis
 * no afectan a la URL — sirven solo para escoger qué layout aplica.
 */
export default function AdminPublicLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="bg-slate-950">
      <body className="min-h-screen text-slate-100 antialiased">{children}</body>
    </html>
  );
}
