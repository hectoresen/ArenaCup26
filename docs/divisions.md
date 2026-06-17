# Sistema de divisiones del ranking

> Estado: shipped (2026-06-17). Cualquier cambio de threshold o icono
> pasa por una propuesta `update-divisions-<motivo>` en `openspec/changes/`.

Tres "divisiones" cosméticas que segmentan visualmente el ranking global y dan al usuario una **escalera de hitos** clara antes incluso de mirar logros.

## Tabla canónica

| División | Threshold | Tier del logro | Logro asociado | Icono |
| -------- | --------- | -------------- | -------------- | ----- |
| **Oro**     | top 10 (rank ≤ 10) | Mítico       | `division-gold`   | Gema con tinte `--color-gold` (`#f5c842`)   |
| **Plata**   | top 20 (rank ≤ 20) | Legendario   | `division-silver` | Gema con tinte `--color-silver` (`#c8d8f0`) |
| **Bronce**  | top 30 (rank ≤ 30) | Épico        | `division-bronze` | Gema con tinte `--color-bronze` (`#e8834a`) |

El umbral es **estrictamente posicional**: si el ranking se reordena el día siguiente, el divisor se ancla siempre al jugador con `rank === 10/20/30` actual — no a un jugador concreto.

## Cómo se renderiza el divisor en el leaderboard

Componente: `src/components/leaderboard/league-divider.tsx`. Se inserta como `<li aria-hidden="true">` dentro del `<ol>` del ranking, justo después de la fila cuyo `player.rank` coincide con un corte.

Visualmente:

```
[ ┄┄┄┄┄ línea gradient ┄┄┄┄┄ ◇ ┄┄┄┄┄ línea gradient ┄┄┄┄┄ ]
```

- Línea: gradiente horizontal `transparent → tier-color → transparent` con `color-mix(in srgb, var(--color-X) 65%, transparent)` (necesario porque concatenar alpha hex a un CSS var no es CSS válido — ver commit `d97808f`).
- Gema: SVG diamante facetado de 24×24 con halo (`drop-shadow` del mismo color del tier).

Si el ranking tiene menos de 31 jugadores, solo se renderizan los divisores cuyo corte existe (≤8 → ninguno; 10-19 → solo oro; 20-29 → oro + plata; ≥30 → los tres). La lógica vive en `leaderboard-view.tsx` y depende de `LEAGUE_DIVIDERS = { 10: "gold", 20: "silver", 30: "bronze" }` exportado desde el mismo componente.

**Scope actual**: solo el ranking global (`LeaderboardView`). El ranking de amigos y grupos (`GroupLeaderboardView`) NO lleva divisores porque rara vez pasa de 30 entradas y la jerarquía pierde sentido.

## Cómo se desbloquean los logros `division-*`

El catálogo (`src/server/achievements/catalog.ts`) define los 3 logros con el mismo patrón que los `top-N` clásicos. Las reglas viven en `src/server/achievements/unlock.ts`:

```ts
"division-bronze": (c) => c.rank !== null && c.rank <= 30,  // épico
"division-silver": (c) => c.rank !== null && c.rank <= 20,  // legendario, shareable
"division-gold":   (c) => c.rank !== null && c.rank <= 10,  // mítico, shareable
```

`c.rank` lo computa `loadContext` en cada llamada a `evaluateAndUnlock` con un `count(*) WHERE total_points > X` sobre `user_points`. Tie-break canónico documentado en `docs/scoring.md` §Sistema de desempate.

### Convivencia con los logros `top-N` clásicos

| Rank actual | Logros que se desbloquean simultáneamente |
| ----------- | ----------------------------------------- |
| ≤ 100       | `top-100` (rare)                          |
| ≤ 50        | `top-100`, `top-50` (epic)                |
| ≤ 30        | `top-100`, `top-50`, **`division-bronze`** |
| ≤ 20        | `top-100`, `top-50`, `division-bronze`, **`division-silver`** |
| ≤ 10        | `top-100`, `top-50`, `top-10` (legendary), `division-bronze`, `division-silver`, **`division-gold`** (mythic) |
| ≤ 3         | + `on-the-podium` (mythic)                |
| ≤ 2         | + `runner-up` (mythic)                    |
| = 1         | + `king-of-the-moment` (mythic)           |

