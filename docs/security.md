# Security — runbook de WebMundial 26

Este documento concentra los procedimientos de seguridad operativa
del proyecto. Lectura obligada antes de cualquier rotación de
secrets o cambio en headers/permissions.

## 1. Secrets que mantenemos

| Secret                     | Dónde se guarda                         | Quién lo necesita        |
| -------------------------- | --------------------------------------- | ------------------------ |
| `AUTH_SECRET`              | Railway (web service) + `.env` local    | Auth.js para firmar JWT  |
| `AUTH_TRUST_HOST`          | Railway (web service)                   | Auth.js                  |
| `AUTH_URL`                 | Railway (web service)                   | Auth.js                  |
| `GOOGLE_CLIENT_ID`         | Railway + `.env` local                  | OAuth Google             |
| `GOOGLE_CLIENT_SECRET`     | Railway + `.env` local                  | OAuth Google             |
| `DATABASE_URL`             | Railway (referencia a Postgres service) | Drizzle + Auth.js        |
| `API_FOOTBALL_KEY`         | Railway + `.env` local                  | Provider match-data      |
| `CRON_SECRET`              | Railway + GitHub Secrets                | Endpoint de sync         |

> **Nunca** los pegues en chat, issues, PRs ni docs. Si lo haces, ver §3.

## 2. CRON_SECRET — obligatorio en producción

Desde 2026-05-15, `src/lib/env.ts` exige `CRON_SECrop ≥ 32 chars`
cuando `NODE_ENV === "production"`. Sin él, el deploy falla al
arrancar con `Invalid environment variables`. En dev sigue opcional
(útil para `curl localhost:3000/api/cron/sync-fixtures` a mano).

Generar uno nuevo:

```bash
openssl rand -base64 32
```

Hay que ponerlo en **dos sitios**:
1. Railway → web service → Variables → `CRON_SECRET`.
2. GitHub → repo → Settings → Secrets and variables → Actions →
   `CRON_SECRET` (el workflow `sync-fixtures.yml` lo manda como
   `Authorization: Bearer …`).

Si los dos valores no coinciden, el cron devuelve 401.

## 3. Rotación de un secret comprometido

Si un secret se filtra (chat público, PR, screenshot, log expuesto):

### 3.1 `API_FOOTBALL_KEY`

1. Login en https://dashboard.api-football.com/.
2. Account → Regenerate API key.
3. Copiar la nueva.
4. Railway → Variables → reemplazar `API_FOOTBALL_KEY`.
5. `.env` local: actualizar también si lo usas para tests integration.
6. La key vieja queda invalidada de inmediato; cualquier sync con
   ella devolverá `auth_failed`.

### 3.2 `GOOGLE_CLIENT_SECRET`

1. https://console.cloud.google.com/apis/credentials.
2. Selecciona el OAuth Client ID de WebMundial.
3. **Reset secret** (botón).
4. Copiar el nuevo.
5. Railway → Variables → `GOOGLE_CLIENT_SECRET`.
6. `.env` local idem.
7. Las sesiones existentes siguen vivas (el secret solo se usa al
   intercambiar el code OAuth por tokens). Logins nuevos requieren
   el nuevo secret; con el viejo daría `invalid_client`.

### 3.3 `AUTH_SECRET`

1. `openssl rand -base64 48` → nuevo valor.
2. Railway → Variables → `AUTH_SECRET`.
3. ⚠️ **Invalida todas las sesiones existentes** (los JWT firmados
   con el secret viejo dejan de verificar). Todos los users tendrán
   que volver a logarse.
4. Si se rota durante producción con tráfico, comunicarlo en status
   page (cuando aterrice `add-data-resilience`).

### 3.4 `CRON_SECRET`

1. Generar uno nuevo (§2).
2. Railway + GitHub Secrets a la vez. Si los actualizas con tiempo
   entre ellos, el cron fallará con 401 en el intervalo.

### 3.5 `DATABASE_URL`

No se "rota" — la conexión es a Postgres directo. Si una credencial
de DB se filtra:
1. Railway → Postgres service → Settings → rotar credenciales.
2. La URL nueva propaga sola al web service (es una referencia).

## 4. Headers de seguridad

`next.config.ts` setea por defecto:

