# add-bot-users — Bots que pueblan el ranking durante el Mundial

> **Status**: análisis cerrado 2026-05-19. Pendiente luz verde para
> implementación. Estimación: ~1 día de trabajo bien hecho.

## Why

Día 1 del Mundial 2026 abrimos al público con un puñado de usuarios
reales — entre amigos beta-testers y first-movers, quizá 5-20. Con un
ranking de 5 entradas:

- Visualmente parece **abandonado**. La página `/ranking` muestra un
  podio de 3 y al cuarto ya hay placeholder.
- Los logros se vuelven **triviales**: `top-100` con 5 users es
  garantizado; `king-of-the-moment` lo gana el primero que acierte
  una predicción.
- No hay **competencia perceptible**. Un user nuevo no siente que
  "supere" a nadie cuando sube — porque arriba no había nadie.

Hoy parcheamos esto con 7 placeholders fijos
(`seedLeaderboardPlaceholders`: Carlos, Layla, Tomás…) con puntos
hardcoded. Funciona como tapa cosmética pero NO tienen historial real,
no aparecen en `/u/<username>` con stats, no desbloquean logros, y un
user que entre a su perfil ve datos invertados.

## What changes

Reemplazamos los 7 placeholders cosméticos por **27 "bots"**:
usuarios reales en la base de datos con todas las mecánicas del
producto, pero cuya única diferencia con un humano es que **no
reaccionan a interacciones**. Predicen toda la fase de grupos al
inicio del Mundial y luego "mueren" — los users reales pueden
superarles a medida que avanzan octavos, cuartos, etc.

### Modelo de datos

Una columna nueva en `users`:

```sql
ALTER TABLE users ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX users_is_bot_idx ON users(is_bot) WHERE is_bot = true;
```

Solo para uso INTERNO. **Nunca** se expone en API pública ni se
muestra en UI — un user real no debe distinguir un bot de un humano.

### Catálogo de bots (27)

Hardcoded en `src/server/bots/catalog.ts`. Cada entry tiene:

- `username` (kebab-case, único): `carlos-mendoza`, `layla-haddad`,
  etc. Patrón mismo que los placeholders actuales.
- `name`: nombre humano plausible.
- `country`: ISO2. Distribuidos por país (Spain, Mexico, USA, Brazil,
  Argentina, France, Germany, UK, Morocco, Japan, etc).
- `avatarId`: uno de los 4 SVG actuales (champion/duel/podium/oracle).
  Distribución equilibrada (~6-7 bots por avatar).
- `style`: `"simple"` | `"mixed"` | `"daredevil"`. Determina cómo
  predicen.
- `createdAtOffset`: días en el pasado, para que su `created_at`
  esté escalonado en las últimas 4-6 semanas.

### Personalidades de predicción

Cada bot tiene un `style` que afecta qué tipo de predicciones lanza
al sincronizarse la fase de grupos:

| Style       | % del catálogo | Comportamiento                                                                                         | Hits esperados (de 48) |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- |
| `simple`    | ~70% (≈19)     | Solo 1X2. Distribución random uniforme {home, draw, away}.                                             | ~16 (33%)              |
| `mixed`     | ~20% (≈5)      | 80% simple, 20% exacto. Marcadores razonables (0-0, 1-0, 1-1, 2-1).                                    | ~13 + 1-2 exactos      |
| `daredevil` | ~10% (≈3)      | 30% simple, 70% exacto random extremo. Si aciertan pico de puntos, casi siempre fallan exactos altos.  | ~5 + maybe 0-2 exactos |

Esto distribuye los bots naturalmente por el ranking: la mayoría
agrupados en el medio, algunos por arriba (suerte con exactos), pocos
"famosos por arriesgar". Sin esto todos quedan idénticos y el ranking
sale artificialmente plano.

### Cuándo predicen

**Una sola vez**, al activarse manualmente vía script o cron tras
sincronizar la fase de grupos completa (48 partidos) desde
api-football. Despues de eso, los bots no hacen nada — no predicen
octavos/cuartos/etc porque esos dependen de los ganadores y serían
predicciones tardías sospechosas.

El script `scripts/seed-bot-predictions.ts`:
1. Lee todos los `matches` con `stage='group'` y `status != 'finished'`.
2. Para cada bot × cada match, genera una predicción aleatoria según
   su `style`.
3. Inserta filas en `predictions` con `created_at` escalonado en el
   día actual ±30 min (no todas exact al mismo timestamp).
4. Idempotente: si ya existe `(userId, matchId)` no duplica.

Cuando `processFinishedMatch` se dispare por cada partido,
automáticamente scorea las predicciones de los bots junto con las de
los users reales. Sus `point_events`, `user_points`, achievements,
streaks se generan exactamente como cualquier humano.

### Comportamiento "no responde"

Los bots existen en `users` y aceptan recibir inputs pero:

- **Friend requests**: quedan `pending`. Un cron diario opcional
  `auto-reject-bot-friend-requests` las marca `rejected` tras 48h
  para limpiar la bandeja del solicitante. Si no lo añadimos, los
  requests viven en pending forever — la UI lo gestiona OK.
