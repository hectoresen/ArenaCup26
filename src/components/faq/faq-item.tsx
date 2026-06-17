import type { ReactNode } from "react";

export function FaqItem({
  question,
  children,
  id,
}: {
  question: string;
  children: ReactNode;
  /**
   * Id opcional del `<details>` para soporte de deep-linking
   * (`/faq#faq-<id>`). El componente que enlaza desde fuera del FAQ
   * sigue siendo responsable de scrollIntoView/expand; aquí solo
   * exponemos el ancla.
   */
  id?: string;
}) {
  return (
    <details
      id={id}
      className="group overflow-hidden rounded-[13px] border-2 border-border bg-card transition-colors open:border-gold/30 hover:border-gold/20 scroll-mt-24"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-start text-sm font-extrabold text-foreground transition-colors group-open:text-gold marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{question}</span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 group-open:text-gold"
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6 L8 11 L13 6" />
        </svg>
      </summary>
      <div className="border-t border-border px-4 py-3 text-[13px] font-bold leading-relaxed text-muted">
        {children}
      </div>
    </details>
  );
}
