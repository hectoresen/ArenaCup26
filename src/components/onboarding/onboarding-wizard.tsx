"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { completeOnboarding } from "@/server/onboarding/actions";
import { CountryPicker } from "./country-picker";

type Props = {
  initial: {
    username: string;
    country: string | null;
  };
};

type Step = 1 | 2 | 3;

/**
 * Wizard de bienvenida en 3 pasos:
 *   1. Identidad: username (pre-rellenado, editable) + país.
 *      El nombre real viene de Google y no se pide aquí — el user
 *      puede cambiarlo después en ajustes si quiere.
 *   2. Cómo funciona: 3 cards de scoring (simple/exacto/rachas).
 *   3. Listo: CTA que dispara `completeOnboarding` y redirige.
 */
export function OnboardingWizard({ initial }: Props) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [username, setUsername] = useState(initial.username);
  const [country, setCountry] = useState(initial.country ?? "ES");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function next() {
    setError(null);
    if (step === 1) {
      if (!/^[a-z0-9](?:[a-z0-9-]{1,18}[a-z0-9])?$/.test(username)) {
        setError(t("error.usernameInvalid"));
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
  }

  function back() {
    setError(null);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        username: username.trim().toLowerCase(),
        country: country.trim().toUpperCase(),
      });
      if (!result.ok) {
        if (result.code === "username_taken") setError(t("error.usernameTaken"));
        else if (result.code === "invalid_input") setError(t("error.invalidInput"));
        else setError(t("error.unauthorized"));
        return;
      }
      router.replace("/inicio");
      router.refresh();
    });
  }

  return (
    <main className="relative z-10 mx-auto max-w-md px-5 py-9">
      <header className="mb-6 text-center">
        <h1 className="font-display text-3xl text-gold">{t("title")}</h1>
        <p className="mt-2 text-sm font-bold text-muted">{t("subtitle")}</p>
        <div className="mt-4 flex justify-center gap-1.5" aria-label={t("stepIndicator")}>
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`h-1.5 w-8 rounded-full ${
                s <= step ? "bg-gold" : "bg-white/[0.1]"
              }`}
            />
          ))}
        </div>
      </header>

      {step === 1 && (
        <section className="space-y-4 rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="font-display text-[15px] uppercase tracking-[0.12em] text-foreground">
            {t("step1.heading")}
          </h2>

          <label className="block">
            <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">
              {t("step1.usernameLabel")}
            </span>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-sm font-bold text-muted">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={20}
                className="flex-1 rounded-xl border-2 border-border bg-card-hover px-3 py-2 text-sm font-bold text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <span className="mt-1 block text-[10px] font-bold text-muted">
              {t("step1.usernameHint")}
            </span>
          </label>

          <CountryPicker
            value={country}
            onChange={setCountry}
            label={t("step1.countryLabel")}
          />

          <p className="rounded-xl border-[1.5px] border-info/25 bg-info/[0.06] px-3 py-2 text-[11px] font-bold leading-relaxed text-muted">
            🔒 {t("step1.privacyNote")}
          </p>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3 rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="font-display text-[15px] uppercase tracking-[0.12em] text-foreground">
            {t("step2.heading")}
          </h2>
          <ScoringCard emoji="🎯" title={t("step2.simpleTitle")} desc={t("step2.simpleDesc")} />
          <ScoringCard emoji="💎" title={t("step2.exactTitle")} desc={t("step2.exactDesc")} />
          <ScoringCard emoji="🔥" title={t("step2.streakTitle")} desc={t("step2.streakDesc")} />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3 rounded-2xl border-2 border-border bg-card p-5 text-center">
          <span aria-hidden="true" className="block text-5xl">
            ⚽
          </span>
          <h2 className="font-display text-[18px] text-gold">{t("step3.heading")}</h2>
          <p className="text-sm font-bold text-muted">{t("step3.body")}</p>
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border-2 border-danger/40 bg-danger/10 px-4 py-3 text-[12px] font-extrabold text-danger"
        >
          {error}
        </div>
      )}

      <footer className="mt-6 flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={back}
            className="cursor-pointer rounded-full border-2 border-border bg-card px-4 py-2 text-xs font-extrabold text-muted transition-colors hover:border-gold/30 hover:text-foreground disabled:cursor-wait"
            disabled={isPending}
          >
            {t("back")}
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={next}
            className="cursor-pointer rounded-full border-2 border-gold/40 bg-gold/10 px-4 py-2 text-xs font-extrabold text-gold transition-colors hover:border-gold hover:bg-gold/20 disabled:cursor-wait"
            disabled={isPending}
          >
            {t("next")}
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            disabled={isPending}
            className="cursor-pointer rounded-full border-2 border-gold bg-gold px-5 py-2 text-xs font-extrabold text-[#1a1000] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? t("finishing") : t("finish")}
          </button>
        )}
      </footer>
    </main>
  );
}

function ScoringCard({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-border bg-card-hover px-3 py-3">
      <span aria-hidden="true" className="text-2xl leading-none">
        {emoji}
      </span>
      <div className="flex-1">
        <div className="text-sm font-extrabold text-foreground">{title}</div>
        <div className="mt-0.5 text-[11px] font-bold text-muted">{desc}</div>
      </div>
    </div>
  );
}
