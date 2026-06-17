# Purpose

Sembrar el catálogo de los 28 logros de ArenaCup26 en `achievement_definitions` desde un módulo TypeScript versionado, fiel a `docs/achievements.md`. Idempotente: re-correr el seed tras un cambio en código sincroniza la BD sin duplicados.

# Requirements

## Requirement 1: Catálogo canónico con 28 entradas

`ACHIEVEMENT_CATALOG` exporta exactamente 28 logros, distribuidos por tier según `docs/achievements.md`.

### Scenario: Conteo total

- **Given** el módulo `src/server/achievements/catalog.ts`
- **When** se importa `ACHIEVEMENT_CATALOG`
- **Then** el array tiene `length === 28`.

### Scenario: Distribución por tier

- **Given** el catálogo
- **When** se cuentan las entradas por `tier`
- **Then** la distribución es: `common = 6`, `rare = 4`, `epic = 6`, `legendary = 4`, `mythic = 3`, `goat = 1`.

## Requirement 2: Identificadores únicos en kebab-case

Cada logro tiene un `id` único, en kebab-case, que sirve como clave primaria en BD y como anchor en docs externos.

### Scenario: Unicidad

- **Given** el array completo
- **When** se construye un Set con todos los `id`
- **Then** el tamaño del Set es 24.

### Scenario: Formato kebab-case

- **Given** cualquier logro
- **When** se valida su `id`
- **Then** matchea `^[a-z]+(-[a-z]+)*$`.

## Requirement 3: Reglas de shareability

`isShareable` es `true` exactamente para los tiers legendary, mythic y goat.

### Scenario: Tier legendary

- **Given** un logro de tier `legendary`
- **When** se inspecciona
- **Then** `isShareable === true`.

### Scenario: Tier common

- **Given** un logro de tier `common`
- **When** se inspecciona
- **Then** `isShareable === false`.

## Requirement 4: Seed idempotente

`seedAchievements(db)` upsertea cada definición. Re-correr el seed tras cambios en `catalog.ts` actualiza filas; nunca duplica.

### Scenario: Primera ejecución sobre BD vacía

- **Given** la tabla `achievement_definitions` vacía
- **When** se ejecuta `seedAchievements(db)`
- **Then** la tabla contiene 24 filas idénticas al catálogo.

### Scenario: Segunda ejecución idempotente

- **Given** la tabla ya con 24 filas
- **When** se vuelve a ejecutar `seedAchievements(db)`
- **Then** sigue teniendo 24 filas, ningún duplicado, los campos coinciden con el catálogo (cualquier ajuste local en `catalog.ts` se propaga via `ON CONFLICT DO UPDATE`).

### Scenario: Update tras cambio de copy

- **Given** un logro con `description = "vieja descripción"` en BD y `description = "nueva descripción"` en código
- **When** se ejecuta el seed
- **Then** la fila se actualiza a la nueva descripción.

## Requirement 5: Anchors estables

Un set de IDs está documentado en otros archivos del repo (FAQ, references, skills). Si alguno desaparece del catálogo, los tests caen con mensaje explícito.

### Scenario: Borrado accidental

- **Given** que un developer borra `seer` del catálogo en una refactor
- **When** se ejecutan los tests
- **Then** el test `includes specific anchor IDs that the rest of the codebase references` falla con `expected … to contain 'seer'`. El developer debe restaurarlo o actualizar las referencias en `docs/`.

## Requirement 6: Comando CLI

`npm run seed:achievements` ejecuta `scripts/seed-achievements.ts` vía `tsx`.

### Scenario: Run con Postgres disponible

- **Given** Postgres corriendo en `DATABASE_URL`
- **When** se ejecuta `npm run seed:achievements`
- **Then** el script imprime "Seeding achievement_definitions…" → "✓ Upserted 24 achievements." y `process.exit(0)`.

### Scenario: Run sin Postgres

- **Given** Postgres no accesible
- **When** se ejecuta el script
- **Then** falla con error de conexión, imprime "[wmundial] seed:achievements failed:" y `process.exit(1)`.
