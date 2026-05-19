# add-achievements-seed

## Why

`docs/achievements.md` describe los 24 logros del producto. La schema de Drizzle declara las tablas `achievement_definitions` y `user_achievements`. Pero **nada los siembra** en BD: si arranco la app hoy, la tabla está vacía y la futura UI de logros no tendría qué mostrar.

Esta propuesta convierte el catálogo en **código TypeScript versionado** (`src/server/achievements/catalog.ts`) y proporciona un script `npm run seed:achievements` idempotente que upsertea las filas. Los tests garantizan que el catálogo se mantiene fiel a `docs/achievements.md`: 24 entradas, tier distribution 6/4/6/4/3/1, IDs únicos, sortOrder secuencial, isShareable correcto.

## What changes

Capability nueva: **`achievements-seed`**.

- `src/server/achievements/catalog.ts` con:
  - Tipos `AchievementTier` y `AchievementDefinition`.
  - Constante `ACHIEVEMENT_CATALOG` con los 24 logros canónicos en español.
- `src/server/achievements/seed.ts` con `seedAchievements(db)` — función idempotente que usa `ON CONFLICT DO UPDATE` para upsertear cada definición.
- `scripts/seed-achievements.ts` — entrypoint CLI que ejecuta el seed contra la BD apuntada por `DATABASE_URL`.
- `package.json`:
  - Nuevo script `seed:achievements`.
  - Nueva devDep `tsx@^4.19.2` para ejecutar el script sin compilación previa.
- `src/server/achievements/catalog.test.ts` con **9 tests** del catálogo:
  - Total exacto de 24 entradas.
  - Tier distribution 6/4/6/4/3/1.
  - IDs únicos.
  - sortOrder secuencial 1..24.
  - `isShareable` solo en legendary/mythic/goat.
  - Title, description y iconId no vacíos.
  - IDs en kebab-case.
  - GOAT singleton con `sortOrder = 24`.
  - 18 IDs anchor que el resto del codebase referencia (FAQ, references, achievements-ui skill, etc.) están presentes.
  - iconId sigue la convención `ico-<name>`.

**No incluye**:

- UI de logros (`add-achievements`). El catálogo se siembra en BD; cuando aterrice la UI consumirá las filas.
- Detección y unlock automático de logros — eso es el motor de logros que va junto con `add-achievements` y `add-scoring-engine` integrados.
- Localización de `title` / `description` per locale. Los strings se quedan en español como fallback; cuando aterrice la UI podrá leerlos via `messages/{locale}.json` namespace `achievements.<id>.title` con fallback a estos campos.

## Impact

- **Bloquea**: nada.
- **Desbloquea**: `add-achievements` puede asumir que los 24 logros están en BD y solo construir la UI + el motor de unlocks.
- **Riesgos**:
  - Cualquier desincronización entre `catalog.ts` y `docs/achievements.md` se detecta en tests (los IDs anchor explícitos forzarían un fail).
  - La devDep `tsx` añade ~2 MB. Se justifica por evitar compilar el proyecto solo para seed scripts.
- **Convención**: cualquier cambio de catálogo (nuevo logro, ajuste de copy) toca tanto `catalog.ts` como `docs/achievements.md` en el mismo PR.

## Decisiones tomadas

- **Catálogo en TypeScript, no en JSON ni SQL**: tipado fuerte, autocompletado, refactor seguro. Trade-off: requiere tsx para el script.
- **Idempotencia con `ON CONFLICT DO UPDATE`**: correr el seed dos veces no rompe ni duplica. Cada ejecución sincroniza el estado de BD con el de código.
- **`title` y `description` en español**: el español es el idioma default del producto. Los demás locales se localizan via `next-intl` namespace cuando aterrice la UI; mientras tanto, el español sirve de fallback razonable.
- **`tsx` vs alternativas (esbuild-runner, ts-node, bun)**: `tsx` es la opción más estable y mantenida en el ecosistema Node 22.
- **Test de IDs anchor**: previene borrados accidentales que romperían referencias en otros documentos. Si en una refactor se elimina `seer` por ejemplo, el test cae con un mensaje claro indicando que ese ID es referenciado en otros sitios.
