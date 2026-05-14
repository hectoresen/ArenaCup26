# add-security-hardening

## Why

Hoy la app es un demo robusto sin defensas básicas. Antes de cualquier promoción a usuarios reales hace falta el bloque mínimo de seguridad:

1. **`CRON_SECRET` no es obligatorio**: si la env var no está set, `POST /api/cron/sync-fixtures` acepta cualquier request. Cualquier persona que adivine la URL de Railway puede disparar syncs, agotar el cupo de api-football y forzar transiciones a `finished` sobre matches reales (con el riesgo de scoring incorrecto).
2. **No hay CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy**: queda abierto a XSS reflejado, clickjacking, MIME-sniffing, fugas de referrer.
3. **`AUTH_SECRET` y `CRON_SECRET` no se validan en producción**: si alguien deploya sin ellos, el server arranca y rompe runtime.
4. **No hay alerta de credenciales expuestas**: el flujo actual no escanea PRs en busca de keys filtradas (`API_FOOTBALL_KEY`, `GOOGLE_CLIENT_SECRET`, etc.). En esta misma sesión ya se filtraron en chat — necesitamos protección contra repeticiones.

## What changes

Capability nueva: **`security-hardening`**.

### CRON auth obligatorio en producción

`src/lib/env.ts`:
- `CRON_SECRET` pasa de `optional()` a `.min(32)` cuando `NODE_ENV === "production"`. En dev sigue opcional.
- `AUTH_SECRET` ya tiene min(32) — mantiene.

`src/app/api/cron/sync-fixtures/handler.ts` (revisar):
- Si `CRON_SECRET` está set, el header `Authorization: Bearer <token>` es obligatorio. Sin él → 401. (Ya es el comportamiento, sólo verificar y blindar test.)

### Security headers en `next.config.ts`

Añadir `async headers()` con:

- `Content-Security-Policy`: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' (en dev); 'strict-dynamic' con nonce en producción; img-src 'self' data: https://media.api-sports.io https://*.googleusercontent.com; connect-src 'self' https://v3.football.api-sports.io; frame-ancestors 'none'.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()`.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (solo en HTTPS / producción).

### Credential leak detection

- `.github/workflows/gitleaks.yml` con [Gitleaks](https://github.com/gitleaks/gitleaks-action) en cada PR. Falla el build si detecta tokens.
- `.gitleaks.toml` con allowlist mínima para los seeds locales.

### Documentación

- `docs/security.md` con: cómo rotar API_FOOTBALL_KEY, AUTH_SECRET, CRON_SECRET, GOOGLE_CLIENT_SECRET, DATABASE_URL. Pasos paso a paso por servicio (api-football dashboard, Google Cloud Console, Railway, GitHub Secrets).
- `docs/decisions.md` §14: por qué CSP con `'unsafe-inline'` para script en dev (Next streams CSR script tags inline; en producción se mueve a nonces cuando Next 16 lo facilite).

## Impact

- **Riesgo de breaking**: CSP estricta puede bloquear scripts inline o terceros no documentados (analytics, Google Tag, etc.). Mitigación: empezar con report-only mode 1 semana, ajustar, después enforcing.
- **Coste**: Gitleaks corre en CI ~10s/PR. CSP no afecta runtime.
- **Bloquea**: `add-product-analytics` (necesita allowlist en CSP).
- **Desbloquea**: cualquier promoción a usuarios externos. Hasta que esto no esté, la app sigue siendo "demo interno".
