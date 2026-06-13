# Tasks — add-bot-users

## 1 · Schema + migration

- [ ] Añadir columna `is_bot BOOLEAN NOT NULL DEFAULT false` a `users`
      en `src/server/db/schema.ts`.
- [ ] Index parcial `users_is_bot_idx ON users(is_bot) WHERE is_bot = true`
      (acelera filtros internos sin penalizar reads de users reales).
- [ ] Generar migration con `drizzle-kit generate`. Revisar SQL.
- [ ] Aplicar localmente con `db:migrate`, verificar shape.

## 2 · Catálogo de bots

- [ ] `src/server/bots/catalog.ts`: array de 27 entries con
      `{ username, name, country, avatarId, style, createdAtOffset }`.
- [ ] Distribución: ~70% simple, ~20% mixed, ~10% daredevil.
- [ ] Distribución de países: balanceada (Latam, Europa, África, Asia,
      Norteamérica).
- [ ] Distribución de avatares: ~6-7 bots por SVG.
- [ ] Tests del catálogo: 27 entries, usernames únicos, suma de
      `style` = 27.

## 3 · Predicción engine

- [ ] `src/server/bots/predict.ts`: pure function
      `generatePrediction(style, match) → PredictionInput`. Aleatoria
      según style. Tests con seed fijo para reproducibilidad.
- [ ] Style `simple`: 1X2 uniforme.
- [ ] Style `mixed`: 80% simple + 20% exacto (marcadores de 0-0 a 3-2).
- [ ] Style `daredevil`: 30% simple + 70% exacto random (0-0 a 5-3).
- [ ] Tests unitarios con `seedrandom` para validar la distribución.

## 4 · Seed script

- [ ] `scripts/seed-bot-users.ts`: idempotente. Crea/actualiza los
      27 users con `is_bot=true`. Email sintético
      `<username>@bots.arenacup26.com`. `created_at` escalonado en
      las últimas 4-6 semanas (deterministic por offset).
- [ ] `scripts/seed-bot-predictions.ts`: idempotente. Para cada bot ×
      cada match `stage='group' AND status != 'finished'`, genera
      predicción según `style`. `created_at` en ventana ±30 min del
      momento del script.
- [ ] Output: `→ Created/updated N bots`, `→ Generated K predictions
      for M matches`.

## 5 · Bootstrap wiring

- [ ] Añadir `seedBotUsers` y opcional `seedBotPredictions` al
      `scripts/bootstrap.ts` (post-deploy).
- [ ] Decisión: `seedBotPredictions` corre solo si
      `process.env.SEED_BOT_PREDICTIONS === 'true'` (manual trigger
      antes del Mundial, no en cada deploy).
- [ ] Borrar la función `seedLeaderboardPlaceholders` y su import (los
      7 placeholders se reemplazan por las primeras 7 entries del
      catálogo de bots).

## 6 · Auto-reject cron

- [ ] `.github/workflows/auto-reject-bot-requests.yml`: diario,
      llama a `/api/cron/auto-reject-bot-requests`.
- [ ] Endpoint `src/app/api/cron/auto-reject-bot-requests/route.ts`:
      gated por `CRON_SECRET`, marca como `rejected` cualquier
      `friend_request` o `group_invitation` con `status='pending'` +
      destinatario `is_bot=true` + `created_at > 48h`.
- [ ] Tests del endpoint (idempotente, no afecta a requests entre
      humanos).

## 7 · Server-side helpers

- [ ] `src/server/bots/queries.ts`: `listBots(db)`, `isBotUserId(db, userId)`.
- [ ] `getRealUserCount(db)`: helper para futuras métricas (filtra
      `is_bot = false`).
- [ ] Tests.

## 8 · Migration de placeholders (one-shot)

- [ ] Script `scripts/migrate-placeholders-to-bots.ts` (idempotente):
      `UPDATE users SET is_bot=true WHERE id IN (<7 placeholders>);`.
      Borra hardcoded `user_points` de los 7 (lo recalculará el
      scoring real). Ejecutado UNA VEZ post-deploy.
- [ ] O alternativa: drop completo de los 7 + new 27. **Decisión
      pendiente en el proposal (Open items)**.

## 9 · UI verificación (sin código nuevo)

- [ ] Probar visualmente en local con bots seedeados que los SVG
      avatars renderizan en `/ranking`, `/u/<username>`, `/inicio`.
- [ ] Verificar que los bots aparecen en friend search por
      `@username`.
- [ ] Verificar que un friend request enviado a un bot queda pending
      hasta que el cron auto-rechaza (o forever si no activamos cron).
- [ ] Verificar que el bot NO recibe push (no tiene
      `push_subscriptions`).

## 10 · Tests + Docs

- [ ] Tests del catálogo (cardinalidad, unicidad, mix).
- [ ] Tests del predict engine (distribución por seed fija).
- [ ] Tests del endpoint auto-reject.
- [ ] `docs/bots.md`: spec final público. Conceptos, decisiones,
      catálogo, cómo funciona.
- [ ] `docs/README.md`: añadir entry a "Producto y dominio".
- [ ] `docs/architecture.md`: nueva capability `bots`.
- [ ] `docs/business-rules.md`: sección "Bots / cold-start" con
      reglas de comportamiento.
- [ ] `docs/decisions.md`: ADR 14.18 "Bots para poblar cold-start
      del Mundial".
- [ ] `docs/data-pipeline.md`: bootstrap mencionará `seedBotUsers`.
- [ ] `docs/roadmap.md`: bloque I (o sumar a bloque H).

## 11 · Rollout

- [ ] Merge a main → bootstrap reconcilia 27 bots + migra
      placeholders.
- [ ] Antes del kickoff del Mundial (~10 jun 2026):
      1. Verificar que api-football tiene todos los 48 partidos de
         fase de grupos.
      2. Ejecutar `SEED_BOT_PREDICTIONS=true npm run bootstrap` o
         lanzar el script manualmente.
      3. Verificar en `/ranking`: ~27 entradas, podio ocupado.
      4. Verificar en `/u/carlos-mendoza`: perfil completo con 48
         predicciones, points = 0 (aún no scoreado).
- [ ] Día 1 del Mundial:
      1. Primeros partidos terminan → `processFinishedMatch` scorea
         predicciones de bots + humanos.
      2. Ranking sube/baja naturalmente.
      3. Achievements se desbloquean cuando el gate cae (≥5 matches
         finished).
