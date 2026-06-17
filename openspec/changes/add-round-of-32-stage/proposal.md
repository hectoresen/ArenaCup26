# add-round-of-32-stage — Soporte para los octavos de 32 equipos del Mundial 2026

## Why

WC 2026 estrena formato expandido: **48 equipos, 12 grupos de 4**. La primera ronda eliminatoria tiene 32 equipos (12 ganadores + 12 segundos + 8 mejores terceros) jugando 16 partidos — **Round of 32 / dieciseisavos / octavos** (en jerga ES también "octavos" porque son 16 partidos, aunque técnicamente sea ronda de 32 equipos).

Hoy nuestro stack solo conoce `round-of-16` en adelante:

- `match_stage` pgEnum (esquema Drizzle) → falta `round-of-32`.
- `MatchStage` y `BracketRound` TS types → idem.
- `parseStage` en `api-football.parser.ts` → solo reconoce `"round of 16"` y `"1/8"`.
- `reconcileMatch` skipea silenciosamente snapshots con `stage = null`.
- `BRACKET_ROUNDS` en `matches/queries.ts` no incluye la ronda → la vista bracket no la renderiza.

**Consecuencia**: cuando api-football publique los 16 fixtures de la primera ronda eliminatoria (esperado ~28 jun cuando termine la fase de grupos, kickoff de la ronda 3 jul), el pipeline los **descartará silenciosamente** y los usuarios no podrán predecir esos partidos. El bracket de la web tampoco mostrará la ronda.

Validación previa (2026-06-17):

- `GET /fixtures?league=1&season=2026` devuelve 72 fixtures, todos `round = "Group Stage - N"`.
- `GET /fixtures/rounds?league=1&season=2026` devuelve `["Group Stage - 1", "Group Stage - 2", "Group Stage - 3"]`.
- 27 bots × 72 predicciones = 1944 predicciones de fase de grupos ya en BD. Cobertura completa.
- Filtro `eq(matches.stage, "group")` en `seed-predictions.ts` ya excluye knockouts → los bots seguirán sin predecir octavos por diseño (correcto).

## What changes

Capability afectada principalmente: **`match-data-providers`** (parser y adapter). Cambios cosurperficiales en `data-model` (enum), `scoring-engine` (type extension sin lógica nueva) y `matches` (BracketRound + UI bracket + i18n).

### Schema (Drizzle)

- Migration que añade `'round-of-32'` al pgEnum `match_stage`. Postgres acepta `ALTER TYPE ... ADD VALUE` sin recrear la tabla. Idempotente con `IF NOT EXISTS` (Postgres 12+).

### Types

- `MatchStage` (en `src/server/scoring/types.ts`): añadir `"round-of-32"` antes de `"round-of-16"` para reflejar el orden cronológico.
- `BracketRound` (en `src/server/matches/types.ts`): idem.

### Parser

- `parseStage` reconoce, en este orden (más específico primero, evita que "Round of 32" colisione con "Round of 16"):
  - `"round of 32"` / `"last 32"` / `"1/16"` → `round-of-32`.
  - El resto se mantiene como hoy.

### Pipeline

- `reconcileMatch` no cambia: sigue skipeando `stage = null` (defensa contra rounds desconocidos futuros). Sí cambia el **conjunto** de rounds que ya no caen a null.

### UI

- `BRACKET_ROUNDS` en `src/server/matches/queries.ts` se amplía a `["round-of-32", "round-of-16", "quarter", "semi", "third-place", "final"]`.
- `messages/{es,en,fr,ar}.json` añaden la copia para `round-of-32` (es: "Octavos de final", en: "Round of 32", fr: "16e de finale", ar: "دور الـ32").
- El componente `BracketView` itera sobre `BRACKET_ROUNDS` y ya renderizaría la ronda nueva sin cambios estructurales; solo necesita asegurarse de que el grid no se desborde con 16 partidos.

### Scoring

- **Sin cambios de lógica**. El engine solo distingue `group` vs el resto (eliminatoria). `round-of-32` cae en eliminatoria automáticamente: marcador hasta 120', ganador con penaltis, dobles `1X`/`X2` desactivadas. Idéntico tratamiento a `round-of-16`.

### Tests

- `api-football.parser.test.ts`: 3 nuevos casos (Round of 32, Last 32, 1/16).
- `edge-cases.fixtures.ts`: 1 fixture nuevo de `stage: "round-of-32"` con prórroga + penaltis para asegurar que el engine puntúa bien.
- `bracket-view.test.tsx`: render con ronda nueva.

### Docs

- `docs/business-rules.md` — sección "Reglas de eliminatoria": añadir `round-of-32` al listado de stages que siguen las reglas de eliminatoria.
- `docs/scoring.md` — tabla de stages: incluir `round-of-32`.
- `docs/data-pipeline.md` — sección round string mapping: añadir las nuevas variantes.

## Impact

- **Bloquea**: nada.
- **Desbloquea**: cuando api-football publique los 16 fixtures (esperado entre 28 jun y 2 jul), el sync los reconoce y persiste; los users pueden predecirlos; el bracket los renderiza.
- **Riesgos**:
  - **No conocemos el label exacto** que publicará api-football para WC 2026 en el endpoint de rounds. Aunque cubrimos las 3 variantes más probables (`"Round of 32"`, `"Last 32"`, `"1/16 Finals"`), pueden inventarse algo distinto (ej. `"Round of 16"` mal-etiquetado, `"Knockout Round 1"`). Mitigación: verificar manualmente con `GET /fixtures/rounds?league=1&season=2026` cuando api-football publique knockouts (probable ~28 jun); si el string es inesperado, basta con extender `parseStage` con un nuevo `includes()` y redeploar.
  - **Migration en producción**: `ALTER TYPE ADD VALUE` en Postgres bloquea brevemente la tabla (DDL lock) pero no requiere reescritura de filas. Latencia esperada < 100 ms en una tabla con < 100 matches. Sin downtime visible.
- **Compromisos cerrados**:
  - El stage `round-of-32` hereda 100 % las reglas de eliminatoria del engine. No hay puntuación diferenciada (un acierto simple = 10 pts igual que en cualquier otra eliminatoria).
  - Los bots no predicen `round-of-32` (filtro `stage='group'` existente lo garantiza). Es el comportamiento deseado del cold-start.
  - Si api-football publica algún partido con un round string desconocido distinto de los cubiertos, el sync lo seguirá skipeando hasta nuestro hotfix. **No es regresión**: hoy ya skipea.

## Decisiones cerradas

- **Nombre interno del stage**: `"round-of-32"` (kebab-case, mismo estilo que `"round-of-16"`).
- **Copy ES**: "Octavos de final" — la jerga futbolística española llama "octavos" a la ronda de 16 partidos, independientemente de cuántos equipos jueguen. Hace cero confusión a usuarios hispanos.
- **Copy EN**: "Round of 32" — consistente con FIFA y con el ordinal real de equipos.
- **Posición en el orden**: primer elemento de `BRACKET_ROUNDS` para reflejar cronología (es la primera ronda eliminatoria).
- **NO añadimos puntuación diferenciada por stage**: el scoring sigue igual que el resto de eliminatoria (3 jul → todos los stages > group otorgan los mismos puntos por hit). Cualquier change sería un proposal separado.
