"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updatePrivacy } from "@/server/privacy/actions";
import type { UserPrivacy } from "@/server/privacy/apply";

type Props = {
  initial: UserPrivacy;
};

/**
 * Form cliente para ajustar privacidad. Optimistic UI: actualiza el
 * state local de inmediato y dispara la server action en background.
 * Si la action falla, se revierte y muestra error.
 */
export function PrivacyForm({ initial }: Props) {
  const t = useTranslations("privacy");
  const [state, setState] = useState<UserPrivacy>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof UserPrivacy>(key: K, value: UserPrivacy[K]) {
    const next = { ...state, [key]: value };
    setState(next);
    setError(null);
    startTransition(async () => {
      const result = await updatePrivacy(next);
      if (!result.ok) {
        setError(t(`error.${result.code}` as "error.unauthorized" | "error.invalid_input"));
        setState(state); // revert
        return;
      }
      setSavedAt(Date.now());
    });
  }

  return (
    <form className="space-y-6">
      <fieldset>
        <legend className="mb-3 font-display text-[13px] uppercase tracking-[0.12em] text-gold">
          {t("visibility.legend")}
        </legend>
        <div className="space-y-2">
          {(["public", "friends_only", "private"] as const).map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 transition-colors ${
                state.visibility === option
                  ? "border-gold bg-gold/[0.06]"
                  : "border-border bg-card hover:border-gold/30"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={option}
                checked={state.visibility === option}
                onChange={() => update("visibility", option)}
                className="mt-1 accent-gold"
              />
              <div className="flex-1">
                <div className="text-sm font-extrabold text-foreground">
                  {t(`visibility.${option}.title`)}
                </div>
                <div className="mt-0.5 text-[11px] font-bold text-muted">
                  {t(`visibility.${option}.desc`)}
                </div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-[13px] uppercase tracking-[0.12em] text-gold">
          {t("fields.legend")}
        </legend>
        <div className="space-y-2">
          {(
            [
              "showName",
              "showCountry",
              "showImage",
              "showPoints",
              "showAchievements",
            ] as const
          ).map((key) => (
            <ToggleRow
              key={key}
              label={t(`fields.${key}.label`)}
              desc={t(`fields.${key}.desc`)}
              checked={state[key]}
              onChange={(v) => update(key, v)}
            />
          ))}
        </div>
      </fieldset>

      <footer className="flex items-center justify-between rounded-xl border-2 border-border bg-card px-4 py-3 text-[11px] font-bold">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : isPending ? (
          <span className="text-muted">{t("status.saving")}</span>
        ) : savedAt ? (
          <span className="text-success">{t("status.saved")}</span>
        ) : (
          <span className="text-muted">{t("status.idle")}</span>
        )}
      </footer>
    </form>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 transition-colors hover:border-gold/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 accent-gold"
      />
      <div className="flex-1">
        <div className="text-sm font-extrabold text-foreground">{label}</div>
        <div className="mt-0.5 text-[11px] font-bold text-muted">{desc}</div>
      </div>
    </label>
  );
}
