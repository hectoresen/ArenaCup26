# Despliegue en Railway

Guía paso-a-paso para llevar WebMundial 26 a producción en [Railway](https://railway.app). Es la opción "all-in-one" elegida: web Next + Postgres en un solo dashboard, sin hibernación, ~$5/mes pay-as-you-go.

> Antes de empezar, asegúrate de que `main` esté limpio y que `npm test` + `npm run build` pasan localmente.

## 1. Crear cuenta y proyecto

1. Ve a [railway.app](https://railway.app) y crea cuenta con GitHub (te ahorra OAuth manual luego).
2. **New Project → Deploy from GitHub repo → selecciona el repo de webmundial**.
3. Railway detecta Next 15. Por defecto corre `npm run build` y luego `npm start`. No toques estos comandos.

## 2. Añadir Postgres al proyecto

1. Dentro del proyecto, click en **+ New → Database → PostgreSQL**.
2. Railway crea una instancia y te muestra la URL en su tab `Variables`.
3. **Vincula la BD al servicio web**: en el servicio web, tab `Variables → Add Reference → DATABASE_URL`. Railway inyecta `${{ Postgres.DATABASE_URL }}` automáticamente.

## 3. Variables de entorno

En el servicio web, tab `Variables`. Añade:

| Variable | Valor |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 48` y pega la salida |
| `AUTH_TRUST_HOST` | `true` (obligatorio fuera de Vercel) |
| `GOOGLE_CLIENT_ID` | de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | idem |
| `NEXT_PUBLIC_APP_URL` | la URL pública (sección 5) |
| `API_FOOTBALL_KEY` | si quieres sync real con api-football |
| `API_FOOTBALL_BASE_URL` | `https://v3.football.api-sports.io` |
| `MATCH_DATA_LEAGUE_ID` | `1` |
| `MATCH_DATA_SEASON` | `2026` |
| `CRON_SECRET` | un secreto largo si re-habilitas el cron (deshabilitado por defecto) |
| `NODE_ENV` | `production` (Railway lo pone solo, verifica) |

`DATABASE_URL` no la metas a mano — viene de la referencia al servicio Postgres.

## 4. Aplicar el schema

Desde tu máquina local con la URL de prod (la encuentras en el dashboard de Railway, servicio Postgres → tab `Variables` → `DATABASE_URL`):

```bash
DATABASE_URL='<la-url-de-railway>' npm run db:push
```

Aplica las dos migraciones (`0000_*`, `0001_*`, `0002_*`). Verifica con:

```bash
DATABASE_URL='<la-url-de-railway>' npm run db:studio
```

> **No corras `npm run fixtures` contra producción.** Los fixtures borran y reescriben las tablas `matches` y `predictions`. Para producción la BD arranca vacía y se llena con el cron de api-football cuando lo activemos. Si quieres datos de demo en una rama de staging, sí (paso 7).

## 5. Asignar dominio

1. En el servicio web → tab `Settings → Networking → Generate Domain`.
2. Railway te da `<nombre>.up.railway.app` gratis. Si quieres dominio propio (`webmundial26.com`), añádelo en la misma sección y configura el CNAME en tu DNS.
3. Copia esa URL y mete `NEXT_PUBLIC_APP_URL` con su valor exacto en las env vars (paso 3).

## 6. Configurar Google OAuth para producción

1. Vuelve a [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Selecciona tu OAuth Client ID.
3. En **Authorized redirect URIs** añade (sin borrar el de localhost):
   ```
   https://<tu-dominio>/api/auth/callback/google
   ```
4. Save. Cambios tardan unos minutos en propagar en Google.

## 7. Verificar el despliegue

Railway detecta cada push a `main` y redesplega automáticamente. Para confirmar:

1. Ve a `https://<tu-dominio>/` → deberías ver la landing.
2. Click en **Predecir ahora** → modal Google → autenticas → te lleva a `/inicio`.
3. Tu username queda generado del nombre de Google.
4. `/inicio` muestra "Empieza tu primera predicción" (sin partidos en BD aún).

> Si el OAuth falla con `redirect_uri_mismatch`, espera 5 minutos a que Google propague (paso 6).

## 8. Sincronizar partidos reales (cuando quieras)

Sin cron automático, sincronizas con un curl manual:

```bash
curl -X POST https://<tu-dominio>/api/cron/sync-fixtures
```

Sin `CRON_SECRET` configurado en producción, este endpoint responde `401`. Para abrirlo:

1. En Railway env vars, asegúrate de que `CRON_SECRET` tiene un valor (lo generamos en paso 3).
2. Lanza con header:
   ```bash
   curl -X POST https://<tu-dominio>/api/cron/sync-fixtures \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```

Cada llamada consume 1 request del cupo diario de api-football (100/día en free tier).

## 9. Branches de staging (opcional)

Railway tiene **PR environments**: cada pull request crea un entorno aislado con BD propia. Útil para probar cambios grandes sin tocar prod.

1. Settings → `Environments → Enable PR environments`.
2. Marca la rama base (`main`).
3. Al abrir una PR, Railway despliega una réplica del proyecto con su propia Postgres y URL.

## 10. Operación día a día

| Acción | Cómo |
|---|---|
| Logs en vivo | Dashboard del servicio → tab `Deployments → View logs` |
| Métricas | tab `Metrics` (CPU, RAM, red, requests) |
| Restart manual | tab `Deployments` → menú del deploy activo → `Restart` |
| Backup de BD | Postgres tab → `Backups`. Activa backups diarios. |
| Rollback | `Deployments → ...` → `Rollback to this deploy` |
| Variables nuevas | Variables tab → cambia o añade → Railway redespliega solo |

## 11. Costes esperados

Railway factura por **uso real**:

- **RAM**: $10/GB·mes. Una app Next idle consume ~200-400 MB → $2-4/mes.
- **CPU**: $0.000463/vCPU·minuto. Bajo tráfico, despreciable.
- **Postgres**: misma fórmula, ~$0.5-1/mes con poco volumen.
- **Red**: 100 GB/mes incluidos en Hobby.

El plan **Hobby** da **$5/mes de uso incluido**. Con tráfico de pre-lanzamiento (decenas de usuarios) cabes dentro. Cuando llegue el Mundial, monitorizar y ajustar.

> Pon **alertas de gasto** en Settings → Billing → Spend alerts. Yo recomiendo alarma a $10/mes para enterarte si algo desbordara.

## 12. Cuándo migrar fuera

Casos en los que Railway se queda corto y conviene mover a Fly.io / Hetzner / Render Pro:

- **Tráfico sostenido > 1000 usuarios concurrentes** durante un partido — Railway no autoescala horizontalmente bien.
- **Latencia importante** en regiones lejanas (Asia/Oceania) — Railway tiene region única por servicio.
- **SSE de larga duración con miles de conexiones**: cuando aterrice `add-leaderboard-sse`, hay que medir. Hoy Railway las aguanta, pero en pico podría limitar.

Hasta entonces, Railway es la opción correcta.
