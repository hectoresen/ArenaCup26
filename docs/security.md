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

## 7. TODOs (pendientes en propuestas abiertas)

- `add-rate-limiting` — Upstash en submit, cron, signup, reads.
- `add-error-monitoring` — Sentry con `beforeSend` que scrubea PII.
- `add-data-resilience` — backups verificados + status page.
