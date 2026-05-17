"use client";

import { Link } from "@/i18n/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

export function JoinCta() {
  const t = useTranslations("joinCta");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      closeDialog();
    }
  }

  async function handleGoogleSignIn() {
    setPending(true);
    try {
      // Tras autenticar, llevamos al panel privado, no a la landing.
      await signIn("google", { callbackUrl: "/inicio" });
    } catch (error) {
      console.error("[arenacup26] sign-in error", error);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-gold/40 bg-gradient-to-br from-gold to-gold-deep px-3 py-2 font-display text-[11px] uppercase tracking-[0.12em] text-[#1a1000] shadow-[0_0_24px_rgba(245,200,66,0.32)] transition-[transform,box-shadow] duration-200 hover:scale-[1.04] hover:shadow-[0_0_32px_rgba(245,200,66,0.55)] active:scale-[0.98] sm:gap-2 sm:px-5 sm:py-2.5 sm:text-[13px] sm:tracking-[0.14em]"
      >
        <span aria-hidden="true">⚽</span>
        {t("button")}
        <span aria-hidden="true" className="ms-0.5">
          →
        </span>
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: el `<dialog>` nativo ya soporta Escape para cerrar; el click solo es un atajo extra (clic fuera del contenido). */}
      <dialog
        ref={dialogRef}
        aria-labelledby="join-cta-title"
        onClick={handleBackdropClick}
        className="m-auto max-w-[380px] rounded-3xl border-2 border-gold/30 bg-gradient-to-br from-card-hover to-card p-0 text-foreground shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_60px_rgba(245,200,66,0.18)] backdrop:bg-black/65 backdrop:backdrop-blur-sm open:[animation:popIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
      >
        <div className="relative overflow-hidden rounded-3xl px-7 pt-9 pb-7 text-center">
          <button
            type="button"
            onClick={closeDialog}
            aria-label={t("modal.closeLabel")}
            className="absolute end-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-white/[0.04] text-muted transition-colors hover:bg-white/[0.08] hover:text-foreground"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4 L12 12 M12 4 L4 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-deep shadow-[0_0_24px_rgba(245,200,66,0.4)]">
            <span className="font-display text-2xl text-[#1a1000]">26</span>
          </div>

          <h2 id="join-cta-title" className="font-display text-2xl text-gold">
            {t("modal.title")}
          </h2>
          <p className="mt-2 text-[13px] font-bold text-muted">{t("modal.subtitle")}</p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={pending}
            className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-bold text-foreground transition-colors hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"
          >
            <GoogleLogo />
            {pending ? t("modal.googlePending") : t("modal.googleButton")}
          </button>

          <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
            {t("modal.footer")}
          </p>

          <Link
            href="/faq"
            onClick={closeDialog}
            className="mt-4 inline-block text-[11px] font-bold text-muted underline-offset-4 transition-colors hover:text-gold hover:underline"
          >
            {t("modal.faqLink")}
          </Link>
        </div>
      </dialog>
    </>
  );
}

function GoogleLogo() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
