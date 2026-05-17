# Infraestructura — ArenaCup26

Diagrama operativo de los servicios que componen la app en
producción (Railway, proyecto `artistic-cooperation`) y por qué
existe cada uno.

## 1. Vista de pájaro

```
┌──────────────────────────────────────────────────────────────┐
│  Railway · project: artistic-cooperation                     │
│                                                              │
│   ┌─────────┐                                                │
│   │  wmundial│ ──── HTTP :8080 + Bearer ──┐                  │
│   │  (Next)  │                            ▼                  │
│   │          │                       ┌──────────────────┐    │
│   │          │ ──── TCP :5432 ───┐   │ luggapugga/      │    │
│   │          │                   │   │ serverless-redis │    │
│   │          │                   │   └────────┬─────────┘    │
│   └──────────┘                   │            │ TCP :6379    │
│        │                         ▼            ▼              │
│        │                  ┌──────────┐  ┌──────────┐         │
│        │ HTTPS public     │ Postgres │  │  Redis   │         │
│        │                  └──────────┘  └──────────┘         │
│        ▼                                                     │
│  wmundial-production.up.railway.app                          │
└──────────────────────────────────────────────────────────────┘
                  ▲                            ▲
                  │                            │
                  │ users                      │ POST /api/cron/sync-fixtures
                  │                            │   (Authorization: Bearer)
              navegador             GitHub Actions */180min
                                    api-football.com (HTTPS)
```

## 2. Inventario de servicios

### 2.1 `wmundial` (Next.js)

- **ID**: `495c818a-853f-4d49-8f4a-cb148910e844`.
- **Imagen**: build desde `main` del repo `webmundial`.
- **Puerto público**: 8080 expuesto como `wmundial-production.up.railway.app`.
- **Pre-deploy command**: `npm run db:migrate && npm run bootstrap`. Aplica migraciones drizzle pendientes y siembra catálogo de logros + 7 placeholder users.
- **Health**: implícito por respuesta de `/`.
- **Env vars relevantes**: `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `AUTH_URL=https://wmundial-production.up.railway.app`, `GOOGLE_CLIENT_ID/SECRET`, `DATABASE_URL` (referencia), `API_FOOTBALL_KEY`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Ver `docs/security.md` §1.

### 2.2 `Postgres`

- **ID**: `dccae26e-cf3f-422d-b52b-bb628327b668`.
- **Para qué**: source of truth de datos persistentes (users, predicciones, matches, point_events, etc.).
- **Dominio interno**: `postgres.railway.internal:5432`.
- **Acceso externo**: ninguno. Solo accesible desde dentro del proyecto Railway.
- **Cliente en el código**: drizzle-orm + postgres-js (`src/server/db/client.ts`).

### 2.3 `Redis` (key-value en memoria)

- **ID**: `5a58b48f-76c8-42c0-b7d7-a011cafb129a`.
- **Para qué**: backend del rate-limiting. Cuenta cuántas requests ha hecho cada user/IP en una ventana móvil (60s típicamente), expira solo, no consume disco.
- **Dominio interno**: `redis.railway.internal:6379`.
- **Acceso externo**: ninguno.
- **Por qué Redis y no Postgres**: la app pregunta "¿cuántas requests lleva user X en los últimos 60s?" decenas de veces por segundo en pico. Redis devuelve respuestas sub-milisegundo desde RAM; hacerlo contra Postgres saturaría la BD principal sin necesidad para datos efímeros.

### 2.4 `luggapugga/serverless-redis:latest` (adapter HTTP)

- **ID**: `6c8ff7da-4149-4b97-8461-e02e832b9506`.
- **Imagen**: `ghcr.io/luggapugga/serverless-redis:latest`.
- **Para qué**: traduce HTTP ↔ Redis TCP. Expone Redis como una API REST compatible con el SDK `@upstash/redis`. Acepta requests con `Authorization: Bearer <SR_TOKEN>`.
- **Puerto interno**: 8080.
- **Dominio interno**: `luggapuggaserverless-redislatest.railway.internal:8080`.
- **Acceso externo**: ninguno.
- **Por qué un adapter** y no Redis directo:
  1. El SDK `@upstash/redis` solo habla HTTP (no TCP). Es la opción estándar en el ecosistema serverless por simplicidad — sin necesidad de pools de conexiones TCP en cada función edge.
  2. La auth por Bearer es trivial vs. configurar TLS + ACLs en Redis nativo.
  3. Si en el futuro queremos migrar a Upstash externo (Pro plan, multirregión, etc.), solo cambiamos las dos env vars `UPSTASH_REDIS_REST_URL/TOKEN`. Cero cambio en código.

