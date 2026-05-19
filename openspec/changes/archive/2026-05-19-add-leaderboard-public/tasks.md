# Tasks — add-leaderboard-public

- [ ] 1. Setup Tailwind v4: `postcss.config.mjs`, `src/app/globals.css` con `@import "tailwindcss"` y `@theme` con todos los tokens del brand.
- [ ] 2. Layout raíz `src/app/layout.tsx` con fuentes (`Fredoka One`, `Nunito`) cargadas vía `next/font/google`.
- [ ] 3. Tipos del dominio en `src/lib/leaderboard/types.ts` (`Player`, `LeaderboardSnapshot`, `LeaderboardEvent`).
- [ ] 4. Datos mock en `src/lib/leaderboard/mock.ts` con los 10 jugadores del reference.
- [ ] 5. Componente `TrophyLogo` con el SVG hand-crafted del reference (gradients, shines, handles, ball on top).
- [ ] 6. Componente `LiveBadge` con punto pulsante en `--color-success`.
- [ ] 7. Componente `PodiumCard` con tratamiento gold/silver/bronze y crown animado en p1.
- [ ] 8. Componente `RankRow` con delta (▲/▼/·), racha con fuego (≥3), badge de aciertos.
- [ ] 9. Componente `FloatingBalls` (Client) que crea N balones flotantes con `floatUp` keyframe.
- [ ] 10. Componente `LeaderboardView` compone header + podio + lista + footer; acepta `snapshot` y opcional `events`.
- [ ] 11. Página `/` (Server Component) que carga el mock y renderiza `LeaderboardView`.
- [ ] 12. Smoke test Vitest sobre `mock.ts` (10 jugadores ordenados por puntos descendentes).
- [ ] 13. Promover `specs/leaderboard/spec.md` a `openspec/specs/leaderboard/spec.md`.
- [ ] 14. Mover propuesta a `openspec/changes/archive/YYYY-MM-DD-add-leaderboard-public/`.
