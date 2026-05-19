# add-scoring-engine

## Why

Las reglas de puntuación viven en `docs/scoring.md` y `docs/business-rules.md` desde hace semanas, pero **nada las computa**. Cualquier propuesta posterior (`add-prediction-flow`, `add-leaderboard-sse`, edge-case fixtures, replay del Mundial 2022) las necesita primero como **función pura testeable**.

Sin esto:
- El flujo de predicción no sabe cuántos puntos asignar al cierre.
- Los tests del replay no pueden verificar que el resultado es correcto.
- El primer partido del Mundial puede ser literalmente la primera ejecución del cálculo.

Esta propuesta materializa el motor como un módulo puro, aislado, exhaustivamente testeado, sin tocar BD ni I/O.

## What changes

Capability nueva: **`scoring-engine`**.

- `src/server/scoring/rules.ts` — constantes alineadas 1:1 con `docs/scoring.md`: `POINTS.simple = 10`, `POINTS.exact = 30`, `POINTS.double = 5`, `COMBO_BONUS.base = {3:5, 5:15, 10:50}`, `COMBO_BONUS.modified = {3:3, 5:5, 10:9}`.
- `src/server/scoring/types.ts` — tipos de dominio (`MatchOutcome`, `Prediction`, `StreakState`, `ScoreResult`, `ComboBonus`). Independientes del schema Drizzle: el adapter en propuestas posteriores convertirá filas de BD a estos tipos.
- `src/server/scoring/engine.ts` — función pura `scoreMatchPrediction(match, prediction, streakBefore) → ScoreResult`.
- `src/server/scoring/engine.test.ts` — **65+ tests** cubriendo:
  - Estados anulados (cancelled, postponed, live, finished sin scores).
  - Grupos: simple (5), exacto (5), dobles (9 combinaciones de 1X/X2/12 × home/draw/away).
  - Eliminatoria: simple con prórroga y penaltis, exacto con prórroga, exacto en empate-decidido-por-penaltis, dobles 1X/X2/12 con todos los desenlaces posibles.
  - Combos base (no doubles): hitos 3, 5, 10 + ausencia de bonus en 0-2, 4, 6-9, 11+.
  - Combos modificados (con double en racha): hitos 3, 5, 10.
  - Transiciones de racha: reset en miss, preservación en voided, propagación de `containsDouble`.
  - Escenarios integrados: doble-en-hito-3, exacto-en-hito-10, miss en knockout reseteando racha de 7.

**No incluye**:

- Wiring a la BD. La función no escribe `point_events` ni actualiza `user_points`. Eso vive en la futura `add-prediction-flow` (o `add-scoring-pipeline` si lo separamos), que adapta filas Drizzle a `MatchOutcome`/`Prediction` y materializa el `ScoreResult`.
- Cálculo de **puntos provisionales** (durante partido en vivo). El motor da igual: la función se invoca con un snapshot del estado del partido, sea oficial o provisional. La distinción "provisional vs. oficial" es de orquestación, no de cálculo.
- Engagement (encuestas, referidos, login). Esos no interactúan con la racha y se calculan por separado; quedan para sus propias propuestas.

## Impact

- **Bloquea**: nada.
- **Desbloquea**:
  - `add-edge-case-fixtures` (la siguiente propuesta) — los 8 escenarios sintéticos consumen este motor.
  - `add-fixture-seed-wc2022` — el replay del Mundial 2022 valida el motor end-to-end.
  - `add-prediction-flow` — el adapter de BD a `MatchOutcome`/`Prediction` lo conectará.
  - `add-leaderboard-sse` — actualiza el ranking con los `ScoreResult` que produzca este motor.
- **Riesgos**: bajos. Función pura, sin estado, 65+ tests deterministas.
- **Trade-off**: los tipos del engine no derivan del schema Drizzle (no `InferSelectModel`). Coste: el adapter manual. Beneficio: el engine no depende del ORM y se puede tests sin tocar BD ni mocks.

## Decisiones tomadas

- **Función pura, sin estado**: el caller le pasa `streakBefore` y recibe `streakAfter`. La tabla `user_points` la actualiza el caller. Hace los tests determinísticos sin mocks.
- **`MatchOutcome` desacoplado de Drizzle**: solo lleva los campos imprescindibles. El adapter que convierte filas a este tipo vive en propuestas posteriores.
- **`scoreAtExtra` reemplaza `scoreAt90`** cuando está presente (regla de eliminatoria). Si `scoreAtExtra` es null, se usa el 90'. Limpio sin condicionales por stage.
- **Penalty winner solo "rompe el empate"**: si los marcadores difieren, el ganador es el del marcador (penaltyWinner se ignora aunque esté seteado, defensivo).
- **`PointEventKind` del engine ≠ enum de DB**: en BD hay `simple|exact|double|combo|poll|referral`. El engine devuelve `simple|exact|double|miss|voided`. El caller materializa los combos como `point_events` de tipo `combo` separados, leyendo `result.comboBonuses`.
- **Defensive paths**: predicción con `predictedWinner=null` en `kind=simple`, o `predictedHomeScore=null` en `kind=exact`, miss limpio. No throw. Permite que el engine sobreviva a datos inconsistentes y los tests verifican el comportamiento.
- **`live` status también es voided**: el engine no debería invocarse durante un partido en vivo, pero si lo hace, devuelve voided sin tocar la racha. Es defensa en profundidad.
