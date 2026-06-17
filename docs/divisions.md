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

El sistema tiene **tres manifestaciones** complementarias:

1. **Línea divisoria visual** en el ranking (entre rank 10/20/30 y el siguiente). Ver §"Cómo se renderiza el divisor en el leaderboard".
2. **Logro permanente** `division-bronze/silver/gold` desbloqueado al cruzar cada umbral por primera vez. Una vez desbloqueado, no se pierde aunque caigas de división. Ver §"Cómo se desbloquean los logros".
3. **Medalla del perfil**, derivada del rank ACTUAL del owner, reversible (cae con el rank). Ver §"Medalla en el perfil".

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

## Medalla en el perfil

Cada user del top 30 muestra en la esquina superior derecha de su `<ProfileHero>` una medalla SVG (oro/plata/bronce) con un copy minimalista debajo ("División de Oro", traducido en `messages/{locale}.json` namespace `publicProfile.medal.labels`).

| Rank actual | Medalla |
| ----------- | ------- |
| 1-10        | Oro    |
| 11-20       | Plata  |
| 21-30       | Bronce |
| 31+ o `null`| (sin medalla) |

### Derivada, NO persistida

La medalla es estado **derivado** del rank actual del user. NO se guarda en BD. Cada render del perfil:

1. `getPublicProfile` computa `profile.stats.rank` (mismo tie-break canónico que el leaderboard).
2. La página `/u/<username>` aplica `getDivisionForRank(rank)` (en `src/lib/leaderboard/division.ts`).
3. `<ProfileHero>` recibe `division: Division | null` y renderiza `<DivisionMedal>` si no es null.

Esto la hace inherentemente **reversible**:

- Si caes de #10 a #11, el siguiente render muestra plata en lugar de oro.
- Si caes a #31, la medalla desaparece (sin gracia period — refleja la verdad del ranking).
- Si subes a #1, la medalla sigue siendo oro (no hay una "división supreme" especial; el user diferencia su #1 por el logro `king-of-the-moment` y el resto de mítico/GOAT).

### Diferencia con los logros `division-*`

| | Medalla | Logro |
| --- | --- | --- |
| Persistido en BD | No | Sí (`user_achievements`) |
| Reversible | Sí (cae con el rank) | No (irrevocable) |
| Refleja | Estado actual | Mejor estado histórico (cima alcanzada) |
| Visible | Solo en el `<ProfileHero>` | En el catálogo de logros del perfil + dashboard |

Resumen narrativo: **la medalla dice "dónde estás hoy", el logro dice "hasta dónde llegaste"**.

### Por qué no necesita cron ni evento "ranking moved"

Como el rank se computa fresco en cada visita al perfil (y el perfil es la única superficie donde aparece la medalla), no hay desincronización posible. Si un día queremos extender la medalla al ranking, dashboard u otra superficie, igual con derivar en cada query. La única condición para que sea correcto es que `profile.stats.rank` sea fresco — y lo es porque `getPublicProfile` ejecuta el COUNT del rank en cada llamada.

### SVG: componente `DivisionMedal`

`src/components/public-profile/division-medal.tsx`. Diseño:

- Pendant circular con cinta en V superior (doble tira para sugerir pliegue 3D), ornamento central distinto por tier (estrella oro, laurel plata, palmera simplificada bronce — funcionan también en grayscale para accesibilidad).
- Profundidad mediante `<radialGradient>` para el fill (centro brillante → borde apagado) + specular highlight upper-left que simula reflejo sobre metal pulido.
- Color via `var(--color-gold/silver/bronze)` con `drop-shadow` del mismo color al 50% alpha.
- Copy debajo en `text-[10px] font-extrabold uppercase`, alineado al center bajo la medalla.

NO usa el sprite global de logros: el SVG es pequeño, único por perfil, y mantenerlo inline simplifica la lectura del componente.

### Click → modal explicativo

La medalla es **clickable**. Al pulsarla se abre un modal centrado (mismo pattern que `NotificationModal` del shell) con:

1. Header con la medalla en pequeño + título de la división.
2. Body con dos párrafos: explicación específica del tier ("estás en el top 10…") + cómo funciona el sistema (reversible + logro permanente).
3. Footer con un link **"Ver más"** que navega a `/faq#faq-divisions`.

El FAQ tiene soporte de deep-link: cada `<FaqItem>` lleva `id={\`faq-${id}\`}` y la página monta `<FaqHashOpener>` (client) que abre el `<details>` referenciado por el hash al cargar. Resultado: el user pulsa la medalla → modal → "Ver más" → aterriza en el FAQ con la pregunta ya abierta.

Copys del modal en `messages/{locale}.json` namespace `publicProfile.medal.popover`.

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
- `src/lib/leaderboard/division.ts` — helper `getDivisionForRank` + tipo `Division`.
- `src/components/leaderboard/league-divider.tsx` — implementación visual del divisor.
- `src/components/public-profile/division-medal.tsx` — medalla del perfil.
- `src/server/achievements/backfill-rank-achievements.ts` — backfill operacional.
- FAQ del producto: pregunta `divisions` en `messages/{locale}.json` namespace `faq.questions.items`.