`division-gold` y `top-10` comparten threshold pero NO son redundantes: el primero es mítico (igual narrativa que estar en el podio) y el segundo es legendario (igual narrativa que `seer` o `world-citizen`). Ambos coexisten por diseño.

### Side-effects del unlock

Cuando una llamada a `evaluateAndUnlock` desbloquea un logro de división:

1. INSERT en `user_achievements` (idempotente via `onConflictDoNothing`).
2. INSERT en `notifications` con `kind = 'achievement_unlocked'`.
3. Si el user tiene suscripción push activa, web push con título "Logro desbloqueado" + body con el título del logro.
4. **Sujeto al gate global** `ACHIEVEMENTS_MIN_FINISHED_MATCHES` (default 5 en prod): hasta que se hayan finalizado N partidos del Mundial, los logros de rendimiento — incluidos los `division-*` — no se desbloquean. Detalle en `docs/achievements.md` §Gate global.

## Backfill para usuarios ya en posición

`evaluateAndUnlock` solo se dispara cuando hay un `point_event` nuevo (scoring de un partido finalizado). Esto crea un caso edge: **usuarios que ya estaban en top 10/20/30 cuando se desplegaron los logros nuevos (2026-06-17) jamás recibirían los `division-*`** porque su scoring no cambia.

Solución: `backfillRankAchievements` (`src/server/achievements/backfill-rank-achievements.ts`):

- Corre como parte del `bootstrap.ts` en cada pre-deploy de Railway.
- Lee el top 100 con el tie-break canónico (mismo que `getRealSnapshot`).
- Para cada user, calcula el rank por orden de aparición.
- Inserta los logros de rank que correspondan y que aún no estén en `user_achievements`.
- **No emite notificaciones in-app ni push** (sería spam — potencialmente cientos de filas en startup). El user verá el logro la próxima vez que abra su perfil.
- Idempotente: en deploys sucesivos no hace nada si todo está cuadrado.

Mismo pattern que `backfillTeamSpirit`, también en bootstrap. Esto cubre el cold-start de cualquier futuro logro de rank que añadamos sin tener que hacer un script puntual.

## Cómo ampliar el sistema

### Añadir una nueva división (ej. "platino" para top 5)

1. `src/components/leaderboard/league-divider.tsx`: añadir `"platinum"` al tipo `Tier`, su color en `TIER_TONES` y la entrada `5: "platinum"` en `LEAGUE_DIVIDERS`.
2. `globals.css`: añadir `--color-platinum: #...`.
3. `src/server/achievements/catalog.ts`: añadir el logro `division-platinum` con su tier deseado.
4. `src/server/achievements/unlock.ts`: añadir la rule `"division-platinum": (c) => c.rank !== null && c.rank <= 5`.
5. `src/server/achievements/backfill-rank-achievements.ts`: añadir `{ id: "division-platinum", maxRank: 5 }` al array `RANK_RULES`.
6. Sprite + i18n (`messages/{es,en,fr,ar}.json` namespace `publicProfile.tier` si el tier es nuevo, o nada si reutilizamos un tier existente).
7. Tests: extender `league-divider.test.tsx`, `unlock.test.ts`, `catalog.test.ts`.

### Cambiar el threshold de una división existente

NO es retroactivo. Bajar `division-gold` de top 10 a top 5 NO revoca el logro a quien ya lo tuviera (los unlocks son inmutables por diseño — ver `docs/achievements.md`). Solo afecta a quien lo desbloquee desde ese momento. El `backfill` sí ajustaría los thresholds futuros.

## Cross-refs

- `docs/achievements.md` — catálogo formal con las 3 entradas + total 28.
- `docs/scoring.md` §Sistema de desempate — tie-break que decide el rank.
- `docs/architecture.md` §Capability `achievements` — mención del sistema.
- `src/components/leaderboard/league-divider.tsx` — implementación visual.
- `src/server/achievements/backfill-rank-achievements.ts` — backfill operacional.
