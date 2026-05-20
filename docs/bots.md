# Bots — usuarios sintéticos para poblar el ranking

> Propuesta `add-bot-users`. Spec en
> [`openspec/changes/add-bot-users/`](../openspec/changes/add-bot-users/).
> ADR en [`decisions.md`](decisions.md).

## Qué son

Un **bot** es una fila en la tabla `users` con la columna
`is_bot = true`. Funcionalmente es indistinguible de un usuario real
en cualquier vista pública: tiene username, nombre, país, avatar,
predicciones, puntos, rachas, achievements, perfil completo en
`/u/<username>`.

La única diferencia es **interna**:

- No tiene email real. Su `email` es `<username>@bots.arenacup26.com`
  — no resuelve DNS, no responde Google OAuth, nadie puede loguear
  como él.
- No reacciona a interacciones de otros users. Friend requests y
  group invitations quedan pending; un cron diario las auto-rechaza
  a las 48h para limpiar la bandeja del solicitante.
- No tiene `push_subscriptions` → no le llega Web Push aunque le
  inserten notificaciones in-app.
- No se le aplica el cooldown de nombre/avatar — no edita nada.

## Por qué existen

Cold-start del ranking. Día 1 del Mundial 2026 podemos abrir con
~5-20 usuarios reales. Con tan pocos:

- El ranking parece abandonado: 3 posiciones en el podio y al cuarto
  ya hay placeholder.
- Logros como `top-100`, `king-of-the-moment`, `runner-up` se vuelven
  triviales: cualquiera que acierte una predicción los gana.
- No hay sensación de progresión: un user nuevo no siente que
  "supera" a nadie cuando sube — porque arriba no había nadie.

27 bots resuelven esto sin código paralelo: comparten toda la
infraestructura (scoring, ranking, achievements, perfil público).

## Cómo funcionan

1. **Seed inicial** (deploy del producto): se crean 27 filas en
   `users` con identidad completa (username, nombre, país, avatar SVG,
   `created_at` escalonado las últimas 4-6 semanas, `is_bot=true`).
   Idempotente — re-correr no duplica.

2. **Seed de predicciones** (manual antes del Mundial):
   `SEED_BOT_PREDICTIONS=true` activa el script
   `scripts/seed-bot-predictions.ts`. Para cada bot × cada partido
   de fase de grupos (`stage='group'` AND `status != 'finished'`),
   genera una predicción aleatoria según el `style` del bot:

   | Style       | Bots | Comportamiento                                      | Hits esperados (de 48) |
   | ----------- | ---- | --------------------------------------------------- | ---------------------- |
   | `simple`    | ~19  | Solo 1X2 uniforme.                                  | ~16 (33%)              |
   | `mixed`     | ~5   | 80% 1X2 + 20% exacto plausible (0-0 a 3-2).         | ~13 + 1-2 exactos      |
   | `daredevil` | ~3   | 30% 1X2 + 70% exacto extremo (0-0 a 5-3).           | ~5 + maybe 0-2 exactos |

   Las predicciones tienen `created_at` distribuido ±30 min del
   momento del script — no todas exactas al mismo segundo, para que
   un user que inspeccione el perfil de un bot no vea "27 users
   predijeron 48 partidos al mismo segundo".

3. **Scoring**: cuando `processFinishedMatch` corre tras cada
   partido finalizado, scorea predicciones de bots y de humanos
   sin distinguirlas. Inserta filas en `point_events`, actualiza
   `user_points`, evalúa achievements. Para los bots no hay
   notificaciones push (no tienen subscriptions) pero sí hay
   notificaciones in-app (filas en `notifications` que nadie lee).

4. **"Mueren" en octavos**: los bots solo predicen fase de grupos.
   Cuando comience la fase de eliminación (round of 16, cuartos,
   semis, final) los bots quedan estáticos — no añaden nuevas
   predicciones. Sus puntos quedan congelados al final de la fase
   de grupos. Los usuarios reales seguirán prediciendo y
   acumulando puntos, superando a los bots de forma orgánica.

## Catálogo

`src/server/bots/catalog.ts` con 27 entries. Cada uno:

- **username**: kebab-case único, e.g. `carlos-mendoza`.
- **name**: nombre humano plausible.
- **country**: ISO-2. Distribuidos por región (Latam, Europa, África,
  Asia, Norteamérica) para representar el alcance global del Mundial.
- **avatarId**: uno de los 4 SVG (`champion`, `duel`, `podium`,
  `oracle`). Distribución ~6-7 bots por avatar.
- **style**: `simple` | `mixed` | `daredevil` según tabla anterior.
- **createdAtOffsetDays**: 0-42 días en el pasado para escalonar el
  registro.

Los 7 placeholders previos (`carlos-mendoza`, `layla-haddad`,
`tomas-ferreira`, ...) se migran a este catálogo como los primeros 7
bots (mismo username + `is_bot=true` + recálculo real de sus puntos).
Después de eso, `seedLeaderboardPlaceholders` se elimina del codebase.

