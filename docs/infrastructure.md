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
- **Env vars relevantes**: `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `AUTH_URL=https://wmundial-production.up.railway.app`, `GOOGLE_CLIENT_ID/SECRET`, `DATABASE_URL` (referencia), `API_FOOTBALL_KEY`, `CRON_SECRET`. Ver `docs/security.md` §1.

### 2.2 `Postgres`

- **ID**: `dccae26e-cf3f-422d-b52b-bb628327b668`.
- **Para qué**: source of truth de datos persistentes (users, predicciones, matches, point_events, etc.).
- **Dominio interno**: `postgres.railway.internal:5432`.
- **Acceso externo**: ninguno. Solo accesible desde dentro del proyecto Railway.
- **Cliente en el código**: drizzle-orm + postgres-js (`src/server/db/client.ts`).

### 2.3 ~~`Redis` + adapter HTTP~~ (retirado 2026-05-20)

Los servicios `Redis` (ID `5a58b48f-76c8-42c0-b7d7-a011cafb129a`) y
`luggapugga/serverless-redis:latest` (ID
`6c8ff7da-4149-4b97-8461-e02e832b9506`) **siguen existiendo en
Railway pero la app ya no los consume**. Originalmente eran el backend
del rate-limit y del pub/sub del ranking; el adapter HTTP demostró ser
frágil (cuelgues silenciosos del proxy `*.railway.internal`) y se
migró a:

- Rate-limit → in-memory en Node (ver `docs/security.md §7`).
- Pub/sub del ranking → ticker periódico cada 15 s en el SSE.

**Se pueden desmantelar de Railway sin riesgo**. Para hacerlo:
`railway service delete luggapugga/serverless-redis:latest` y luego
`Redis`. Liberan slot pero no aportan nada vivo. Pendiente
operacional, no urgente.

## 3. Flujos críticos

### 3.1 Predicción de un user

```
[browser] ──POST /partidos/123─→ [wmundial] ──submitPrediction()
                                       │
                                       ├─→ checkSubmitLimit(userId) [in-memory Map]
                                       │       ↓ ok / rate_limited
                                       │
                                       ├─→ INSERT predictions ──→ [Postgres]
                                       │
                                       └─→ createNotification → INSERT notifications
```

Latencia esperada: <1ms el rate-limit (in-memory), ~20ms el insert Postgres.

### 3.2 Cron de sync-fixtures

```
[GitHub Actions] ──cron */180m──→ POST /api/cron/sync-fixtures
                                  Authorization: Bearer <CRON_SECRET>
                                            ↓
                                      [wmundial]
                                  ├─ verify bearer
                                  ├─ checkCronLimit(IP) [in-memory Map]
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
