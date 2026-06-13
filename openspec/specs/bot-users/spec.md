# bot-users — Spec

> Contrato de la capability `bots`. Promueve a `openspec/specs/bots/`
> al aterrizar.

## Modelo

- **Bot**: fila en `users` con `is_bot = true`. Identidad completa
  (username, name, country, avatarId) + email sintético no usable.
- **Style**: `"simple" | "mixed" | "daredevil"`. Determina cómo el
  bot predice partidos. NO se persiste en BD — vive en el catálogo
  hardcoded.
- **Catálogo**: 27 bots fijos en `src/server/bots/catalog.ts`.

## Invariantes

1. **`is_bot` flag nunca expuesto en API pública.** Ningún endpoint,
   server action, ni componente puede leak este campo.
2. **Bots no inician sesión.** Sin email real → sin Google OAuth → sin
   `accounts` row → Auth.js rechaza el login. Defense in depth.
3. **Bots no crean ni se unen a grupos.** El catálogo no incluye
   `groupMemberships` para bots. Si alguna lógica futura tratara de
   inscribirlos, sería un bug.
4. **Bots no reciben push.** Sin `push_subscriptions` → `notifyWithPush`
   no envía nada al endpoint VAPID.
5. **Predicciones de bot son inmutables tras seed.** Una vez sembradas,
   nunca se editan ni se borran (igual que un humano que ya bloqueó
   su predicción tras kickoff).
6. **Scoring de bots es idéntico al de humanos.** Mismas reglas, mismo
   `processFinishedMatch`, mismas tablas (`point_events`, `user_points`).
7. **Achievements de bots se desbloquean igual.** Gate
   `ACHIEVEMENTS_MIN_FINISHED_MATCHES` aplica. Sin bypass.

## Contracts

### `is_bot` column

```sql
ALTER TABLE users ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX users_is_bot_idx ON users(is_bot) WHERE is_bot = true;
```

### `BotDefinition` type

```typescript
export type BotStyle = "simple" | "mixed" | "daredevil";

export type BotDefinition = {
  username: string;       // kebab-case, único.
  name: string;           // human display name.
  country: string;        // ISO-2.
  avatarId: string;       // uno de los SVG en /public/avatars.
  style: BotStyle;
  createdAtOffsetDays: number; // 0-42 días en el pasado.
};
```

### `generatePrediction` (pure)

```typescript
function generatePrediction(
  style: BotStyle,
  match: { homeTeamId: string; awayTeamId: string },
  random: () => number, // Inyectable para tests con seed.
): {
  outcome: "home" | "draw" | "away";
  homeScore?: number;  // Solo si el bot decide hacer exacto.
  awayScore?: number;
};
```

Pure function. Tests deterministic con `seedrandom`. Distribuciones
documentadas en proposal.md tabla.

### `seedBotUsers`

```typescript
async function seedBotUsers(db: Database): Promise<{
  created: number;
  updated: number;
}>;
```

Idempotente. Upsert por username. Sin push subscriptions, sin
`account` rows.

### `seedBotPredictions`

```typescript
async function seedBotPredictions(db: Database): Promise<{
  predictionsCreated: number;
  matchesScanned: number;
  botsProcessed: number;
}>;
```

Idempotente. Solo para partidos `stage='group' AND status != 'finished'`.
Skipa los `(botId, matchId)` que ya tienen predicción. Ejecutable
SOLO cuando `process.env.SEED_BOT_PREDICTIONS === "true"`.

### `auto-reject-bot-requests` cron

`GET /api/cron/auto-reject-bot-requests?secret=<CRON_SECRET>`

Marca como `rejected` (en `friendships` y `group_invitations`):
- Filas con `status='pending'`.
- Destinatario con `is_bot=true`.
- Antigüedad > 48h.

Idempotente. No afecta a requests entre humanos.

## Tests requeridos

- Catálogo: 27 entries, usernames únicos, suma de `style` = 27.
- `generatePrediction`: distribución por style coincide con tabla
  del proposal (50k runs).
- `seedBotUsers`: idempotente (segundo run produce updated, no created).
- `seedBotPredictions`: idempotente, solo crea para matches sin
  predicción previa.
- `auto-reject` endpoint: marca pending → rejected solo para bots,
  no toca requests entre humanos.

## NO contract (cosas que explícitamente NO hacemos)

- **No exponemos `is_bot` en API.** Ningún select en queries públicas
  lo incluye. El user no sabe que un user concreto es bot.
- **No mostramos UI especial para bots.** Mismo avatar, mismo perfil,
  mismo ranking row.
- **No documentamos públicamente la existencia de bots.** El producto
  no anuncia "ranking con bots durante cold-start". Si un user
  descubre y pregunta, asumimos respuesta honesta — no la negamos
  pero tampoco la promocionamos.
- **No replicamos bots a otros entornos.** En `NODE_ENV=development`
  los devs ven los mismos bots que prod. En `NODE_ENV=test` el seed
  NO corre (no contaminamos suites de testing).