## Reglas de negocio

- **Bots no entran en grupos privados**. El catálogo no inscribe
  bots en ninguna `group_memberships`. Si una lógica futura
  intentara, es un bug.
- **Bots no inician sesión nunca**. Defense in depth: sin
  `accounts` row + email sintético + sin password = no hay vía.
- **Friend requests a bots**: quedan `pending`. Cron diario
  `auto-reject-bot-requests` las marca `rejected` a las 48h. Sin
  cron, viven pending indefinidamente — la UI lo gestiona OK pero
  la bandeja del solicitante se ensucia.
- **Group invitations a bots**: idem.
- **Push a bots**: jamás. `notifyWithPush` short-circuita cuando
  `getUserPushSubscriptions(botId)` devuelve `[]`.
- **`is_bot` NUNCA en API**. Ningún select público lo incluye. Es
  flag interno para métricas y operativa.

## Bots "live" — puntito verde durante fase de grupos

Cinco bots del catálogo (`LIVE_BOT_USERNAMES` en
`src/server/bots/presence.ts`) tienen su `last_active_at` refrescado
diariamente para que aparezcan con el indicador "online" (puntito
verde) en el ranking global, en grupos, en `/inicio` y en el perfil
público. Sin esto el ranking se sentiría desierto en cold-start —
ningún bot dispara el dot porque ninguno navega la app.

- **Quiénes**: `diego-martinez` (AR), `sofia-ramirez` (MX),
  `felix-hartmann` (DE), `yuki-tanaka` (JP), `omar-benali` (MA).
  Diversidad regional intencional.
- **Cuándo se refresca**: el cron diario
  `auto-reject-bot-requests` (03:30 UTC) hace piggy-back llamando a
  `refreshLiveBotPresence`. También se ejecuta tras cada
  `seedBotUsers` para que un fresh seed deje los bots verdes desde el
  segundo cero.
- **Hasta cuándo**: `LIVE_BOTS_END_DATE = 2026-07-04T00:00:00Z`.
  Pasado el cierre de la fase de grupos, el cron deja de refrescar y
  los bots caen a "offline" 24h después de forma natural. Si quieres
  extender, mueve la constante en código (no hay migration).
- **Side effect**: cualquier consulta `getRealSnapshot`,
  `getMiniLeaderboard`, `getFriendsRanking` o `getGroupRanking` ya
  consume el `lastActiveAt` actualizado — no hay que tocar las
  superficies UI.

## Comportamiento esperado en el ranking

- Con 27 bots y ~30 hits promedio cada uno (varía por style),
  durante fase de grupos el ranking se ve poblado con
  distribución natural: pocos en podio, mayoría en medio, algunos
  abajo.
- En octavos en adelante, los bots dejan de añadir puntos. Su rank
  desciende relativamente cada vez que un user real acierta. Para
  cuando lleguemos a semifinales, los users reales activos
  deberían estar mayormente por encima de los bots.
- En final, los bots probablemente estén en el último tercio del
  top 100, sin distorsionar el ranking real.

## Privacidad y trust

- **No anunciamos públicamente** que hay bots. Es un patrón
  estándar de cold-start. Si un user pregunta directamente,
  asumimos respuesta honesta — no negar.
- Los bots **no tienen datos personales reales** (email sintético,
  todos los demás campos son del catálogo hardcoded). No hay
  riesgo RGPD.

## Cleanup post-Mundial

Tras la final del Mundial, los bots se mantienen como histórico —
quedan en el ranking final con la posición que les corresponde
(probablemente baja). No se borran. Esto preserva la integridad
del ranking histórico ("¿quién quedó top 10 del Mundial 2026?").

Si quisiéramos cleanup absoluto: `DELETE FROM users WHERE
is_bot = true` cascadea a todas las tablas (predictions,
point_events, achievements, etc) por las foreign keys ON DELETE
CASCADE. Pero no recomendamos hacerlo — los bots son parte del
histórico.

## Tests

- `src/server/bots/catalog.test.ts`: cardinalidad (27 entries),
  usernames únicos, mix de styles correcto.
- `src/server/bots/predict.test.ts`: distribución por style
  validada con seed fijo en 50k runs.
- `src/server/bots/seed.test.ts`: idempotencia del seed.
- `e2e/bots-smoke.spec.ts` (opcional): verifica que un user real
  puede abrir `/u/carlos-mendoza`, ver su perfil completo, enviarle
  friend request (que queda pending).

## Operación

### Deploy inicial (post-merge `add-bot-users`)

Cuando el commit con el feature llega a `main`, Railway:

1. Aplica `drizzle/0014_awesome_champions.sql` (añade `is_bot` column + index).
2. Ejecuta `npm run bootstrap`, que:
   - Migra/borra los 7 placeholders viejos (cascade limpia sus
     predictions/point_events).
   - Siembra los 27 bots del catálogo con `seedBotUsers`.
   - **NO** siembra predicciones todavía (gated por
     `SEED_BOT_PREDICTIONS=true`).

