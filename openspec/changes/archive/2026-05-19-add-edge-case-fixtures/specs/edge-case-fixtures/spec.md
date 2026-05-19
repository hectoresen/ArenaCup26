# Purpose

Mantener un set de fixtures TypeScript que documenten y verifiquen los escenarios edge del scoring engine. Cada fixture es un objeto con un partido de muestra, una predicción y la racha previa, junto con el `ScoreResult` esperado. Un test runner los pasa todos por el engine y verifica el resultado.

# Requirements

## Requirement 1: Set inicial cubre 4 categorías

El array `EDGE_CASE_FIXTURES` incluye fixtures de cuatro grupos: grupos, eliminatoria, estados anulados y combos/racha.

### Scenario: Cobertura mínima

- **Given** el array `EDGE_CASE_FIXTURES`
- **When** se inspecciona
- **Then** contiene al menos un fixture de stage `group`, al menos uno de stage de eliminatoria, al menos uno de cada `expected.kind` (`simple`, `exact`, `double`, `miss`, `voided`) y al menos uno con `comboBonuses` no vacío.

## Requirement 2: Cada fixture tiene un id único

`id` es la clave primaria. Permite referenciar un caso desde un PR o issue.

### Scenario: IDs únicos

- **Given** el array de fixtures
- **When** se construye un Set con los IDs
- **Then** el tamaño del Set es igual al length del array.

## Requirement 3: El runner verifica el ScoreResult exacto

Cada fixture pasa por `scoreMatchPrediction(match, prediction, streakBefore)` y el resultado se compara con `expected` en su totalidad (no parcial).

### Scenario: Comparación con `toEqual`

- **Given** un fixture
- **When** el runner lo ejecuta
- **Then** `expect(result).toEqual(fixture.expected)` — incluye `points`, `kind`, `streakAfter` y `comboBonuses` completo.

### Scenario: Fixture con bonus de combo

- **Given** el fixture `15-combo-hito-10-base-con-exacto`
- **When** el runner lo ejecuta
- **Then** el resultado es `{ points: 80, kind: "exact", streakAfter: { current: 10, containsDouble: false }, comboBonuses: [{ milestone: 10, points: 50 }] }`.

## Requirement 4: Cualquier cambio en reglas detecta drift en fixtures

Si una constante de `rules.ts` cambia o el engine cambia su comportamiento, los fixtures que documentan ese comportamiento fallan con un diff descriptivo.

### Scenario: Cambio de POINTS.simple a 12

- **Given** el set de fixtures actual
- **When** un developer cambia `POINTS.simple` de 10 a 12 en `rules.ts`
- **Then** los fixtures que esperan 10 puntos en simple acertado fallan con diff `expected 10 received 12`. La intención del cambio queda explícita y el developer debe actualizar los fixtures conscientemente.

## Requirement 5: Fixtures como documentación

Cada fixture incluye una `description` legible que explica el escenario en una frase.

### Scenario: Lectura por non-dev

- **Given** un product manager que abre `edge-cases.fixtures.ts`
- **When** lee el `id` y la `description` de un fixture
- **Then** entiende qué escenario representa sin tener que decodificar el TypeScript.