- `Content-Security-Policy` (ver código para directives exactas).
- `X-Frame-Options: DENY` (no embebeable en iframes).
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()`.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  (solo en producción).

CSP queda en **enforcing** desde el primer deploy. Si añades un
dominio externo (analytics, fonts, etc.) hay que actualizarlo en
`buildCsp()` y verificar con DevTools console.

Verificar tras deploy:

```bash
curl -sI https://<tu-dominio> | grep -E '(Content-Security|X-Frame|HSTS|Referrer)'
```

## 5. Gitleaks — escaneo de credenciales en CI

Workflow `.github/workflows/gitleaks.yml` corre en cada PR y push a
`main`. Si detecta un patrón de secret, falla el build y el PR no se
puede mergear hasta que se limpie el commit.

Si Gitleaks da un falso positivo (string que parece secret pero no lo
es), añadirlo a `.gitleaks.toml` → `regexes` o el path a `paths`.

Si un secret real se cuela en un commit:
1. Rotar el secret (§3) — el commit queda, pero la key vieja deja de
   ser válida.
2. Si el repo fuera privado y necesitas borrar el secret del
   historial: `git filter-repo` + push force (avisa al equipo antes).

## 6. Tras un incidente

1. Identificar qué secret se filtró y desde cuándo.
2. Rotarlo según §3.
3. Revisar logs en busca de uso anómalo de la key (por ej. requests
   con la old key tras el reset).
4. Anotar en `docs/incidents.md` (crear cuando ocurra el primero):
   fecha, qué se filtró, alcance, remediation, lecciones aprendidas.

## 7. Rate limiting (add-rate-limiting, 2026-05-15)

`src/lib/rate-limit.ts` implementa cuatro limiters basados en
Upstash Redis (sliding window):

| Limiter        | Límite          | Identificador | Dónde se aplica                                  |
| -------------- | --------------- | ------------- | ------------------------------------------------ |
| `submit`       | 10 / 60 s       | userId        | `submitPrediction` (server action).              |
| `cron`         | 6 / 60 s        | IP            | `handleCronRequest` tras pasar bearer.           |
| `publicRead`   | 60 / 60 s       | IP            | Pendiente de wirear (landing + /u/<username>).   |
| `signup`       | 5 / 3600 s      | IP            | Pendiente de wirear (Auth.js callback).          |

### Configuración

Env vars en Railway:

```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

Si no están set, los limiters quedan en **noop mode** (siempre
permiten). En producción el deploy emite warning:

```
[WM/ratelimit] UPSTASH_REDIS_REST_URL / TOKEN not set in production — rate limiting is DISABLED
```

### Política fail-open

Si Redis no responde (timeout, down), el limiter **permite** la
request en lugar de bloquear. Mejor sufrir un poco de abuso
temporal que cortar a usuarios legítimos por un fallo de Upstash.
Cuando tengamos métricas reales de abuso, evaluar invertir.

---

## 8. Audit pre-launch — qué hace falta antes de abrir al público

### 8.1 Puntos críticos (bloquean lanzamiento público)

#### CRIT-1 · Credenciales filtradas en historial de chat

- **Riesgo**: `API_FOOTBALL_KEY` y `GOOGLE_CLIENT_SECRET` se compartieron en chat durante debugging (2026-05-14). Aunque el repo nunca los tuvo, alguien con acceso al historial puede usarlos.
- **Impacto**: agotar cupo gratuito de api-football (denegación de servicio funcional) o impersonar la app contra Google OAuth.
- **Mitigación**: rotar siguiendo §3.1 y §3.2 antes de cualquier promoción pública.

#### CRIT-2 · ✅ Resuelto: drizzle-orm actualizado a 0.45.2 (2026-05-15)

- **Riesgo**: `npm audit` reportaba HIGH severity en drizzle-orm <0.45.2 (`GHSA-gpj5-g38j-94v9`): identificadores SQL escapados incorrectamente.
- **Estado**: actualizado `drizzle-orm 0.38.4 → 0.45.2` + `drizzle-kit 0.30.6 → 0.31.10`. Typecheck, 477 tests, build y `db:generate` (sin schema changes) verifican que nada se rompió. `npm audit` ya no reporta HIGH severities — solo quedan las 13 moderate de esbuild/vite en dev deps (WEAK-1, no producción).
- **Verificación post-deploy**: el primer cron sync tras pushear debe completar sin errores nuevos. Si falla, revertir con `npm install drizzle-orm@0.38.4 drizzle-kit@0.30.6`.

#### CRIT-3 · CRON_SECRET dual config

