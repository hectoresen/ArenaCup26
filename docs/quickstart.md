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
# Opción A — push directo del schema actual (más rápido para dev local)
npm run db:push

# Opción B — migraciones versionadas (lo que corre Railway en deploy)
npm run db:migrate
```

Ambas dejan la BD lista con las 14 tablas del modelo. En local da igual cuál uses; **en Railway solo `db:migrate`** porque Railway lo lanza solo en el pre-deploy (ver `docs/deployment.md` §6).

## 6. Inicializar referencia estática (achievements)

```bash
npm run bootstrap
```

Solo siembra el catálogo de 24 logros. Idempotente. **No hay datos demo de partidos** — los partidos vienen del sync real con api-football (sección 9.2). En Railway esto pasa solo en el pre-deploy; aquí lo lanzas a mano la primera vez.

> Datos dinámicos (teams, matches) los sembraremos llamando al endpoint de sync. Si te falta API_FOOTBALL_KEY, simplemente la app queda con BD vacía: el dashboard mostrará "Empieza tu primera predicción" y `/partidos` estará vacío hasta que sincronices.

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
7. Click en **Partidos** del nav → listado completo agrupado por día con cards (live, scheduled, finished, postponed, cancelled, TBD).
8. Click en cualquier card → `/partidos/<id>` con detalle y formulario de predicción (simple / exacto / doble — el tipo permitido depende de la etapa).
9. Tras enviar tu primera predicción, abre la campana del top-nav → **dropdown con la notificación "Predicción enviada"** que enlaza al partido. Al abrir el dropdown, todas las pendientes se marcan como leídas y el badge desaparece.

## 9. Llenar la BD con partidos reales

### 9.1 Sincronizar con api-football

Llama el endpoint del propio servidor para que vaya a traer partidos:

```bash
curl -X POST http://localhost:3000/api/cron/sync-fixtures
```

Comportamiento por defecto (`MATCH_DATA_MODE=date-window`):
1. Calcula la ventana de días: hoy − `MATCH_DATA_BEFORE_DAYS` (default 1) … hoy + `MATCH_DATA_AFTER_DAYS` (default 7).
2. Hace 1 request `GET /fixtures?date=YYYY-MM-DD` por cada día de la ventana (9 con la config default).
3. Si `MATCH_DATA_LEAGUE_FILTER` está definido (CSV de IDs de liga), filtra localmente.
4. Por cada team del provider desconocido, lo upserta sobre la marcha en `teams` + `team_external_ids` derivando el código del nombre.
5. Mete los fixtures en `matches`. Idempotente: 2ª llamada con la misma BD = 0 inserciones, solo updates.

Sin `CRON_SECRET` en local, cualquier POST se acepta.

> Plan free de api-football: el filtro `?league=X&season=Y` solo cubre seasons 2022-2024. Por eso el default va con `date-window`, que sí funciona en seasons actuales. Si tienes plan Pro y quieres volver al modo histórico, set `MATCH_DATA_MODE=season` + `MATCH_DATA_LEAGUE_ID/SEASON`.

### 9.2 Forzar un partido en vivo (sin esperar a uno real)

```bash
npm run dev:set-live                       # 1-0 al primer match futuro
HOME_SCORE=2 AWAY_SCORE=1 npm run dev:set-live   # marcador custom
```

Tras esto, `/inicio` muestra la sección **En vivo ahora** con el marcador + puntos provisionales en lugar de **Próximo partido**.

### 9.3 Automatizar el sync (opcional, recomendado para Railway)

En producción no haces curl a mano: configura el workflow de GitHub Actions que ya está en `.github/workflows/sync-fixtures.yml`. Detalles en `docs/deployment.md` §10.

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
| `Invalid environment variables` al correr `npm run bootstrap` | `.env` no se está leyendo desde el script. | El script pasa `--env-file-if-exists=.env` a `tsx`. Si lo ves, asegúrate de estar en la raíz del repo (donde vive `.env`) y de que el archivo no está vacío. |
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
npm run bootstrap
```

Tras esto la BD tiene schema + achievements. Para llenarla con partidos reales, dispara el sync:

```bash
curl -X POST http://localhost:3000/api/cron/sync-fixtures
```

Si no quieres datos reales, en su lugar `npm run dev:set-live` después de tener al menos un partido en BD para validar la live card.

## 14. Qué sigue funcionando hoy / qué no

**Funciona:**

- `/` — landing pública con leaderboard mock (no BD).
- `/inicio` — panel privado con hero + live/next match + próximos + progreso + mini-leaderboard.
- `/partidos` — listado completo agrupado por día con cards adaptadas por estado.
- `/partidos/<id>` — detalle con formulario de predicción (simple / exacto / doble).
- `/ranking` — mismo leaderboard que la landing dentro del shell privado.
- `/u/<username>` — perfil público con identidad, stats y acordeón de logros.
- `/faq` — preguntas frecuentes.
- **Notificaciones in-app**: dropdown del bell con tipos `prediction_sent` (y futuros `prediction_locked`, `match_finished`, `achievement_unlocked`). Sin push real todavía.
- Login con Google + auto-gen de username + backfill idempotente.
- Sync manual a partidos reales vía `POST /api/cron/sync-fixtures` (necesita API-Football).
- 461/462 tests pasando.

**Aún no implementado (capabilities futuras):**

- `/logros` — placeholder con "próximamente" (la página completa llegará con `add-achievements-page`).
- **Sync automático contra API-Football** — hoy es disparo manual con `curl`. Se decidirá la cadencia cuando aterrice `add-leaderboard-sse`.
- **Push de notificaciones en tiempo real** — el dropdown funciona pero requiere recargar para ver nuevas. SSE llega con `add-leaderboard-sse`.
- Recálculo automático de puntos cuando un partido cambia (`add-scoring-pipeline`).
- Refresco en tiempo real del panel (`add-leaderboard-sse`).
- Histórico de ranking para sparkline + delta (`add-ranking-history`).
- Goles parciales durante el live (`add-live-scoring`).

Más contexto en `docs/decisions.md` (dosier de decisiones técnicas) y en `openspec/changes/` (propuestas abiertas).
