# Design — add-leaderboard-public

## Tailwind v4 setup

Tailwind v4 abandona el JS config en favor de CSS-first. La configuración del proyecto vive en `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-bg: #0d1117;
  --color-card: #161e28;
  --color-card2: #1c2635;
  --color-gold: #f5c842;
  --color-gold2: #e8a800;
  --color-silver: #c8d8f0;
  --color-bronze: #e8834a;
  --color-success: #00e676;
  --color-danger: #ff4d6d;
  --color-info: #4fc3f7;
  --color-text: #f0f6ff;
  --color-muted: rgba(240, 246, 255, 0.42);
  --color-border: rgba(255, 255, 255, 0.07);

  --font-display: var(--font-fredoka-one), cursive;
  --font-sans: var(--font-nunito), sans-serif;
}
```

Todas las keyframes del reference (`popIn`, `slideIn`, `flashGreen`, `flashRed`, `trophyFloat`, `ballSpin`, `floatUp`, `blink`) se declaran en el mismo archivo dentro de `@layer utilities` y se usan vía clases Tailwind o `className="animate-[ballSpin_4s_linear_infinite]"`.

`postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

## Fuentes

`next/font/google` carga las dos fuentes y expone variables CSS al layout root:

```tsx
import { Fredoka_One, Nunito } from "next/font/google";

const fredoka = Fredoka_One({ subsets: ["latin"], weight: "400", variable: "--font-fredoka-one" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400","600","700","800","900"], variable: "--font-nunito" });
```

Se aplican al `<body>` con `className={`${fredoka.variable} ${nunito.variable} font-sans`}`.

## Componentes y data flow

```
app/page.tsx (Server)
  └─ getInitialSnapshot() (mock)
  └─ <LeaderboardView snapshot={...} />          (Client wrapper)
       ├─ <TrophyLogo />                         (Server)
       ├─ <LiveBadge />                          (Server)
       ├─ <FloatingBalls count={7} />            (Client, useEffect)
       ├─ <PodiumCard rank={1|2|3} player={...}/>(Server)
       └─ <RankRow player={...} delta={...} />   (Server, recibe diff)
```

`LeaderboardView` es Client porque acepta una prop futura `events?: LeaderboardEvent[]` para reaccionar a updates. En esta iteración siempre llega vacía y el render es esencialmente estático.

## Tipos

```ts
// src/lib/leaderboard/types.ts
export type Player = {
  id: string;
  name: string;
  countryCode: string;     // e.g. 'MX'
  countryName: string;     // 'México' (para aria-label)
  flag: string;            // emoji
  points: number;
  streak: number;
  correctCount: number;
  rank: number;
  previousRank: number;    // para delta
};

export type LeaderboardSnapshot = {
  generatedAt: string; // ISO
  players: Player[];
};

export type LeaderboardEvent =
  | { type: "score-update"; playerId: string; pointsDelta: number; newRank: number }
  | { type: "snapshot"; snapshot: LeaderboardSnapshot };
```

`LeaderboardEvent` queda definido aunque no se use todavía: deja el contrato listo para el hook futuro `useLeaderboardStream` cuando se implemente SSE.

## Mock data

10 jugadores hardcoded basados en los del reference HTML:

```ts
[
  { name: "Carlos Mendoza", flag: "🇲🇽", country: "MX", points: 4820, streak: 7, correct: 34 },
  { name: "Layla Hassan",   flag: "🇸🇦", country: "SA", points: 4610, streak: 5, correct: 31 },
  // …
];
```

Calculados con `rank` y `previousRank = rank` (sin delta inicial).

## Reglas a corregir del reference HTML

Aplicamos las correcciones que el skill `leaderboard-ui` ya documenta:

- Custom properties usaban `–` (en-dash) → en Tailwind/CSS usamos `--`.
- Comillas tipográficas en el HTML → comillas rectas en JSX.
- Bloques markdown ` ``` ` que se colaron en el HTML original → no aparecen.

## Animaciones y reduced motion

Todas las animaciones (`popIn`, `slideIn`, `floatUp`, `ballSpin`, `trophyFloat`, `blink`) se desactivan vía:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Accesibilidad

- Banderas como emoji + `aria-label` con el nombre completo del país (los lectores no leen los emojis de bandera).
- `LiveBadge` con `role="status"` y `aria-live="polite"` (cuando llegue SSE).
- Cada `RankRow` con `aria-label` resumido: "Posición 4: Yuki Tanaka, Japón, 3970 puntos, racha 3".
- Contraste auditado: `--color-muted` sobre `--color-bg` cumple AA para `font-size ≥ 12px`.

## Trade-offs considerados

- **Server vs Client para `LeaderboardView`**: aunque podría ser Server inicialmente, la capa Client facilita conectar SSE más adelante sin partir el componente.
- **Animar updates ahora vs después**: las keyframes están listas, pero sin events que las disparen. Coste cero por dejarlas; ahorra reescribir cuando llegue SSE.
- **`PodiumCard` con `rank` como prop vs tres componentes distintos**: una sola prop `rank: 1|2|3` y switch interno. Menos duplicación.
- **`FloatingBalls` Client vs CSS puro**: lo hago Client porque la posición/duración aleatoria por instancia (parte del look del reference) es difícil de conseguir con solo CSS sin sacrificar variedad. `prefers-reduced-motion` lo deshabilita.
