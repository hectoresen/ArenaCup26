# add-leaderboard-public

## Why

El leaderboard es la **puerta de entrada** de WebMundial 26: cualquier visitante (autenticado o no) llega a la home `/` y ve el ranking en vivo del torneo. Es el reclamo principal del producto y debe estar disponible desde el día 1, aunque los datos reales lleguen después con `add-match-data-providers`.

Esta propuesta materializa el visual cerrado en `docs/leaderboard-reference.html` como una página real Next.js, valida el setup de Tailwind v4 con los tokens del brand, y deja la pipeline preparada para conectar SSE más adelante sin tocar componentes.

## What changes

Capability nueva: **`leaderboard`**.

- Página pública `/` (Server Component) que renderiza el snapshot inicial del top 10.
- Setup de Tailwind v4: PostCSS config + `globals.css` con `@theme` y keyframes.
- Layout raíz con fuentes del brand (`Fredoka One`, `Nunito`).
- Componentes React/Tailwind portados fielmente del reference:
  - `TrophyLogo` (SVG hand-crafted del reference + "26").
  - `LiveBadge` (pill verde con punto pulsante).
  - `PodiumCard` (top-3 con tratamiento gold/silver/bronze).
  - `RankRow` (filas 4-10 con delta, racha, badge de aciertos).
  - `FloatingBalls` (balones flotando de fondo).
  - `LeaderboardView` (composición).
- Tipos del dominio en `src/lib/leaderboard/types.ts`.
- Datos mock en `src/lib/leaderboard/mock.ts` (los 10 jugadores del reference).
- Smoke test Vitest del módulo de mock.

**No incluye**:

- SSE real ni endpoint `/api/leaderboard/stream` — eso queda para `add-leaderboard-sse` (depende de tener `match-data` decidido).
- Botón de login / CTA de auth — el reference no lo tiene; se diseñará cuando exista el mockup de la landing pública con CTA. Por ahora la página es solo visual del ranking.
- Conexión a la BD real — el mock vive aislado, intercambiable.
- Navegación o footer compartidos con el resto de la app — el shell de la app privada se diseñará con el mockup del dashboard.

## Impact

- **Bloquea**: nada — es la primera pieza visible.
- **Desbloquea**: validación end-to-end del setup de Tailwind v4 + Next.js 15 + tokens del brand. Cualquier propuesta posterior de UI hereda este shell.
- **Riesgos**:
  - Las versiones pinned en `package.json` no están instaladas todavía. Si Next.js 15.1.x o Tailwind v4 cambian APIs antes del primer `pnpm install`, hay que ajustar.
  - El componente expone una interfaz `LeaderboardEvent` para futuras updates (SSE/polling). Si después decidimos otra forma de actualizar, esa interfaz puede evolucionar.
- **Decisiones cerradas que materializa**:
  - Lenguaje visual (`docs/leaderboard-reference.html`).
  - Etiqueta "En racha" desde 3 aciertos consecutivos (`docs/scoring.md`).
  - Banderas con `aria-label` por país (skill `leaderboard-ui`).
- **Decisiones nuevas tomadas en esta propuesta** (no inventan reglas de negocio):
  - Solo top 10 por ahora; paginación o "ver más" se evaluará cuando haya base de usuarios real.
  - Sin botón de login en el header hasta tener mockup oficial.
  - Componente `LeaderboardView` acepta una prop opcional `events?: LeaderboardEvent[]` para preparar la animación reactiva de SSE; en esta iteración siempre llega vacía.
