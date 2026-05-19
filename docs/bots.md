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

### Lanzar predicciones de bots antes del Mundial

```bash
# En Railway, una sola vez ~24h antes del kickoff:
SEED_BOT_PREDICTIONS=true npm run bootstrap
```

Verificar:
- `/ranking`: 27+ entradas, podio ocupado.
- `/u/<bot-username>`: perfil completo con 48 predicciones, puntos 0
  (todavía no se han jugado partidos).

### Disable temporal del cron de auto-reject

Si vemos algún problema, comentar el job en
`.github/workflows/auto-reject-bot-requests.yml`. Sin él los requests
quedan pending forever — la UI lo gestiona OK.

### Verificar conteo real vs total

```sql
SELECT
  COUNT(*) FILTER (WHERE is_bot = false) AS real_users,
  COUNT(*) FILTER (WHERE is_bot = true)  AS bots,
  COUNT(*) AS total
FROM users;
```
