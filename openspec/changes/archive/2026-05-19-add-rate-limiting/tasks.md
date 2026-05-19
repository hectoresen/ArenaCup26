# Tasks — add-rate-limiting

## Setup

- [ ] 1. `npm install @upstash/ratelimit @upstash/redis`.
- [ ] 2. Crear cuenta Upstash, base Redis free tier. Copiar URL + TOKEN a Railway + `.env.example`.
- [ ] 3. `src/lib/env.ts`: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` opcionales.

## Limiter module

- [ ] 4. `src/lib/rate-limit.ts` con `createLimiter(config) → {check(id):Promise<boolean>}`. Si no hay env vars, `check` siempre `true` (noop).
- [ ] 5. Exportar limiters preconfigurados: submit / cron / publicRead / signup.

## Wiring

- [ ] 6. `submitPrediction`: check por userId al inicio.
- [ ] 7. Cron route: check por IP tras pasar auth.
- [ ] 8. Landing + perfil público: check por IP en el page handler.
- [ ] 9. Middleware extendido para signup callback.

## UX

- [ ] 10. Toast "Estás predeciendo muy rápido" en el detalle de partido si el submit devuelve `rate_limited`.
- [ ] 11. Página 429 estática (`src/app/[locale]/429.tsx`) para reads excesivos.

## Logs / tests

- [ ] 12. `[AC/ratelimit]` log al 429 con scope + id truncado.
- [ ] 13. Tests unitarios: noop cuando env vacío; rate limit correctamente cuando set; multiple identifiers no se cruzan.
- [ ] 14. Test de integración submit: 11 calls seguidos → 11º es 429.