- **Riesgo**: el secret vive en dos sitios (Railway + GitHub Secrets). Si están desincronizados, el cron deja de funcionar silenciosamente (401).
- **Mitigación**: §3.4 + revisar tras cada rotación que ambos coinciden con `curl` manual al endpoint con el bearer.

#### CRIT-4 · ✅ Resuelto: privacy controls (2026-05-15)

- **Estado**: `users.privacy` JSONB con shape `UserPrivacy = { visibility }`. Default `'public'` (cero impacto en users existentes). Los antiguos toggles individuales (`showName`/`showCountry`/`showImage`/`showPoints`/`showAchievements`) se eliminaron el 2026-05-15 — ver §8.4.
- **Visibility**: `public` / `friends_only` / `private`. La visibility solo afecta a la página `/u/<username>` — el ranking global es **inamovible** (todos los users registrados aparecen siempre con nombre, bandera, puntos y avatar). `friends_only` se comporta como `private` (solo el dueño puede entrar) hasta que aterrice `add-social-friends`; entonces hará un check contra `friendships`.
- **Fallback**: cuando `canViewProfile` devuelve `false`, la página `/u/<username>` renderiza `<PrivateProfile>` (cartel "Perfil privado" con identidad mínima — nombre, avatar, bandera). **No** se hace `notFound()`: el ranking enlaza aquí para todos los users, sea cual sea su visibility, así que un 404 sería incoherente.
- **UI**: `/ajustes/privacidad` con un único radio group (3 opciones). Optimistic UI; server action `updatePrivacy` valida con zod (`{ visibility: enum }`) y revalida las paths afectadas (`/`, `/ranking`, `/u/<username>`).
- **Helpers**: `normalizePrivacy(raw)`, `canViewProfile(privacy, ownerId, viewerId)` en `src/server/privacy/apply.ts`. `maskName` se eliminó al desaparecer el masking de nombre.
- **Entry point**: link "Privacidad" en el AccountMenu del shell.

#### CRIT-5 · ✅ Resuelto: rate-limit wireado en publicRead + signup (2026-05-15)

- **Riesgo**: scraping masivo del ranking/perfiles públicos (DoS sobre BD) y creación masiva de cuentas con Google deshechables.
- **Estado**: completado.
  - `publicReadLimiter` (60/60s por IP) en `src/app/[locale]/page.tsx` y `src/app/[locale]/u/[username]/page.tsx`. Si rebasa, renderiza `<ThrottledState>` con un mensaje friendly (status 200 — limitación de Server Components; para 429 real haría falta middleware, deuda apuntada en WEAK-11).
  - `signupLimiter` (5/3600s por IP) en el callback `signIn` de Auth.js. Detecta primer login (`!user.id`) y bloquea con `return false` si rebasa.
  - Política fail-open: si el rate-limit falla por motivo de infra, permite la request (mejor que cortar a un usuario legítimo).

#### WEAK-11 · Status 429 real en publicRead requiere middleware

- **Riesgo**: cuando `publicReadLimiter` bloquea un page render, devolvemos HTML 200 con UI "demasiadas peticiones" en lugar de un 429 HTTP real. Los humanos lo verán bien; los bots de scrapeo no lo entenderán como rate-limit.
- **Mitigación futura**: mover el check a `src/middleware.ts` con un client compatible con Edge runtime (`@upstash/redis` lo soporta vía REST). Aplazado: bloqueante para scrapers, no para usuarios reales.

### 8.2 Puntos débiles (mejorables, no bloqueantes)

#### WEAK-1 · `vite/esbuild` con CVE moderate en dev deps

- `npm audit` marca esbuild <=0.24.2 con `GHSA-67mh-4wv8-2f99` (cualquier web puede leer la respuesta del dev server). Solo afecta `npm run dev`, NO producción.
- Upgrade a drizzle-kit@0.31.10 + vitest 3.x es breaking. Apuntado, no urgente.

#### WEAK-2 · ✅ Resuelto: error monitoring con Sentry (2026-05-15)

