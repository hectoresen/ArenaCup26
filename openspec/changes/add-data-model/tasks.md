# Tasks — add-data-model

- [ ] 1. Validación de variables de entorno con Zod en `src/lib/env.ts`.
- [ ] 2. Schema Drizzle completo en `src/server/db/schema.ts` con tablas, enums y relaciones.
- [ ] 3. Cliente Drizzle (`postgres-js`) en `src/server/db/client.ts`.
- [ ] 4. Configuración drizzle-kit en `drizzle.config.ts`.
- [ ] 5. Stub de Auth.js v5 en `src/lib/auth.ts` referenciando las tablas de auth (sin callbacks de UI; eso es de `add-auth-google`).
- [ ] 6. Ejecutar `pnpm db:generate` para crear la migración inicial en `drizzle/`.
- [ ] 7. Smoke test Vitest: importar `schema` y comprobar que compila sin errores de tipos.
- [ ] 8. Promover `specs/data-model/spec.md` a `openspec/specs/data-model/spec.md`.
- [ ] 9. Mover propuesta a `openspec/changes/archive/YYYY-MM-DD-add-data-model/`.
