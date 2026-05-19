# Tasks — add-security-hardening

## Cron auth

- [ ] 1. `src/lib/env.ts`: `CRON_SECRET` se valida con `min(32)` cuando `NODE_ENV === "production"` (refine condicional).
- [ ] 2. Verificar `handleCronRequest` rechaza request sin bearer cuando `CRON_SECRET` está set (test ya existente — confirmar coverage).
- [ ] 3. Actualizar `.env.example` con `CRON_SECRET=<generar con openssl rand -base64 32>`.

## Security headers

- [ ] 4. `next.config.ts` async `headers()` devolviendo CSP + X-Frame + nosniff + Referrer + Permissions + HSTS.
- [ ] 5. CSP en report-only mode (`Content-Security-Policy-Report-Only`) los 7 días iniciales, después flip a enforcing.
- [ ] 6. Test manual en producción con DevTools console — buscar violaciones, ajustar allowlist.

## Credential scanning

- [ ] 7. `.github/workflows/gitleaks.yml` con `gitleaks-action@v2` en PRs y push a main.
- [ ] 8. `.gitleaks.toml` con allowlist para `.env.example`, fixtures de tests, etc.
- [ ] 9. README badge de gitleaks status.

## Rotación de secrets

- [ ] 10. `docs/security.md` con runbook: pasos exactos para rotar cada secret (API_FOOTBALL_KEY, AUTH_SECRET, CRON_SECRET, GOOGLE_CLIENT_SECRET, DATABASE_URL).
- [ ] 11. Rotación inmediata de `API_FOOTBALL_KEY` y `GOOGLE_CLIENT_SECRET` filtradas en sesión 2026-05-14.

## Tests

- [ ] 12. Test del handler del cron: 401 si bearer ausente, 200 si bearer correcto, 401 si bearer incorrecto.
- [ ] 13. Test de integración: `curl -i` contra producción tras deploy debe devolver los headers esperados.

## Docs

- [ ] 14. `docs/decisions.md` §14 "Security hardening".
- [ ] 15. `docs/deployment.md` §12 con paso explícito "configurar CRON_SECRET, validar headers".
