import type { ReactNode } from "react";

export function LiveBadge({ children }: { children: ReactNode }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-success/30 bg-success/10 px-3.5 py-[5px] text-[11px] font-extrabold uppercase tracking-[0.1em] text-success"
    >
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] animate-[blink_1.4s_ease_infinite] rounded-full bg-success"
      />
      {children}
    </span>
  );
}
