import { useTranslations } from "next-intl";

const ROWS = [
  "simple",
  "exact",
  "double",
  "fail",
  "comboBase",
  "comboModified",
  "pollParticipate",
  "pollCorrect",
  "referral",
  "dailyLogin",
] as const;

type RowId = (typeof ROWS)[number];

type Tone = "earn" | "neutral" | "warm" | "info";

const TONE_BY_ROW: Record<RowId, Tone> = {
  simple: "earn",
  exact: "earn",
  double: "earn",
  fail: "neutral",
  comboBase: "warm",
  comboModified: "warm",
  pollParticipate: "info",
  pollCorrect: "info",
  referral: "info",
  dailyLogin: "neutral",
};

const TONE_STYLE: Record<Tone, { accent: string; value: string }> = {
  earn: { accent: "bg-gold", value: "text-gold" },
  neutral: { accent: "bg-border", value: "text-muted" },
  warm: { accent: "bg-warm", value: "text-warm" },
  info: { accent: "bg-info", value: "text-info" },
};

export function ScoringTable() {
  const t = useTranslations("faq.scoring");
  return (
    <section className="mt-8" aria-labelledby="faq-scoring-title">
      <h2 id="faq-scoring-title" className="mb-1 font-display text-xl text-gold sm:text-2xl">
        {t("title")}
      </h2>
      <p className="mb-4 text-sm font-bold text-muted">{t("subtitle")}</p>

      <ul className="flex flex-col gap-2">
        {ROWS.map((id, i) => {
          const tone = TONE_STYLE[TONE_BY_ROW[id]];
          return (
            <li
              key={id}
              style={{ animationDelay: `${(0.05 + i * 0.04).toFixed(2)}s` }}
              className="relative grid grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-[13px] border-2 border-border bg-card px-4 py-3 opacity-0 [animation:slideIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
            >
              <span
                aria-hidden="true"
                className={`absolute bottom-0 start-0 top-0 w-[3px] rounded-s-[2px] ${tone.accent}`}
              />
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-foreground">
                  {t(`rows.${id}.label`)}
                </div>
                <div className="mt-0.5 text-[11px] font-bold text-muted">
                  {t(`rows.${id}.note`)}
                </div>
              </div>
              <div className={`shrink-0 font-display text-xl leading-none ${tone.value}`}>
                {t(`rows.${id}.value`)}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
