/**
 * Símbolos SVG inline reutilizables por el shell (top-nav, bottom-nav).
 * Se montan una sola vez al inicio del árbol (en `<AppShell>`) y los
 * tabs los referencian vía `<use href="#ico-*">`.
 *
 * Es preferible este patrón frente a re-renderizar cada icono porque:
 *  - SSR sigue funcionando sin que el navegador descargue lib de iconos.
 *  - Tamaño del bundle: 1 sola definición compartida.
 *  - Cambiar el color funciona vía `currentColor`.
 */
export function ShellIconSprite() {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <symbol id="ico-home" viewBox="0 0 20 20">
          <path
            d="M3 9.5 L10 3 L17 9.5 V17 A1 1 0 0 1 16 18 H13 V13 H7 V18 H4 A1 1 0 0 1 3 17 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </symbol>

        <symbol id="ico-ball" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 2.5 L10 5.5 M7 5 L10 7.5 L13 5 M4.5 13.5 L7 11.5 L7 7.5 M15.5 13.5 L13 11.5 L13 7.5 M7.5 15.5 L10 13.5 L12.5 15.5 M10 13.5 L10 17.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </symbol>

        <symbol id="ico-trophy-sm" viewBox="0 0 20 20">
          <path
            d="M5 3 L15 3 M5 3 C5 3 4 4.5 4 7 C4 10 6 12.5 9.5 13.5 L10.5 14 L11.5 13.5 C14 12.5 16 10 16 7 C16 4.5 15 3 15 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 7 C2 6.5 1 9.5 2.5 11.5 C3 12 4 12.5 4.5 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M16 7 C18 6.5 19 9.5 17.5 11.5 C17 12 16 12.5 15.5 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <line x1="10" y1="14" x2="10" y2="16.5" stroke="currentColor" strokeWidth="1.3" />
          <line
            x1="7.5"
            y1="16.5"
            x2="12.5"
            y2="16.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </symbol>

        <symbol id="ico-medal" viewBox="0 0 20 20">
          <circle cx="10" cy="13.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7.5 3.5 L5.5 7.5 M12.5 3.5 L14.5 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="7.5"
            y1="3.5"
            x2="12.5"
            y2="3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <text
            x="10"
            y="17.5"
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize="5.5"
            fill="currentColor"
          >
            1
          </text>
        </symbol>

        <symbol id="ico-social" viewBox="0 0 20 20">
          {/* Dos figuras: head + shoulders solapadas, evoca grupo */}
          <circle cx="7" cy="7" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="13.5" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M2 17 a5 5 0 0 1 10 0 M10.5 17 a3.6 3.6 0 0 1 7 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </symbol>

        <symbol id="ico-bell" viewBox="0 0 20 20">
          <path
            d="M10 2 C10 2 6 4.5 6 9 L6 14 L4 16 L16 16 L14 14 L14 9 C14 4.5 10 2 10 2Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M8.2 16 A2 2 0 0 0 11.8 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </symbol>
      </defs>
    </svg>
  );
}

/**
 * Logo del trofeo en el top-nav. SVG complejo con gradientes propios,
 * no se mete en el sprite porque tiene `<defs>` propios y no escala
 * bien como `<use>`.
 */
export function TrophyLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="34"
      viewBox="0 0 72 88"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="36" cy="82" rx="20" ry="4" fill="rgba(245,200,66,0.15)" />
      <rect x="16" y="74" width="40" height="6" rx="3" fill="url(#nBG)" />
      <rect x="20" y="70" width="32" height="5" rx="2.5" fill="url(#nBG)" />
      <rect x="31" y="56" width="10" height="16" rx="2" fill="url(#nSG)" />
      <path
        d="M14 14 C10 14 6 18 6 26 C6 36 12 44 22 50 L28 54 L44 54 L50 50 C60 44 66 36 66 26 C66 18 62 14 58 14 Z"
        fill="url(#nCG)"
        stroke="url(#nCS)"
        strokeWidth="1.5"
      />
      <ellipse
        cx="26"
        cy="26"
        rx="5"
        ry="8"
        fill="rgba(255,255,255,0.2)"
        transform="rotate(-10 26 26)"
      />
      <path
        d="M14 24 C4 22 2 30 4 36 C6 40 10 42 14 40"
        stroke="url(#nHG)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M58 24 C68 22 70 30 68 36 C66 40 62 42 58 40"
        stroke="url(#nHG)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="36" cy="14" rx="22" ry="4" fill="url(#nRG)" />
      <circle cx="36" cy="8" r="7" fill="#f0f0f0" stroke="#222" strokeWidth="0.8" />
      <path d="M36 3 L39 6 L38 10 L34 10 L33 6 Z" fill="#111" opacity="0.85" />
      <path d="M29 7 L33 6 L34 10 L31 13 L28 11 Z" fill="#111" opacity="0.7" />
      <path d="M43 7 L39 6 L38 10 L41 13 L44 11 Z" fill="#111" opacity="0.7" />
      <defs>
        <linearGradient id="nCG" x1="36" y1="8" x2="36" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="40%" stopColor="#f5c842" />
          <stop offset="80%" stopColor="#c89010" />
          <stop offset="100%" stopColor="#a06800" />
        </linearGradient>
        <linearGradient id="nCS" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe88a" />
          <stop offset="100%" stopColor="#8a5a00" />
        </linearGradient>
        <linearGradient id="nSG" x1="31" y1="56" x2="41" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d4920a" />
          <stop offset="50%" stopColor="#f5c842" />
          <stop offset="100%" stopColor="#a06800" />
        </linearGradient>
        <linearGradient id="nBG" x1="16" y1="70" x2="56" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c88800" />
          <stop offset="50%" stopColor="#f0b830" />
          <stop offset="100%" stopColor="#a06800" />
        </linearGradient>
        <linearGradient id="nHG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#c88800" />
        </linearGradient>
        <radialGradient id="nRG" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#ffe88a" />
          <stop offset="100%" stopColor="#b07800" />
        </radialGradient>
      </defs>
    </svg>
  );
}
