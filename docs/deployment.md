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
| `MATCH_DATA_LEAGUE_ID` | `1` | |
| `MATCH_DATA_SEASON` | `2026` | |
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

## 6. Migraciones automáticas en cada deploy

Configura Railway para que aplique las migraciones por ti antes de arrancar el server:

1. En el servicio web → **Settings** → sección **Deploy** → campo **Pre-Deploy Command**.
2. Pega: `npm run db:migrate`
3. Save.

Cada deploy ahora:
1. Compila el código (`pnpm run build`).
2. Aplica migraciones pendientes (`drizzle-kit migrate`) — solo las nuevas, las ya aplicadas se saltan automáticamente porque drizzle mantiene una tabla `__drizzle_migrations` con el journal.
3. Si las migraciones fallan, el deploy se cancela (no arranca un server contra una BD inconsistente).
4. Arranca `pnpm run start`.

> No hagas `db:push` manual contra Railway. `db:push` empuja el schema sin journal y entra en conflicto con `migrate`. Usa solo `migrate` (que es lo que el pre-deploy lanza).

### Datos de prueba (opcional)

Una vez las tablas existen, siembra fixtures de demo desde tu máquina local apuntando a la BD pública de Railway:

```bash
DATABASE_URL='<la-url-publica-de-postgres-de-railway>' npm run fixtures
```

> La URL pública la sacas en Postgres → tab `Variables` → `DATABASE_PUBLIC_URL`. Si solo ves `DATABASE_URL` con un host interno (`containers-us-west`), activa Public Networking en Postgres → Settings.
>
> `fixtures` borra y recrea `teams` + `matches`. Si en algún momento conectas el sync real con api-football, los partidos del cron irán a las mismas tablas. No mezcles ambos enfoques en la misma BD.

## 7. Verificar

1. `https://<tu-dominio>.up.railway.app/` → landing.
2. Click **Predecir ahora** → Google → te lleva a `/inicio`.
3. Si lanzaste `fixtures` ves la card de próximo partido y la lista.
4. Predice algo en `/partidos/<id>`. Confirma y revisa la campana del nav.

> Si OAuth falla con `redirect_uri_mismatch`, espera 5 minutos a que Google propague (paso 5).

## 8. Sincronizar partidos reales (opcional)

Sin cron automático, cuando quieras refrescar contra api-football:

```bash
curl -X POST https://<tu-dominio>.up.railway.app/api/cron/sync-fixtures
```

En dev sin `CRON_SECRET` (que no añadimos en el paso 3) el endpoint acepta el POST. Si lo añades, mete el header `Authorization: Bearer <CRON_SECRET>`.

## 9. Operación

Lo único que vas a tocar día a día:

| Cómo | Dónde |
|---|---|
| Ver logs | Dashboard del web service → tab `Deployments → View logs` |
| Restart | tab `Deployments` → menú → `Restart` |
| Cambiar env vars | tab `Variables` → Railway redespliega automáticamente |
| Push de código | `git push origin main` → deploy automático |
| Resetear la BD | servicio Postgres → tab `Data` → o lanza `db:push` con la URL desde tu máquina |

## 10. Costes

Plan **Hobby** da **$5/mes de uso incluido**. Para un único usuario probando desde móvil consumes muy poco:
- Web idle: ~200 MB RAM = ~$2/mes.
- Postgres con datos de prueba: <$1/mes.
- Red: prácticamente cero.

Total esperado: **dentro de los $5 incluidos**, no pagas adicional. Activa una alerta de gasto a $10/mes en Settings → Billing por si algún script se desboca.

Cuando este entorno deje de ser solo de pruebas y quieras promocionar la web, esta guía se ampliará con backups, PR environments, dominio propio + SSL, y criterios de migración si el tráfico crece.
