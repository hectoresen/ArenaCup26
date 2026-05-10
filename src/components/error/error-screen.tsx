import type { ReactNode } from "react";

/**
 * Layout reusable de páginas de error. Server-component-ready (sin
 * "use client") para que funcione tanto en `not-found.tsx` (Server)
 * como en `error.tsx` (Client) sin duplicar markup.
 */
export function ErrorScreen({
  code,
  title,
  description,
  children,
}: {
  code: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative z-10 w-full max-w-[480px] text-center">
      <div className="font-display text-[88px] leading-none text-gold opacity-0 drop-shadow-[0_4px_24px_rgba(245,200,66,0.4)] [animation:popIn_0.7s_cubic-bezier(0.34,1.56,0.64,1)_forwards] sm:text-[120px]">
        {code}
      </div>

      <h1 className="mt-3 font-display text-2xl text-foreground opacity-0 [animation:popIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_0.15s_forwards] sm:text-3xl">
        {title}
      </h1>

      <p className="mx-auto mt-2 max-w-sm text-sm font-bold text-muted opacity-0 [animation:fadeUp_0.5s_ease_0.3s_forwards]">
        {description}
      </p>

      {children && (
        <div className="mt-7 flex flex-col items-center justify-center gap-3 opacity-0 [animation:fadeUp_0.5s_ease_0.45s_forwards] sm:flex-row">
          {children}
        </div>
      )}
    </div>
  );
}