- **Group invitations**: idem. Auto-reject opcional tras 48h.
- **Notificaciones in-app**: les llegan filas a `notifications`, sin
  problema. Nadie las lee porque nadie loguea como bot.
- **Push notifications**: NO. Bots no tienen `push_subscriptions` →
  `notifyWithPush` no envía nada (subscriptions.length === 0).
- **Login**: el campo `email` de cada bot debe existir (constraint
  UNIQUE no nullable). Usamos `<username>@bots.arenacup26.com` —
  emails sintéticos que nunca se usan. Auth.js no los reconoce porque
  no hay fila en `accounts` con providerAccountId Google.

### Migration desde placeholders

Los 7 placeholders actuales (`carlos-mendoza`, `layla-haddad`,
`tomas-ferreira`, …) ya son usuarios reales en BD con puntos
hardcoded. Los migramos:

1. `UPDATE users SET is_bot = true WHERE id IN (<los 7>);`
2. Borramos sus puntos hardcoded del `user_points` (los recalculará
   el sistema real basado en sus predicciones).
3. El catálogo de bots los incluye como los primeros 7 + 20 nuevos.
4. `seedLeaderboardPlaceholders` se borra (función + import).

### UI / DX

**Nada cambia visualmente para el user**. Los bots se renderizan
como cualquier user en:
- `/ranking` (filas normales con avatar SVG, bandera, puntos).
- `/u/<username>` (perfil completo con stats, historial,
  achievements).
- Ranking de grupos (si un bot quedara en el global, no aparecen en
  rankings de grupos privados porque no son miembros).
- Friend search por `@username`.
- Top del momento de `/inicio`.

Internamente añadimos pequeños hooks:
- `getRealUserCount()`: helper que filtra `is_bot = false` para
  métricas honestas en `/status` y futuras analytics.
- `bots/queries.ts`: helpers `listBots()`, `isBotUserId()` para
  scripts/admin.

## Decisiones cerradas

- **Total de bots**: 27. No redondo, suficiente para poblar pero no
  para aplastar a un grupo de 50 users reales (la mediana del bot
  queda ~150 puntos vs user activo ~300).
- **`is_bot` flag**: sí, indexado parcial. Necesario para métricas
  internas. NUNCA expuesto en API.
- **Predicciones una sola vez**: solo fase de grupos al inicio. Tras
  ahí los bots se "mueren" — su rank se erosiona conforme avanza el
  torneo. Esto es feature, no bug.
- **Auto-reject de friend/group requests**: opcional, 48h, default
  ON. Si vemos en QA que la UI de "pending" eternal es OK,
  podemos desactivarlo.
- **Email sintético**: `<username>@bots.arenacup26.com`. No registra
  MX records → los emails se hardencodean en BD pero nunca salen.
- **Trasparencia**: NO se le dice al user que existen bots. Patrón
  estándar de cold-start en plataformas similares. Si un user
  descubre y pregunta, asumimos respuesta honesta (no negarlo en un
  blog post).
- **Avatares**: cada bot usa un SVG de la galería actual
  (champion/duel/podium/oracle). Distribución equilibrada.
- **Cooldowns de nombre/avatar**: bots no editan nada, irrelevante.
- **Achievements**: los bots los desbloquean naturalmente cuando se
  scoran sus predicciones. El gate `ACHIEVEMENTS_MIN_FINISHED_MATCHES`
  les aplica igual que a humanos (caen tras 5 partidos finished).

## Impact

### Riesgos

- **Confianza** (medio): si un user descubre los bots puede sentirse
  engañado. Mitigación: nombres plausibles + distribución de
  predicciones realista (no dominan el top-3 ininterrumpidamente).
- **Trust en grupos** (bajo): bots NO entran en grupos → ranking
  privado entre amigos no contamina.
- **Métricas falsas** (mitigado): con `is_bot` flag podemos filtrar
  en cualquier query analítica.

### Beneficios

- Ranking poblado desde el día 1 (visualmente vivo).
- Logros con peso real (`top-100` significa algo cuando hay 30+ users).
- Erosión natural: bots "mueren" tras fase de grupos, users reales
  les superan como progresión orgánica.
- Cero código paralelo: bots reusan TODA la infra (scoring, ranking,
  achievements, perfil público).

## Open items para validar antes de empezar

- [ ] **Confirmar lista de países** para distribuir los 27 bots —
      ¿queremos representar todas las regiones del Mundial o
      sesgamos a Latam/Europa que es el audience principal?
- [ ] **Confirmar el `style` mix** (70/20/10) — ¿más conservador
      (90/8/2) para que el ranking no tenga picos? ¿O más arriesgado
      (50/30/20) para tener bots interesantes en el podio?
- [ ] **Auto-reject de friend/group requests**: ¿lo lanzamos cron o
      dejamos pending y vemos QA?
- [ ] **Migración de placeholders**: ¿migramos los 7 actuales como
      bots y añadimos 20 más, o nuking todo y empezamos limpio con 27?
