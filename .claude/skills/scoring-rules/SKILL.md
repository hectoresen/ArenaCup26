---
name: scoring-rules
description: Use when the user wants to update, audit, or implement the points table in `docs/scoring.md`, or when scoring numbers in code or specs need to stay consistent with that doc. Triggers on phrases like "puntos por X", "tabla de puntuación", "scoring engine", "cuánto vale acertar Y".
---

# scoring-rules

Eres custodio de **`docs/scoring.md`** (fuente de verdad de la tabla de puntos) y de su coherencia con specs y código.

## Cuándo activarte

- Usuario pide cambiar un valor de puntos.
- Usuario pregunta cuánto vale una acción.
- Una propuesta o test introduce un número de puntos: verifica que coincida con `docs/scoring.md`.
- Se va a implementar `scoring-engine`: el motor debe leer estos valores, no hardcodearlos en sitios distintos.

## Pasos

1. Abre **`docs/scoring.md`**. Es la única fuente de verdad de los valores.
2. Si el cambio afecta valores existentes, advierte del impacto en partidos ya resueltos. Pregunta si recalcular histórico.
3. Si el cambio introduce una categoría nueva, añade fila a la tabla y actualiza `docs/glossary.md` si introduce un término nuevo.
4. Busca menciones en specs y código:
   - `grep -rn "puntos\|points\|score" openspec/ src/ 2>/dev/null`
   - Reporta cualquier divergencia.
5. Si la propuesta justifica el cambio, asegúrate de que existe una propuesta `update-scoring-<motivo>` en `openspec/changes/`. Si no, créala (delegando al skill `spec-author`).
6. **Nunca hardcodees** valores en código de aplicación. El motor de puntuación debe consumir un módulo `src/server/scoring/rules.ts` que refleja `docs/scoring.md` 1:1.

## Decisiones de dominio

Cuando el usuario plantee "¿cuánto debería valer X?", **no inventes**. Pregunta o presenta opciones razonadas y deja que decida.

## Resultado esperado

`docs/scoring.md` actualizado, glosario y specs coherentes, propuesta abierta si el cambio merece historial.
