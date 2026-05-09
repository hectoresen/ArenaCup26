export function TrophyLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="72"
      height="88"
      viewBox="0 0 72 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="36" cy="82" rx="20" ry="4" fill="rgba(245,200,66,0.18)" />
      <rect x="16" y="74" width="40" height="6" rx="3" fill="url(#wmTrophyBase)" />
      <rect x="20" y="70" width="32" height="5" rx="2.5" fill="url(#wmTrophyBase)" />
      <rect x="31" y="56" width="10" height="16" rx="2" fill="url(#wmTrophyStem)" />
      <rect x="33" y="57" width="3" height="14" rx="1.5" fill="rgba(255,255,255,0.18)" />
      <path
        d="M14 14 C10 14 6 18 6 26 C6 36 12 44 22 50 L28 54 L44 54 L50 50 C60 44 66 36 66 26 C66 18 62 14 58 14 Z"
        fill="url(#wmTrophyCup)"
        stroke="url(#wmTrophyCupStroke)"
        strokeWidth="1.5"
      />
      <path
        d="M18 18 C15 20 13 25 14 32 C16 39 21 45 28 49 L36 51 C44 49 50 43 53 36 C55 29 54 22 51 18 Z"
        fill="url(#wmTrophyInner)"
        opacity="0.35"
      />
      <ellipse
        cx="26"
        cy="26"
        rx="5"
        ry="8"
        fill="rgba(255,255,255,0.22)"
        transform="rotate(-10 26 26)"
      />
      <ellipse
        cx="24"
        cy="22"
        rx="2"
        ry="3"
        fill="rgba(255,255,255,0.35)"
        transform="rotate(-10 24 22)"
      />
      <path
        d="M14 24 C4 22 2 30 4 36 C6 40 10 42 14 40"
        stroke="url(#wmTrophyHandle)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M58 24 C68 22 70 30 68 36 C66 40 62 42 58 40"
        stroke="url(#wmTrophyHandle)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M13 26 C6 24 4 31 6 36"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M59 26 C66 24 68 31 66 36"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="36" cy="14" rx="22" ry="4" fill="url(#wmTrophyRim)" />
      <ellipse cx="36" cy="14" rx="18" ry="2.5" fill="rgba(255,255,255,0.12)" />
      <circle cx="36" cy="8" r="7" fill="#f0f0f0" stroke="#222" strokeWidth="0.8" />
      <path d="M36 3 L39 6 L38 10 L34 10 L33 6 Z" fill="#111" opacity="0.85" />
      <path d="M29 7 L33 6 L34 10 L31 13 L28 11 Z" fill="#111" opacity="0.7" />
      <path d="M43 7 L39 6 L38 10 L41 13 L44 11 Z" fill="#111" opacity="0.7" />
      <defs>
        <linearGradient
          id="wmTrophyCup"
          x1="36"
          y1="8"
          x2="36"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="40%" stopColor="#f5c842" />
          <stop offset="80%" stopColor="#c89010" />
          <stop offset="100%" stopColor="#a06800" />
        </linearGradient>
        <linearGradient id="wmTrophyCupStroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe88a" />
          <stop offset="100%" stopColor="#8a5a00" />
        </linearGradient>
        <linearGradient
          id="wmTrophyInner"
          x1="36"
          y1="18"
          x2="36"
          y2="52"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#1a1000" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient
          id="wmTrophyStem"
          x1="31"
          y1="56"
          x2="41"
          y2="72"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#d4920a" />
          <stop offset="50%" stopColor="#f5c842" />
          <stop offset="100%" stopColor="#a06800" />
        </linearGradient>
        <linearGradient
          id="wmTrophyBase"
          x1="16"
          y1="70"
          x2="56"
          y2="80"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#c88800" />
          <stop offset="50%" stopColor="#f0b830" />
          <stop offset="100%" stopColor="#a06800" />
        </linearGradient>
        <linearGradient id="wmTrophyHandle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#c88800" />
        </linearGradient>
        <radialGradient id="wmTrophyRim" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#ffe88a" />
          <stop offset="100%" stopColor="#b07800" />
        </radialGradient>
      </defs>
    </svg>
  );
}
