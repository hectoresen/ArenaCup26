"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GroupAvatar } from "@/components/groups/group-avatar";
import { Link } from "@/i18n/navigation";
import type { GroupSummary } from "@/server/groups/types";

type Props = {
  group: GroupSummary;
};

/**
 * Card de grupo en `/social/grupos/descubrir`. Tres ramas:
 *  - Miembro activo → Link + badge "Ya eres miembro" / "Eres admin".
 *  - No miembro + público → Link + badge "Público".
 *  - No miembro + privado → button con candado + toast bloqueante.
 */
export function DiscoverGroupCard({ group }: Props) {
  const t = useTranslations("groups");
  const td = useTranslations("groups.discover.privatePopup");
  const tb = useTranslations("groups.badge");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const isPrivate = group.visibility === "private";
  const isMember = group.viewerRole !== null;
  const lockMode = isPrivate && !isMember;

  const memberLabel =
    group.memberCount === 1 ? t("members.one") : t("members.many");

  const inner = (
    <>
      <GroupAvatar color={group.color} name={group.name} />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] leading-tight text-foreground">
            {group.name}
          </span>
          {isMember ? (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-gold">
              {group.viewerRole === "admin" ? tb("youAdmin") : tb("youMember")}
            </span>
          ) : isPrivate ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-warm/40 bg-warm/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-warm"
              aria-label={td("ariaIcon")}
            >
              <LockIcon /> {tb("private")}
            </span>
          ) : (
            <span className="rounded-full border border-border bg-card-hover/60 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.12em] text-muted">
              {tb("public")}
            </span>
          )}
        </div>
        <div className="text-[12px] font-bold text-muted">
          {group.memberCount} {memberLabel}
          {group.maxMembers ? ` · ${t("capLabel", { max: group.maxMembers })}` : ""}
        </div>
      </div>
      <span
        aria-hidden="true"
        className={`font-display text-base ${lockMode ? "text-warm/70" : "text-muted"} transition-transform group-hover:translate-x-0.5`}
      >
        {lockMode ? "🔒" : "›"}
      </span>
    </>
  );

  const baseCls =
    "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-3 transition-colors hover:border-gold/40 hover:bg-card-hover";

  return (
    <>
      {lockMode ? (
        <button
          type="button"
          onClick={() => setToast(td("body", { name: group.name }))}
          className={baseCls}
          aria-label={td("ariaCard", { name: group.name })}
        >
          {inner}
        </button>
      ) : (
        <Link href={`/social/grupos/${group.id}`} className={baseCls}>
          {inner}
        </Link>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[100] -translate-x-1/2 max-w-[92vw] rounded-2xl border-2 border-warm/40 bg-card-hover px-4 py-3 text-center text-[12px] font-extrabold text-warm shadow-[0_8px_24px_rgba(0,0,0,0.45)] [animation:fadeUp_0.2s_ease_forwards]"
        >
          <div className="mb-0.5 flex items-center justify-center gap-1.5 text-warm">
            <LockIcon />
            <span className="uppercase tracking-[0.12em]">{td("title")}</span>
          </div>
          <p className="text-[12px] font-bold leading-snug text-foreground/90">
            {toast}
          </p>
        </div>
      )}
    </>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