Verificar en Railway logs algo similar a:

```
✓ Achievements ready (25 rows reconciled).
✓ Removed 7 legacy placeholder user(s).
✓ Bots reconciled — created=27, updated=0.
→ Skipping bot predictions seed (set SEED_BOT_PREDICTIONS=true to run).
```

A partir de aquí los 27 bots aparecen en `/ranking` y son
navegables vía `/u/<username>` con perfiles vacíos (0 pts, sin
predicciones todavía).

### Setup secrets GitHub Actions (una vez)

Para que el cron `auto-reject-bot-requests` corra a las 03:30 UTC:

1. `Settings → Secrets and variables → Actions` en el repo.
2. Añadir el secret:
   - `RAILWAY_AUTO_REJECT_URL` =
     `https://www.arenacup26.com/api/cron/auto-reject-bot-requests`
3. Reusar el `CRON_SECRET` ya existente (mismo valor que en Railway).

### Lanzar predicciones de bots antes del Mundial

Una sola vez, ~24h antes del kickoff (≈10 jun 2026):

**Opción A** — env var temporal en Railway:

1. Railway → Service `wmundial` → Variables → añadir
   `SEED_BOT_PREDICTIONS=true`.
2. Trigger redeploy (push commit vacío o "Redeploy" en UI).
3. Verificar logs:
   ```
   → Bootstrap: seeding bot predictions (SEED_BOT_PREDICTIONS=true)…
   ✓ Bot predictions — created=1296, matches=48, bots=27.
   ```
4. Quitar `SEED_BOT_PREDICTIONS` de Railway (no la necesitamos más
   — el seed es idempotente, pero correrla cada deploy es ruido).

**Opción B** — manual via `railway run`:

```bash
railway run --service wmundial \
  SEED_BOT_PREDICTIONS=true \
  npm run bootstrap
```

Esto corre el bootstrap completo dentro del shell del service sin
necesidad de redeploy.

### Verificar el seed visualmente

Tras seedear predicciones:

- `/ranking` con sesión: 27 entradas, podio ocupado por bots
  (puntos en 0 hasta el primer partido scoreado).
- `/u/diego-martinez` (cualquier bot): perfil completo con avatar
  SVG, 48 predicciones en su historial.
- Bot recibe friend request enviada por un user real: queda
  `pending` hasta que el cron auto-reject la limpia ≥48h después.

### Verificar conteo real vs total

```sql
SELECT
  COUNT(*) FILTER (WHERE is_bot = false) AS real_users,
  COUNT(*) FILTER (WHERE is_bot = true)  AS bots,
  COUNT(*) AS total
FROM users;
```

Helpers TypeScript equivalentes en
`src/server/bots/metrics.ts`:
- `getRealUserCount(db)` — solo humanos.
- `getOnboardedRealUserCount(db)` — humanos con wizard completado.
- `getBotCount(db)` — debería ser 27.

### Disable temporal del cron de auto-reject

Si vemos un problema con el cron, comentar el `cron:` schedule en
`.github/workflows/auto-reject-bot-requests.yml` y push. Sin él
los requests dirigidos a bots quedan `pending` indefinidamente —
la UI lo gestiona OK pero la bandeja del solicitante se ensucia.

### Re-correr el seed sin tocar predicciones

```bash
# Re-aplica nombres/avatares/style del catálogo a las filas
# existentes en BD. Idempotente. Útil tras editar el catálogo.
railway run --service wmundial npm run bootstrap
```

`SEED_BOT_PREDICTIONS=true` solo se setea cuando explícitamente
quieras sembrar predicciones (no se hace por defecto).

### Resetear el estado completo de bots (peligroso)

Si el catálogo cambia masivamente y quieres empezar limpio:

```sql
-- En Railway → DB → Query:
DELETE FROM users WHERE is_bot = true;
-- Cascade limpia: predictions, point_events, user_points,
-- user_achievements, notifications, friendships, group_*, etc.
```

Después `npm run bootstrap` los re-siembra. **Pierde todo el
historial de bots** — solo hacerlo si los nuevos bots no tienen
nada que ver con los viejos.

## Trasparencia del flag `is_bot`

**`is_bot` NUNCA se filtra a la API pública**. Verificación
manual (recomendado tras cada cambio en `src/server/`):

```bash
# Cualquier `select` que toque users debe ser select({...}) con
# columnas explícitas, NO select() (asterisco).
grep -rnE "from\(users\)" src/server src/app --include="*.ts" | \
  grep -v "/bots/\|test"
# Verificar: ninguna usa select() sin columnas.
```

Si en el futuro alguien introduce un `select().from(users)` en una
ruta pública, este flag se expondrá — convención: SIEMPRE usar
`select({ id: users.id, name: users.name, ... })` con columnas
explícitas.
