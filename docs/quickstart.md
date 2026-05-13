# Quickstart — WebMundial 26 en local

Esta guía levanta el proyecto en una máquina nueva en ~5 minutos. Sigue los pasos en orden.

## 1. Requisitos

- **Node.js 22+** (`node --version` debe empezar por `v22`).
- **Docker** y **docker compose** (para Postgres).
- **pnpm** opcional; los comandos abajo usan `npm` por defecto.
- Una cuenta de Google con acceso a [Google Cloud Console](https://console.cloud.google.com/) para crear las credenciales OAuth.
- (Opcional) Una API key gratuita de [api-football.com](https://dashboard.api-football.com/register) si quieres validar el cron de sync contra datos reales.

## 2. Clonar e instalar

```bash
git clone <repo-url> webmundial
cd webmundial
npm install
```

## 3. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y rellena las claves obligatorias:

```dotenv
# Auth.js — genera un secret con: openssl rand -base64 48
AUTH_SECRET=<48+ chars>

# Google OAuth — pasos abajo para obtenerlos
GOOGLE_CLIENT_ID=<...apps.googleusercontent.com>
GOOGLE_CLIENT_SECRET=<...>

# Postgres local (los valores por defecto del docker-compose)
DATABASE_URL=postgres://wmundial:wmundial@localhost:5432/wmundial

# API-Football (opcional; sin esto el cron de sync devolverá 500)
API_FOOTBALL_KEY=
```

### 3.1 Google OAuth credentials

1. Ve a https://console.cloud.google.com/apis/credentials.
2. Crea un proyecto nuevo si no tienes uno.
3. **Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
6. Copia `Client ID` y `Client secret` al `.env`.

## 4. Levantar Postgres

```bash
docker compose up -d
```

Esto arranca Postgres 16 en `localhost:5432` con credenciales `wmundial / wmundial`. Verifica que está sano:

```bash
docker compose ps
# wmundial-postgres   ...   running (healthy)
```

## 5. Aplicar el schema

Hay dos opciones; elige una:

```bash
# Opción A — migraciones versionadas (recomendado para casos reales)
npm run db:migrate

# Opción B — push directo del schema actual (más rápido para dev local)
npm run db:push
```

Ambas dejan la BD lista con las 14 tablas del modelo.

## 6. Seeds

```bash
# Catálogo de 24 logros (idempotente: puede correr varias veces sin daño)
npm run seed:achievements

# Equipos y partidos de Qatar 2022 (idempotente, hace truncate antes)
npm run seed:wc2022
```

> **Nota**: el seed `wc2022` deja los `kickoffAt` en sus fechas reales de 2022. Como el dashboard filtra `kickoffAt > now()`, la sección **Próximos partidos** aparecerá vacía hasta que tengamos `add-fixture-seed-wc2026` o ajustes manuales (sección 9.1 abajo).

## 7. Arrancar el frontal

```bash
npm run dev
# ▲ Next.js 15.x   - Local: http://localhost:3000
```

## 8. Probar la app

1. Abre `http://localhost:3000/` → landing pública con leaderboard (mock).
2. Pulsa **Predecir ahora** → modal Google.
3. Tras autenticar, vuelves al sitio. Navega a `http://localhost:3000/inicio`.
4. Deberías ver:
   - Top-nav fijo con tabs Inicio/Partidos/Ranking/Logros + avatar dorado + bell.
   - Hero personalizado: `Hola, <Tu nombre> 👋`.
   - Subtítulo "Empieza tu primera predicción" (porque aún no tienes puntos).
   - Sección **Próximo partido** vacía si el seed es WC 2022; verás el `Próximos partidos` igual vacío.
   - **Tu progreso** con `0 / 24` logros y `—` en posición.
   - **Top del momento** vacío (nadie ha puntuado todavía).

> Si quieres ver un usuario con puntos, inserta datos a mano en `user_points`, o espera a `add-prediction-flow` que cerrará el ciclo.

## 9. Trucos para ver datos reales

### 9.1 Adelantar los kickoffs de WC 2022 al futuro

```bash
docker compose exec postgres psql -U wmundial -d wmundial -c \
  "UPDATE matches SET kickoff_at = kickoff_at + interval '4 years' WHERE kickoff_at < now();"
```

Esto reescribe los 24 partidos de Qatar 2022 desplazándolos 4 años; ahora caen en 2026 y la sección **Próximos partidos** se llena.

### 9.2 Probar el cron de sync (API-Football real)

Con `API_FOOTBALL_KEY` en `.env`:

```bash
# En dev sin CRON_SECRET aceptamos cualquier POST a localhost.
curl -X POST http://localhost:3000/api/cron/sync-fixtures | jq
```

Sin la key responde `500 provider_not_configured`. Con la key sincroniza la temporada configurada en `.env` (`MATCH_DATA_LEAGUE_ID`/`MATCH_DATA_SEASON`).

> El plan free de api-football solo permite seasons 2022–2024. Para testear, pon `MATCH_DATA_SEASON=2022`.

## 10. Tests y validaciones

```bash
npm test          # 376 tests offline (vitest run)
npm run typecheck # tsc --noEmit
npm run check     # biome lint + format
npm run build     # next build (verifica que las rutas compilan)
```

Para incluir el test de integración real con la API:

```bash
API_FOOTBALL_KEY=<tu_key> npm test
```

## 11. Drizzle Studio (UI de BD)

```bash
npm run db:studio
# → https://local.drizzle.studio
```

Útil para inspeccionar `users`, `matches`, `predictions`, etc. sin SQL a mano.

## 12. Troubleshooting

| Síntoma | Causa probable | Fix |
| --- | --- | --- |
| `Invalid environment variables` al arrancar | Falta una key obligatoria en `.env`. | Revisa que `AUTH_SECRET`, `GOOGLE_CLIENT_*`, `DATABASE_URL` están rellenos. |
| `redirect_uri_mismatch` en Google | La URL del callback no está autorizada. | Añade `http://localhost:3000/api/auth/callback/google` en Google Cloud Console → OAuth client → Authorized redirect URIs. |
| `ECONNREFUSED 5432` | Postgres no está levantado. | `docker compose up -d`. |
| `UntrustedHost` de Auth.js | Auth no confía en `localhost`. | En dev se confía automáticamente; si te aparece en prod, exporta `AUTH_TRUST_HOST=true`. |
| Banderas (🇲🇽, 🇦🇷) no se ven en Windows/WSL | El SO no incluye los pares de Regional Indicator. | El proyecto carga Noto Color Emoji como fallback en `<head>`; refresca con caché limpia. |
| `npm test` rompe con `"4.820"` esperado y recibe `"4820"` | Build de Node con `small-icu`. | Ya cubierto por `formatPointsEs` (ver `docs/decisions.md` §10). Si pasa, abre issue. |
| `db:migrate` falla con "relation already exists" | El schema fue creado antes con `db:push`. | Borra la BD: `docker compose down -v && docker compose up -d` y vuelve a empezar desde el paso 5. |

## 13. Resetear todo (nuke local)

```bash
docker compose down -v   # borra el volumen → BD vacía
docker compose up -d
npm run db:push
npm run seed:achievements
npm run seed:wc2022
```

## 14. Qué sigue funcionando hoy / qué no

**Funciona:**

- `/` — landing pública con leaderboard mock (no BD).
- `/inicio` — panel del usuario (BD real, pero sin puntos hasta `add-prediction-flow`).
- `/faq` — preguntas frecuentes.
- Login con Google.
- Sync de partidos vía `POST /api/cron/sync-fixtures` (necesita API-Football).
- 376/377 tests pasando.

**Aún no implementado (capabilities futuras):**

- `/partidos`, `/ranking`, `/logros` — los tabs del nav apuntan a estas rutas, pero devuelven 404.
- Flujo de submit/edit de predicción (`add-prediction-flow`).
- Recálculo automático de puntos cuando un partido cambia (`add-scoring-pipeline`).
- Refresco en tiempo real del panel (`add-leaderboard-sse`).
- Histórico de ranking para sparkline + delta (`add-ranking-history`).
- Goles parciales durante el live (`add-live-scoring`).

Más contexto en `docs/decisions.md` (dosier de decisiones técnicas) y en `openspec/changes/` (propuestas abiertas).
