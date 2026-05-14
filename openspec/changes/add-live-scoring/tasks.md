# Tasks — add-live-scoring

## Endpoint

- [ ] 1. `/api/cron/sync-live` que solo llama `?live=all` y reconcilia matches existentes (no inserts).
- [ ] 2. Reusa `reconcileMatch` con `status="live"` → actualiza scores.
- [ ] 3. Bearer auth idem al cron normal.

## Worker

- [ ] 4. `.github/workflows/sync-live.yml` con `cron: "*/2 * * * *"`.
- [ ] 5. Smart skip: si response tiene 0 matches relevantes, no spam log.

## Computación on-the-fly

- [ ] 6. Ya existe `computeProvisionalScore`. Validar que con scores live frescos calcula correctamente.
- [ ] 7. Live card del dashboard actualiza `+30 pts · Provisional` con animación cuando cambia.

## Hot ladder (fase 2)

- [ ] 8. Componente que muestra "Top 5 ganando puntos en este partido" usando SSE bus.

## Métricas

- [ ] 9. Logger en sync-live con elapsed + matches affected.
- [ ] 10. Alert Sentry si supera 30 req/h sostenido (probable abuso).

## Tests

- [ ] 11. Unit del endpoint con mock provider.
- [ ] 12. E2E manual durante un live real.

## Docs

- [ ] 13. `docs/decisions.md` §19 con "hot vs cold cron" y coste API.