- **Estado**: `@sentry/nextjs` configurado con server/edge/client init separados. `src/instrumentation.ts` carga el runtime correcto.
- **PII scrubbing** (`src/lib/sentry-scrub.ts`): el `beforeSend` redacta headers `authorization`/`cookie`, drop emails/usernames/IPs del `event.user`, y filtra `extra` con keys que contengan `prediction`/`token`/`secret`/`password`.
- **Modo noop**: si `SENTRY_DSN` no está set, `init()` no envía nada. `derr()` en `debug-log.ts` solo invoca Sentry cuando `NODE_ENV=production` Y `SENTRY_DSN` está set.
- **Configuración Railway**: añadir `SENTRY_DSN` (y opcional `SENTRY_AUTH_TOKEN` para sourcemap upload + `SENTRY_ENVIRONMENT`).
- **Wired**: `derr` reemplaza `dlog(..., {err})` en los catches críticos del scoring pipeline. `onRequestError` exportado desde instrumentation.ts cubre Server Components y route handlers automáticamente.

#### WEAK-3 · Sin auditoría de accesos

- No registramos quién entra, desde dónde, ni qué predice. Un compromiso de cuenta no se detecta hasta que el dueño se da cuenta.
- **Mitigación**: tabla `audit_log` con `user_id, action, ip, ua, at`. Apuntado para cuando aterrice `add-error-monitoring`.

#### WEAK-4 · `Permissions-Policy` minimal

- Hoy denegamos geo/mic/cam/payment. Falta denegar `interest-cohort`, `browsing-topics`, `unload`, `usb`, `bluetooth`, `gyroscope`, `accelerometer`, `serial`, `magnetometer`, `display-capture`, `screen-wake-lock`.
- **Mitigación**: ampliar lista en `next.config.ts`.

#### WEAK-5 · Sin Subresource Integrity (SRI)

- No hay hashes de integridad en los scripts. Si Next CDN se compromete, el navegador no detecta tampering.
- **Mitigación**: Next 15 no lo hace nativamente todavía. Aceptamos riesgo hasta que llegue soporte oficial.

#### WEAK-6 · CSP `'unsafe-inline'` en styles

- Tailwind 4 inyecta CSS inline. Inevitable hoy sin nonce. Acotado en `style-src` solo.
- **Mitigación**: cuando aterrice nonce support en next-intl + Tailwind, migrar.

#### WEAK-7 · Sin 2FA propio

- Confiamos 100% en Google OAuth. Si Google MFA está mal configurado en la cuenta del user, no hay segunda capa.
- **Mitigación**: futuro — propuesta `add-2fa-totp` cuando justifique el coste UX.

#### WEAK-8 · Hardcoded user IDs en seeds

- Los seed users de placeholders tienen UUIDs predecibles (`00000000-0000-4000-a000-000000000001..7`). No es secreto, pero da pistas si alguien intenta enumerar.
- **Mitigación**: regenerar UUIDs aleatorios. Bajo riesgo, baja prioridad.

#### WEAK-9 · Falta política de retención de datos

- No tenemos política escrita sobre cuánto tiempo conservamos `point_events`, `notifications`, `username_history`. RGPD pide transparencia.
- **Mitigación**: añadir a `docs/privacy.md` (crear cuando exista la propuesta `add-profile-privacy`).

#### WEAK-10 · Sin pentest externo

- Solo self-review hasta ahora. Una segunda mirada profesional encuentra cosas que el equipo no ve.
- **Mitigación**: cuando la app entre en beta cerrada, contratar pentest (~500-2000€).

### 8.3 Lo que ya está sólido

- ✅ Auth.js v5 con JWT firmado + AUTH_SECRET >32 chars.
- ✅ CSRF: Auth.js lo gestiona automáticamente en POST a `/api/auth/*`.
- ✅ Server actions de Next 15 con encryption automática.
- ✅ Drizzle prepared statements en todas las queries (sin string concat).
- ✅ CSP enforcing desde el primer deploy.
- ✅ HSTS + X-Frame-Options + nosniff + Referrer-Policy + Permissions-Policy.
- ✅ CRON_SECRET obligatorio en producción runtime.
- ✅ Gitleaks bloqueando filtraciones futuras en PRs.
- ✅ Rate limiting en submit + cron (con Upstash configurable).
- ✅ Idempotencia en scoring pipeline (no duplica puntos).
- ✅ Notification kind enum cerrado (no se puede inyectar tipo arbitrario).
- ✅ Username validation (regex + uniqueness + backfill).
- ✅ Logs `[WM/...]` con truncado de IPs/userIds (no exponen completo).

### 8.4 Checklist antes de "Open beta"