## 3. Flujos críticos

### 3.1 Predicción de un user

```
[browser] ──POST /partidos/123─→ [wmundial] ──submitPrediction()
                                       │
                                       ├─→ checkSubmitLimit(userId)
                                       │       ↓
                                       │   [adapter] ──INCR rl:submit:userId──→ [Redis]
                                       │       ↓
                                       │   ok / rate_limited
                                       │
                                       ├─→ INSERT predictions ──→ [Postgres]
                                       │
                                       └─→ createNotification → INSERT notifications
```

Latencia esperada: ~5ms el rate-limit, ~20ms el insert Postgres.

### 3.2 Cron de sync-fixtures

```
[GitHub Actions] ──cron */180m──→ POST /api/cron/sync-fixtures
                                  Authorization: Bearer <CRON_SECRET>
                                            ↓
                                      [wmundial]
                                  ├─ verify bearer
                                  ├─ checkCronLimit(IP) [adapter+Redis]
                                  ├─ GET /fixtures?date=… × N días [api-football]
                                  ├─ reconcileMatch + upsertTeams [Postgres]
                                  └─ onMatchFinished → processFinishedMatch
                                         ├─ scoring engine (pure)
                                         ├─ persistScore [Postgres]
                                         └─ evaluateAndUnlock (logros)
```

### 3.3 Visita a `/ranking`

```
[browser] ──GET /ranking──→ [wmundial]
                            ├─ auth() (Auth.js JWT)
                            ├─ getRealSnapshot(db) [Postgres SELECT con LEFT JOIN]
                            └─ render SSR
```

(El rate-limit `publicRead` y `signup` aún no están wireados — pendiente
de las tasks 8 y 9 de `add-rate-limiting`.)

## 4. Costes mensuales aproximados

Plan Railway Hobby = $5/mes incluidos.

| Servicio | Consumo idle | Notas |
| -------- | ------------ | ----- |
| `wmundial` | ~200 MB RAM | Picos al sync (`+50 MB`) |
| `Postgres` | ~60 MB RAM + 100 MB disco | Crece con `point_events` (~1 row/predicción/usuario) |
| `Redis` | ~20 MB RAM | Constante, no persiste a disco |
| `luggapugga/serverless-redis` | ~30 MB RAM | Stateless |
| **Total** | ~310 MB RAM + 100 MB disco | Cabe en los $5 |

Cuando crezca a >1000 users activos diarios, evaluar `Pro plan` ($20/mes) o downsizar el adapter (puede stop+start on-demand si Redis acepta TCP directo + cambiamos el SDK).

## 5. Defensas operativas

- **Redis cae**: `rate-limit.ts` política fail-open → permite todas las requests. App sigue funcionando sin protección hasta que vuelva.
- **Postgres cae**: cualquier query falla → 500 en la página. Pre-deploy command de Railway abortaría futuros deploys hasta que vuelva.
- **adapter cae**: rate-limit fail-open igual que Redis caído.
- **api-football cae**: el cron emite `provider_failed` con código `network_error`. App sigue OK pero los partidos no se actualizan hasta que vuelva.
- **wmundial cae**: Railway lo reinicia automáticamente (restart policy ON_FAILURE).

## 6. Cómo añadir un servicio nuevo

1. Decidir si encaja como servicio aparte o si va al wmundial existente. Regla: si tiene estado propio que no debe perderse al reiniciar wmundial, va aparte.
2. Vía Railway dashboard o vía MCP:
   ```
   create_service { source_image: "..." }
   set_variables  { ... }
   ```
3. Documentar aquí: ID, imagen, puerto, dominio interno, qué env vars de wmundial lo referencian.
4. Añadir al cyber-audit (`docs/security.md` §8) si tiene superficie de ataque.
