# Despliegue en Railway (entorno de pruebas)

Guía paso-a-paso para llevar WebMundial 26 a un entorno accesible desde el móvil para validar el flujo end-to-end. **No es producción aún** — es la sandbox que tú usas para iterar sin tener que cargar todo localmente.

Plataforma: [Railway](https://railway.app). Web Next + Postgres + sync manual en un solo dashboard, ~$5/mes pay-as-you-go (probablemente cabe en los créditos del plan Hobby sin pagar nada con tráfico de una persona).

> Antes de empezar: `npm test`, `npm run typecheck` y `npm run build` deben pasar localmente.

## 1. Crear cuenta y proyecto

1. Ve a [railway.app](https://railway.app) y crea cuenta con GitHub.
2. **New Project → Deploy from GitHub repo → selecciona el repo de webmundial**.
3. Railway detecta Next 15 y corre `npm run build` + `npm start` por defecto. No toques estos comandos.

## 2. Añadir Postgres

1. Dentro del proyecto, click en **+ New → Database → PostgreSQL**.
2. **Vincula la BD al web service**: en el web service → tab `Variables → Add Reference → DATABASE_URL`. Railway inyecta `${{ Postgres.DATABASE_URL }}` automáticamente.

## 3. Variables de entorno

En el web service, tab `Variables`. Añade:

| Variable | Valor | Notas |
|---|---|---|
| `AUTH_SECRET` | salida de `openssl rand -base64 48` | Obligatorio |
| `AUTH_TRUST_HOST` | `true` | Obligatorio fuera de Vercel |
| `GOOGLE_CLIENT_ID` | de Google Cloud Console | Paso 5 |
| `GOOGLE_CLIENT_SECRET` | idem | |
| `NEXT_PUBLIC_APP_URL` | la URL de Railway (paso 4) | |
| `API_FOOTBALL_KEY` | tu key | Opcional; sin esto el sync responde 500 |
| `API_FOOTBALL_BASE_URL` | `https://v3.football.api-sports.io` | |
| `MATCH_DATA_MODE` | `date-window` | Default. Cambia a `season` solo si tienes plan pago en api-football y quieres filtrar por liga/temporada. |
| `MATCH_DATA_BEFORE_DAYS` | `1` | Días en el pasado a sincronizar (para captar partidos que acaban de terminar). |
| `MATCH_DATA_AFTER_DAYS` | `7` | Días en el futuro a sincronizar (para que el usuario tenga qué predecir). |
| `MATCH_DATA_LEAGUE_FILTER` | _(opcional)_ | CSV de IDs de liga para acotar localmente (ej. `140,253,71` = La Liga + MLS + Brasileirão). Vacío = todas las ligas que aparezcan en el rango. |
| `MATCH_DATA_LEAGUE_ID` | `1` | Solo usado si `MATCH_DATA_MODE=season`. |
| `MATCH_DATA_SEASON` | `2026` | Solo usado si `MATCH_DATA_MODE=season`. |
| `NODE_ENV` | `production` | Railway lo pone solo, verifica |

`DATABASE_URL` no la metas a mano — viene de la referencia al servicio Postgres.

## 4. Dominio

En el web service → tab `Settings → Networking → Generate Domain` te da `<nombre>.up.railway.app` gratis. Copia esa URL y mete `NEXT_PUBLIC_APP_URL` con su valor exacto en el paso 3.

Para entorno de pruebas con esa URL basta. Si más adelante quieres dominio propio, se añade en la misma sección.

## 5. Google OAuth

1. En [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) selecciona tu OAuth Client ID.
2. En **Authorized redirect URIs** añade (sin borrar el de localhost):
   ```
   https://<tu-dominio>.up.railway.app/api/auth/callback/google
   ```
3. Save. Cambios tardan unos minutos en propagar en Google.

## 6. Migraciones + bootstrap automáticos en cada deploy

Configura Railway para que aplique migraciones Y siembre el catálogo de logros antes de arrancar el server:

1. En el servicio web → **Settings** → sección **Deploy** → campo **Pre-Deploy Command**.
2. Pega: `npm run db:migrate && npm run bootstrap`
3. Save.

Cada deploy ahora:
1. Compila el código (`pnpm run build`).
2. Aplica migraciones pendientes (`drizzle-kit migrate`) — solo las nuevas, las ya aplicadas se saltan.
3. Ejecuta `bootstrap`: siembra el catálogo de 24 logros (idempotente, `ON CONFLICT DO UPDATE`).
4. Si algo falla, el deploy se cancela.
5. Arranca `pnpm run start`.

> No hagas `db:push` ni `bootstrap` manual contra Railway. Railway los lanza por ti en cada deploy.

## 7. Flujo end-to-end con datos reales

La app está diseñada para que **no toques nada a mano**. La primera llamada al endpoint de sync lo hace todo solo:

1. **Disparar el primer sync**:
   ```bash
   curl -X POST https://<tu-dominio>.up.railway.app/api/cron/sync-fixtures
   ```
   Internamente (modo `date-window`, default):
   - Calcula la ventana: hoy − `MATCH_DATA_BEFORE_DAYS` … hoy + `MATCH_DATA_AFTER_DAYS`.
   - Hace 1 request `?date=YYYY-MM-DD` por día (9 req con la config por defecto).
   - Filtra localmente por `MATCH_DATA_LEAGUE_FILTER` si está definido.
   - Para cada team del provider que no esté en BD, lo upserta a la marcha (no hay `/teams` call separado — el free tier no lo permite para seasons actuales).
   - Mete los fixtures en `matches`. Para los partidos que ya vienen `finished` con predicciones, dispara el scoring pipeline.

   Si prefieres usar `MATCH_DATA_MODE=season` (con plan pago de api-football), el sync hace 1 sola request `?league=X&season=Y` y no rellena automáticamente teams nuevos durante un partido del Mundial; ese flujo es ideal cuando el catálogo de teams es fijo.

2. **Predecir** desde la web: `/partidos` → click en un match futuro → "Ganador" o "Marcador exacto".

3. **Mientras el partido está vivo** (el sync detecta `status=live` con scores):
   - `/inicio` muestra la **live card** con puntos provisionales: "💎 +30 pts · Provisional".
   - El cliente refresca el SSR cada 30s automáticamente (`<LiveAutoRefresh>`), sin recargar página.

4. **Cuando el partido termina** (el sync detecta transición a `finished`):
   - Disparo automático del scoring pipeline.
   - Calcula puntos con el engine para todas las predicciones del match.
   - Actualiza `user_points` (total + racha + correctCount).
   - Inserta `point_events` (auditoría).
   - Genera notificación `match_finished` por usuario.
   - El ranking se recalcula al vuelo en `/ranking` y `/u/<username>`.

> El scoring se dispara SOLO en transiciones a `finished` durante un sync. Si ya hay `point_events` para `(userId, matchId)`, se salta. Idempotente.

## 8. Verificar el deploy

1. `https://<tu-dominio>.up.railway.app/` → landing.
2. Click **Predecir ahora** → Google → te lleva a `/inicio`.
3. Si ya disparaste el sync (paso 7.1), ves la card de próximo partido y la lista.
4. Predice algo en `/partidos/<id>`. Confirma y revisa la campana del nav.

> Si OAuth falla con `redirect_uri_mismatch`, espera 5 minutos a que Google propague (paso 5).

## 9. Automatizar el sync (cron externo, recomendado)

En el repo hay un workflow de GitHub Actions ya escrito: `.github/workflows/sync-fixtures.yml`. Llama el endpoint cada 15 minutos. Para activarlo:

1. En **GitHub → tu repo → Settings → Secrets and variables → Actions → New repository secret**:
   - `RAILWAY_SYNC_URL` con `https://<tu-dominio>.up.railway.app/api/cron/sync-fixtures`.
   - (Recomendado) `CRON_SECRET` con un valor largo (`openssl rand -base64 32`). Si lo configuras aquí, añade la **misma** variable en Railway → tab `Variables` para que el endpoint exija ese bearer.

2. El workflow ya está activo (cron `0 */3 * * *` — cada 3 h). Lo puedes:
   - Ver corriendo en **Actions** del repo cada 3 horas.
   - Disparar manualmente con **Actions → Sync fixtures → Run workflow**.

3. Coste de API (default `date-window`, ventana de 9 días):
   - 9 días × 1 req/día = 9 req por sync.
   - 8 syncs/día × 9 req = **72 req/día** (free tier 100/día — cabe con margen).
   - Si subes la cadencia o la ventana, bajará el margen rápido. Ej. cada 1h con misma ventana = 216 req/día (sobrepasa). En ese caso pagas plan Pro y vuelves a `MATCH_DATA_MODE=season`.

> Cuando aterrice `add-leaderboard-sse`, este cron se mantendrá pero el cliente recibirá los cambios en tiempo real vía push (sin tener que esperar al próximo tick).

En dev local sin `CRON_SECRET` el endpoint acepta cualquier POST. En producción, si CRON_SECRET está en Railway, el endpoint exige `Authorization: Bearer <CRON_SECRET>`.

## 10. Operación

Lo único que vas a tocar día a día:

| Cómo | Dónde |
|---|---|
| Ver logs | Dashboard del web service → tab `Deployments → View logs` |
| Restart | tab `Deployments` → menú → `Restart` |
| Cambiar env vars | tab `Variables` → Railway redespliega automáticamente |
| Push de código | `git push origin main` → deploy automático |
| Resetear la BD | servicio Postgres → tab `Data` → o lanza `db:push` con la URL desde tu máquina |

## 11. Costes

Plan **Hobby** da **$5/mes de uso incluido**. Para un único usuario probando desde móvil consumes muy poco:
- Web idle: ~200 MB RAM = ~$2/mes.
- Postgres con datos de prueba: <$1/mes.
- Red: prácticamente cero.

Total esperado: **dentro de los $5 incluidos**, no pagas adicional. Activa una alerta de gasto a $10/mes en Settings → Billing por si algún script se desboca.

Cuando este entorno deje de ser solo de pruebas y quieras promocionar la web, esta guía se ampliará con backups, PR environments, dominio propio + SSL, y criterios de migración si el tráfico crece.