- [ ] CRIT-1: rotar API_FOOTBALL_KEY + GOOGLE_CLIENT_SECRET (operativa manual del owner; ver §9.1 abajo).
- [x] ~~CRIT-2: actualizar drizzle-orm a ≥0.45.2 + verificar suite verde.~~ (2026-05-15)
- [ ] CRIT-3: validar CRON_SECRET sincronizado en Railway + GitHub (sirve para `sync-fixtures` + `snapshot-ranking`).
- [x] ~~CRIT-4: implementar `add-profile-privacy` con default sensato (público es OK si comunicamos claramente).~~ (2026-05-15)
- [x] ~~CRIT-5: terminar wiring de `add-rate-limiting` (publicRead + signup).~~ (2026-05-15)
- [ ] Configurar UPSTASH_REDIS_REST_URL/TOKEN en Railway (sin esto el rate limit es noop).
- [x] ~~WEAK-2: implementar `add-error-monitoring` (Sentry) + alertas Slack.~~ (2026-05-15; código listo, alertas Slack pendiente — configurar webhook tras crear proyecto en Sentry y setear `SENTRY_DSN` en Railway).
- [x] ~~Política de privacidad pública en `/privacy` o `/legal`.~~ (2026-05-15: `/legal/privacy` en es/en/fr/ar, link desde AccountMenu)
- [x] ~~Términos de uso en `/terms`.~~ (2026-05-15: `/legal/terms` en es/en/fr/ar, link desde AccountMenu)
- [ ] Cookie banner (si añadimos analytics que use cookies — hoy no aplica, solo cookies técnicas).

---

## 9. Operativa manual del owner

### 9.1 Rotación de credenciales (CRIT-1)

Pasos operativos cuando se filtran secrets en git o se requiere rotación programada:

1. **GOOGLE_CLIENT_SECRET**: ir a [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → seleccionar OAuth Client → "Reset Secret". Copiar el nuevo secret.
2. **API_FOOTBALL_KEY**: ir a [api-football dashboard](https://dashboard.api-football.com/) → API Keys → Regenerate. Copiar el nuevo key.
3. **Railway**: ir al servicio `wmundial` → Variables → actualizar `GOOGLE_CLIENT_SECRET` y `API_FOOTBALL_KEY`. El redeploy es automático.
4. **GitHub Secrets** (si CRON usa el mismo secret): Settings → Secrets → Actions → actualizar.
5. **Verificación**: forzar login con Google (debe funcionar) y disparar manualmente el cron `/api/cron/sync-matches` con `Authorization: Bearer <CRON_SECRET>` (debe devolver 200).
6. **Auditoría**: si la rotación fue por leak, revisar `git log` y/o GitHub Audit Log para identificar el commit/PR donde se filtró y considerar `git filter-repo` para limpiar la historia.

### 9.2 Activar Sentry (WEAK-2 final step)

1. Crear proyecto en [sentry.io](https://sentry.io/) tipo "Next.js".
2. Copiar el DSN.
3. Railway → Variables → añadir `SENTRY_DSN=<dsn>`. Opcionalmente `SENTRY_ENVIRONMENT=production`.
4. Redeploy. El primer error en prod debería aparecer en el dashboard en <5 min.
5. (Opcional) configurar Slack webhook desde Sentry → Settings → Integrations.

Sin `SENTRY_DSN`, el módulo `@sentry/nextjs` funciona en modo noop — no rompe nada, simplemente no envía nada.

### 9.3 Activar Plausible analytics (opcional)

Plausible es privacy-friendly (sin cookies, sin PII, sin fingerprinting) y bajo GDPR/ePrivacy no requiere banner de consent.

1. Crear cuenta en [plausible.io](https://plausible.io) (o self-host) y añadir el dominio.
2. Railway → Variables → añadir `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=<tu-dominio>` (p.ej. `wmundial.app`).
3. (Opcional) `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL=<url>` si usas un self-host con script propio.
4. Redeploy. El script se inyecta en `<head>` solo si `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` está set; sin esta variable, no se hace ninguna request a Plausible (noop completo).

Lo que tracking: page views + outbound link clicks. NO se envía ni email, ni nombre, ni IP completa (Plausible la trunca antes de procesar).

---

## 9. TODOs (pendientes en propuestas abiertas)

- `add-rate-limiting` — Upstash en submit, cron, signup, reads.
- `add-error-monitoring` — Sentry con `beforeSend` que scrubea PII.
- `add-data-resilience` — backups verificados + status page.
