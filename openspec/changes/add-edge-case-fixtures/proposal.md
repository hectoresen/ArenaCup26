# add-edge-case-fixtures

## Why

`add-scoring-engine` cerró con 65+ tests que cubren el código del motor. Pero el equipo de producto y QA necesita poder **leer y razonar sobre los casos** sin abrir tests TypeScript llenos de helpers. Y el roadmap de `pre-launch-testing.md` pide explícitamente "synthetic edge-case fixtures" como primera red de seguridad antes del Mundial.

Esta propuesta convierte cada escenario crítico en un **fixture nominal**: un objeto con `match`, `prediction`, `streakBefore` y `expected`. Vitest los corre uno a uno y compara `result === expected`. Si alguien rompe la regla de "marcador exacto en eliminatoria usa el 120'", el fixture correspondiente cae con un diff claro.

## What changes

Capability nueva: **`edge-case-fixtures`**.

- `src/server/scoring/edge-cases.fixtures.ts` con **17 fixtures** organizados en 4 grupos:
  - **Grupos** (4): empate acertado, goleada exacta, doble 1X que cubre empate, exacto que falla con mismo ganador (sin fallback a simple).
  - **Eliminatoria** (5): prórroga decide simple, penaltis deciden simple, exacto sobre 1-1 + penaltis (penaltis no suman al marcador), 'draw' siempre falla en eliminatoria, doble 12 siempre acierta cuando hay ganador oficial.
  - **Anulados** (2): cancelado preserva racha, pospuesto preserva racha con `containsDouble = true`.
  - **Combos / racha** (6): hito 3 base, hito 3 modificado por doble previa, hito 3 disparado por doble entrante, hito 10 base con exacto (80 puntos totales), hito 5 modificado, miss en racha de 7 reseteando a 0.
- `src/server/scoring/edge-cases.test.ts` con un `it.each` que pasa cada fixture por el engine y compara el resultado completo. Más sanity checks: longitud mínima del set, IDs únicos, cobertura de stages y kinds.

**No incluye**:

- Fixtures basados en partidos reales del Mundial 2022 — eso vive en `add-fixture-seed-wc2022` (siguiente).
- Tests de la pipeline de orquestación (qué pasa cuando se invoca el engine sobre todas las predicciones de un partido a la vez). Eso espera a `add-prediction-flow`.
- Generadores aleatorios (property-based testing). Útiles pero no son la prioridad ahora.

## Impact

- **Bloquea**: nada.
- **Desbloquea**: cualquier refactor del engine (optimización, simplificación) tiene una red de seguridad legible. Si añadimos un campo nuevo a `MatchOutcome` o cambiamos un valor en `rules.ts`, los fixtures te dicen exactamente qué escenarios se han movido.
- **Riesgos**: bajos. Los fixtures son datos; cualquier inconsistencia con el engine se detecta en CI.
- **Trade-off**: TypeScript fixtures (vs JSON) por tipos automáticos. Coste: alguien que solo lee no ve syntax highlighting de JSON. Beneficio: refactor seguro y autocompletado.

## Decisiones tomadas

- **Un solo archivo** `edge-cases.fixtures.ts` exportando un array. Más simple que múltiples archivos. Si crece a 50+, se puede romper en categorías.
- **`expected` completo** (no parcial). El test compara la estructura entera con `toEqual`. Si el engine emite un campo extra, el test falla con un diff útil.
- **IDs estables y descriptivos** (`01-grupo-empate-acertado`). Permiten referenciar un caso desde un PR o issue.
- **Sanity check separado**: `expect(EDGE_CASE_FIXTURES.length).toBeGreaterThanOrEqual(15)`. Si alguien borra fixtures sin querer, el test cae.
- **No solapamos con engine.test.ts**: aunque hay overlap conceptual, los fixtures son **datos** legibles, los tests del engine son **caminos del código**. Los dos juegos viven en paz.
