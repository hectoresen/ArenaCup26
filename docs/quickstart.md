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

## 6. Fixtures de dev

Un único comando deja la BD con todo lo necesario para que el panel se vea con datos:

```bash
npm run fixtures
```

Esto ejecuta en orden:

1. **Catálogo de 24 logros** (idempotente: `ON CONFLICT DO UPDATE`).
2. **32 equipos + 24 partidos** del Mundial Qatar 2022 (truncate + insert).
3. **Shift de fechas**: adelanta todos los kickoffs para que el primero caiga `now() + 6h` (manteniendo el espaciado original) **y los resetea a `status = 'scheduled'`** (el seed los pone como `finished` porque son históricos). Sin este reset, `/inicio` no muestra próximos partidos.

Idempotente: lanzarlo dos veces vuelve a sembrar (la 3ª llamada del script no encuentra matches `< now()` y solo refresca logros).

> **Importante**: esto es solo para validar diseño y navegación. La lógica real de predicciones, rankings y puntuación se probará contra `/api/cron/sync-fixtures` apuntando a `api-football` (sección 9.2) o, más adelante, contra `add-fixture-seed-wc2026` cuando aterrice.

## 7. Arrancar el frontal

```bash
npm run dev
# ▲ Next.js 15.x   - Local: http://localhost:3000
```

> En **dev mode** la primera navegación a cada ruta es lenta (Next compila bajo demanda). La segunda visita a la misma URL va instantánea. En producción (`next build && next start`) no hay este coste — todo está pre-compilado.

## 8. Probar la app

1. Abre `http://localhost:3000/` → landing pública con leaderboard.
2. Pulsa **Predecir ahora** → modal Google.
3. Tras autenticar, te llevan directamente a `/inicio`.
4. Deberías ver:
   - Top-nav fijo con tabs Inicio/Partidos/Ranking/Logros + avatar dorado + bell.
   - Hero personalizado: `Hola, <Tu nombre> 👋`.
   - Sección **Próximo partido** con la primera card del Mundial 2022 (con fechas desplazadas).
   - Sección **Próximos partidos** con las siguientes 5 cards.
   - **Tu progreso** con `0 / 24` logros y `—` en posición.
   - **Top del momento** vacío (nadie ha puntuado todavía).
5. Click en el avatar → **Mi perfil** → `/u/<tu-username>`.
6. Click en **Ranking** del nav → mismo leaderboard del público dentro del shell.

## 9. Trucos para datos más realistas

Los `fixtures` cubren la fase de "ver cómo se ve el diseño". Para probar la **lógica real** (predicciones, ranking, puntuación) hay que sincronizar contra una API real:

### 9.1 Forzar un partido en vivo

```bash
npm run dev:set-live                       # 1-0 al primer match futuro
HOME_SCORE=2 AWAY_SCORE=1 npm run dev:set-live   # marcador custom
```

Tras esto, `/inicio` muestra la sección **En vivo ahora** con el marcador en lugar de **Próximo partido**.

### 9.2 Sincronizar manualmente con API-Football real

> **No hay cron automático**. El backend NO sondea a la API en bucle. Cuando quieras refrescar partidos con datos reales, dispara el endpoint manualmente:

```bash
curl -X POST http://localhost:3000/api/cron/sync-fixtures | jq
```

En dev sin `CRON_SECRET` configurado se acepta cualquier POST a localhost. Sin `API_FOOTBALL_KEY` responde `500 provider_not_configured`. Con la key sincroniza la temporada configurada en `.env` (`MATCH_DATA_LEAGUE_ID`/`MATCH_DATA_SEASON`). Cada llamada consume 1 request del cupo diario (100 en el free tier).

> El plan free de api-football solo permite seasons 2022–2024. Para testear, pon `MATCH_DATA_SEASON=2022`.

**Arquitectura real cuando aterrice `add-leaderboard-sse`**:
- Backend ↔ API-Football: pull manual o cron a medida (no Vercel Cron automático).
- Backend ↔ navegador: push vía Server-Sent Events. El usuario nunca espera datos.

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
| `Invalid environment variables` al correr `npm run fixtures` | `.env` no se está leyendo desde el script. | El script ya pasa `--env-file=.env` a `tsx`. Si lo ves, asegúrate de estar en la raíz del repo (donde vive `.env`) cuando lances el comando. |
| `redirect_uri_mismatch` en Google | La URL del callback no está autorizada. | Añade `http://localhost:3000/api/auth/callback/google` en Google Cloud Console → OAuth client → Authorized redirect URIs. |
| `ECONNREFUSED 5432` | Postgres no está levantado. | `docker compose up -d`. |
| `UntrustedHost` de Auth.js | Auth no confía en `localhost`. | En dev se confía automáticamente; si te aparece en prod, exporta `AUTH_TRUST_HOST=true`. |
| Banderas (🇲🇽, 🇦🇷) no se ven en Windows/WSL | El SO no incluye los pares de Regional Indicator. | El proyecto carga Noto Color Emoji como fallback en `<head>`; refresca con caché limpia. |
| `npm test` rompe con `"4.820"` esperado y recibe `"4820"` | Build de Node con `small-icu`. | Ya cubierto por `formatPointsEs` (ver `docs/decisions.md` §10). Si pasa, abre issue. |
| `db:migrate` falla con "relation already exists" | El schema fue creado antes con `db:push`. | Borra la BD: `docker compose down -v && docker compose up -d` y vuelve a empezar desde el paso 5. |
| `Could not find the module ... in the React Client Manifest` o `Cannot find module './XXX.js'` en tiempo de dev | El cache de Next 15 (`.next/`) quedó desincronizado tras un cambio en caliente. Pasa típicamente al añadir rutas nuevas o cambiar callbacks de Auth.js sin reiniciar. | Para el dev server (Ctrl+C), `rm -rf .next`, `npm run dev`. |

## 13. Resetear todo (nuke local)

```bash
docker compose down -v   # borra el volumen → BD vacía
docker compose up -d
npm run db:push
npm run fixtures
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

- `/partidos`, `/logros` — placeholder con "próximamente" y link de vuelta al panel.
- Flujo de submit/edit de predicción (`add-prediction-flow`).
- Recálculo automático de puntos cuando un partido cambia (`add-scoring-pipeline`).
- Refresco en tiempo real del panel (`add-leaderboard-sse`).
- Histórico de ranking para sparkline + delta (`add-ranking-history`).
- Goles parciales durante el live (`add-live-scoring`).

Más contexto en `docs/decisions.md` (dosier de decisiones técnicas) y en `openspec/changes/` (propuestas abiertas).
