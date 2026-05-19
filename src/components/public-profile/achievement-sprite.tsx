/**
 * Sprite SVG con los 24 iconos del catálogo de logros + 3 utilitarios
 * (lock, unlocked check, share). Se monta una sola vez por página
 * que renderice logros y los `<AchievementCard>` referencian los
 * símbolos vía `<use href="#ach-<name>">`.
 *
 * **Namespace `ach-`**: el shell tiene su propio `ShellIconSprite`
 * con ids `ico-*` (incluyendo `ico-medal` para el tab "Logros") que
 * colisionarían con los del catálogo si compartieran prefijo. Por eso
 * aquí todos los ids van con `ach-` y el helper `achSymbolHref(iconId)`
 * traduce `ico-foo` → `#ach-foo`.
 *
 * Pegado 1:1 del `docs/achievements-reference.html` (líneas 259-545).
 * Cualquier cambio aquí debe reflejarse también allí.
 */
export function AchievementsIconSprite() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* DART — first-hit (common) */}
        <symbol id="ach-dart" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.5" />
          <circle cx="18" cy="18" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
          <circle cx="18" cy="18" r="2.8" fill="currentColor" />
          <line x1="25" y1="11" x2="20.5" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <polygon points="25,8 29,11 26,12.5 22.5,9.5" fill="currentColor" />
          <line x1="26.5" y1="8.5" x2="30" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="28.5" y1="10.5" x2="32" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </symbol>

        {/* CHECK x10 — good-eye (common) */}
        <symbol id="ach-check10" viewBox="0 0 36 36">
          <rect x="4" y="5" width="28" height="26" rx="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <text x="18" y="17" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="10" fill="currentColor">10</text>
          <polyline points="11,23 15.5,28 25,19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>

        {/* BINOCULARS — group-analyst (common) */}
        <symbol id="ach-binoculars" viewBox="0 0 36 36">
          <rect x="3" y="14" width="12" height="12" rx="5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <rect x="21" y="14" width="12" height="12" rx="5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M15 19 L21 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="9" cy="20" r="2.5" fill="currentColor" opacity="0.35" />
          <circle cx="27" cy="20" r="2.5" fill="currentColor" opacity="0.35" />
          <path d="M12 12 L9 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M24 12 L27 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </symbol>

        {/* COIN — first-hundred (common) */}
        <symbol id="ach-coin" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="18" cy="18" r="8.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
          <text x="18" y="22.5" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="10" fill="currentColor">100</text>
        </symbol>

        {/* INVITE — better-with-friends (common) */}
        <symbol id="ach-invite" viewBox="0 0 36 36">
          <circle cx="12" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3 30 C3 22 7 18 12 18 C16 18 19 21 20 25" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="27" y1="17" x2="27" y2="29" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="21" y1="23" x2="33" y2="23" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </symbol>

        {/* TEAM — team-spirit (common). Tres figuras juntas
            representando un grupo de competición. */}
        <symbol id="ach-team" viewBox="0 0 36 36">
          {/* Figura central, más grande (admin). */}
          <circle cx="18" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M10 30 C10 22 13.5 18 18 18 C22.5 18 26 22 26 30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          {/* Figura izquierda, más pequeña. */}
          <circle cx="7" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 30 C2 24 4 20 7 20 C8.5 20 10 20.8 11 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          {/* Figura derecha, más pequeña. */}
          <circle cx="29" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M25 22 C26 20.8 27.5 20 29 20 C32 20 34 24 34 30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </symbol>

        {/* FIVE EXACT — five-of-five (common) */}
        <symbol id="ach-five-exact" viewBox="0 0 36 36">
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <line x1="12" y1="4" x2="12" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12" y2="20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="4" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="17" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <text x="26" y="30" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="16" fill="currentColor">×5</text>
        </symbol>

        {/* MEDAL — power-200 (rare) */}
        <symbol id="ach-medal" viewBox="0 0 36 36">
          <line x1="13" y1="6" x2="10" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="23" y1="6" x2="26" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <polygon points="13,5 23,5 25,9 11,9" fill="currentColor" opacity="0.65" />
          <circle cx="18" cy="25" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="18" cy="25" r="6.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <text x="18" y="29" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="7.5" fill="currentColor">200</text>
        </symbol>

        {/* FLAME — on-fire (rare) */}
        <symbol id="ach-flame" viewBox="0 0 36 36">
          <path d="M18 4 C18 4 27 13 27 21 C27 27.6 23 32 18 32 C13 32 9 27.6 9 21 C9 15 13 10 13 10 C13 10 12 17 17 19 C17 19 14.5 13.5 18 4Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M18 18 C18 18 22 22 22 26 C22 29 20.2 31 18 31 C15.8 31 14 29 14 26 C14 22 18 18 18 18Z" fill="currentColor" opacity="0.2" />
        </symbol>

        {/* CROSSHAIR — exact-shot (rare) */}
        <symbol id="ach-crosshair" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="18" cy="18" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="18" cy="18" r="1.8" fill="currentColor" />
          <line x1="18" y1="4" x2="18" y2="11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="18" y1="25" x2="18" y2="32" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="4" y1="18" x2="11" y2="18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <line x1="25" y1="18" x2="32" y2="18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </symbol>

        {/* TOP 100 — top-100 (rare) */}
        <symbol id="ach-top100" viewBox="0 0 36 36">
          <polygon points="18,3 21,12 31,12 23,18 26,28 18,22 10,28 13,18 5,12 15,12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <text x="18" y="20" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="7" fill="currentColor">100</text>
        </symbol>

        {/* CLIPBOARD — total-strategist (epic) */}
        <symbol id="ach-clipboard" viewBox="0 0 36 36">
          <rect x="7" y="8" width="22" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13" y="5" width="10" height="6" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="11" y1="16" x2="25" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
          <line x1="11" y1="20" x2="25" y2="20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
          <line x1="11" y1="24" x2="19" y2="24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
          <polyline points="20,23 23,27 30,19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>

        {/* HALF GLOBE — half-world (epic) */}
        <symbol id="ach-halfglobe" viewBox="0 0 36 36">
          <path d="M4 18 A14 14 0 0 1 32 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="4" y1="18" x2="32" y2="18" stroke="currentColor" strokeWidth="1.7" />
          <line x1="18" y1="4" x2="18" y2="18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M6 12 Q18 15 30 12" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
          <path d="M4 18 A14 14 0 0 0 32 18" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.28" />
          <text x="18" y="30" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="6.5" fill="currentColor">50%</text>
        </symbol>

        {/* BOLT — the-step-before (epic) */}
        <symbol id="ach-bolt" viewBox="0 0 36 36">
          <polygon points="22,3 11,21 18,21 14,33 25,15 18,15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        </symbol>

        {/* TOP 50 — top-50 (epic) */}
        <symbol id="ach-top50" viewBox="0 0 36 36">
          <polygon points="18,3 21,12 31,12 23,18 26,28 18,22 10,28 13,18 5,12 15,12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <text x="18" y="20" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="7" fill="currentColor">50</text>
        </symbol>

        {/* DOUBLE FLAME — double-streak (epic) */}
        <symbol id="ach-double-flame" viewBox="0 0 36 36">
          <path d="M13 7 C13 7 19 13 19 19 C19 23.6 16.5 27 13 27 C9.5 27 7 23.6 7 19 C7 15 10 11 10 11 C10 11 9.2 16 12.5 18 C12.5 18 10.5 13 13 7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M23 4 C23 4 30 11 30 19 C30 24.8 27 29 23 29 C19 29 16 24.8 16 19 C16 14 19.5 10 19.5 10 C19.5 10 18.5 16 22 18 C22 18 19.5 12 23 4Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M23 18 C23 18 26 21 26 24.5 C26 27 24.7 29 23 29 C21.3 29 20 27 20 24.5 C20 21 23 18 23 18Z" fill="currentColor" opacity="0.18" />
        </symbol>

        {/* CROSSHAIR x10 — elite-shooter (epic) */}
        <symbol id="ach-crosshair10" viewBox="0 0 36 36">
          <circle cx="13" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="13" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          <circle cx="13" cy="13" r="1.5" fill="currentColor" />
          <line x1="13" y1="4" x2="13" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="13" y1="18" x2="13" y2="22" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="4" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="18" y1="13" x2="22" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <text x="27" y="32" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="15" fill="currentColor">×10</text>
        </symbol>

        {/* EYE — seer (legendary) */}
        <symbol id="ach-eye" viewBox="0 0 36 36">
          <path d="M2 18 C7 9 12 5 18 5 C24 5 29 9 34 18 C29 27 24 31 18 31 C12 31 7 27 2 18Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="18" cy="18" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="18" cy="18" r="2.5" fill="currentColor" />
          <circle cx="20.5" cy="15.5" r="1.2" fill="#fff8d0" opacity="0.75" />
          <line x1="18" y1="2" x2="18" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11" y1="4" x2="12.5" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
          <line x1="25" y1="4" x2="23.5" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
        </symbol>

        {/* GLOBE — world-citizen (legendary) */}
        <symbol id="ach-globe" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
          <ellipse cx="18" cy="18" rx="6" ry="14" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.65" />
          <line x1="4" y1="18" x2="32" y2="18" stroke="currentColor" strokeWidth="1.3" opacity="0.65" />
          <path d="M5 12 Q18 15.5 31 12" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
          <path d="M5 24 Q18 20.5 31 24" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
        </symbol>

        {/* TROPHY — the-prophet (legendary) */}
        <symbol id="ach-trophy" viewBox="0 0 36 36">
          <rect x="11" y="31" width="14" height="3" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13.5" y="27" width="9" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <rect x="16" y="22" width="4" height="6" rx="1" fill="currentColor" opacity="0.7" />
          <path d="M7 7 C5 7 3 9 3 14 C3 20 7 24 13 26 L18 27 L23 26 C29 24 33 20 33 14 C33 9 31 7 29 7 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M7 12 C2 11 1 17 3 20 C4 22 6 23 8 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M29 12 C34 11 35 17 33 20 C32 22 30 23 28 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="12" y1="11" x2="12" y2="19" stroke="rgba(255,248,200,0.35)" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="18,2 19.4,6 23.5,6 20.2,8.4 21.5,12.5 18,10 14.5,12.5 15.8,8.4 12.5,6 16.6,6" fill="currentColor" opacity="0.9" />
        </symbol>

        {/* TOP 10 — top-10 (legendary) */}
        <symbol id="ach-top10" viewBox="0 0 36 36">
          <polygon points="18,2 21.5,12 33,12 23.5,18.5 27,29 18,22.5 9,29 12.5,18.5 3,12 14.5,12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <text x="18" y="21" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="8" fill="currentColor">10</text>
        </symbol>

        {/* PODIUM 3 — on-the-podium (mythic) */}
        <symbol id="ach-podium3" viewBox="0 0 36 36">
          <rect x="3" y="20" width="9" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="13.5" y="14" width="9" height="19" rx="2" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <rect x="24" y="23" width="9" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <text x="7.5" y="31" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="7" fill="currentColor">2</text>
          <text x="18" y="31" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="7" fill="currentColor">1</text>
          <text x="28.5" y="31" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="7" fill="currentColor">3</text>
          <polygon points="18,2 19.5,7 24.5,7 20.5,10 22,15 18,12 14,15 15.5,10 11.5,7 16.5,7" fill="currentColor" opacity="0.85" />
        </symbol>

        {/* PODIUM 2 — runner-up (mythic) */}
        <symbol id="ach-podium2" viewBox="0 0 36 36">
          <rect x="5" y="16" width="11" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <rect x="20" y="20" width="11" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <text x="10.5" y="31" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="8" fill="currentColor">1</text>
          <text x="25.5" y="31" textAnchor="middle" fontFamily="Fredoka One,cursive" fontSize="8" fill="currentColor">2</text>
          <polygon points="10.5,3 12.5,9 19,9 14,12.5 16,18.5 10.5,15 5,18.5 7,12.5 2,9 8.5,9" fill="currentColor" opacity="0.9" />
        </symbol>

        {/* CROWN — king-of-the-moment (mythic) */}
        <symbol id="ach-crown" viewBox="0 0 36 36">
          <path d="M4 28 L7 14 L13 22 L18 8 L23 22 L29 14 L32 28 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <line x1="4" y1="28" x2="32" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="8" r="2.2" fill="currentColor" />
          <circle cx="7" cy="14" r="2" fill="currentColor" />
          <circle cx="29" cy="14" r="2" fill="currentColor" />
        </symbol>

        {/* GOAT — the-goat (goat tier) */}
        <symbol id="ach-goat" viewBox="0 0 36 36">
          <path d="M10 10 C7 6 4 4 3 7 C2 10 5 12 8 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M26 10 C29 6 32 4 33 7 C34 10 31 12 28 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <ellipse cx="18" cy="18" rx="10" ry="11" fill="none" stroke="currentColor" strokeWidth="1.9" />
          <ellipse cx="8" cy="18" rx="3.5" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <ellipse cx="28" cy="18" rx="3.5" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <ellipse cx="14" cy="16" rx="2" ry="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <ellipse cx="22" cy="16" rx="2" ry="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <rect x="13.2" y="15.6" width="1.6" height="0.8" rx="0.4" fill="currentColor" />
          <rect x="21.2" y="15.6" width="1.6" height="0.8" rx="0.4" fill="currentColor" />
          <ellipse cx="18" cy="22" rx="3.5" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.7" />
          <line x1="16.5" y1="22" x2="19.5" y2="22" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <path d="M16 28 C16 31 18 33 18 33 C18 33 20 31 20 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </symbol>

        {/* Lock — estado bloqueado */}
        <symbol id="ach-lock" viewBox="0 0 16 16">
          <rect x="3" y="7" width="10" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 7 V5 A3 3 0 0 1 11 5 V7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="11" r="1.2" fill="currentColor" />
        </symbol>
      </defs>
    </svg>
  );
}

/**
 * Traduce el `iconId` que vive en BD (`ico-foo`) al fragmento `#ach-foo`
 * que referencia los símbolos del sprite de logros. Si el sprite no
 * cubre el id (logro nuevo sin diseño todavía), devuelve `#ach-dart`
 * como fallback para que la card no quede en blanco.
 */
export function achSymbolHref(iconId: string): string {
  const knownIds = new Set([
    "ico-dart",
    "ico-check10",
    "ico-binoculars",
    "ico-coin",
    "ico-invite",
    "ico-five-exact",
    "ico-medal",
    "ico-flame",
    "ico-crosshair",
    "ico-top100",
    "ico-clipboard",
    "ico-halfglobe",
    "ico-bolt",
    "ico-top50",
    "ico-double-flame",
    "ico-crosshair10",
    "ico-eye",
    "ico-globe",
    "ico-trophy",
    "ico-top10",
    "ico-podium3",
    "ico-podium2",
    "ico-crown",
    "ico-goat",
  ]);
  if (!knownIds.has(iconId)) return "#ach-dart";
  return `#ach-${iconId.replace(/^ico-/, "")}`;
}
