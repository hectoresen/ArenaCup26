# add-error-monitoring

## Why

Hoy los errores solo aparecen en stdout de Railway (`railway logs`). Cualquier excepción que pase fuera de horas de revisión se pierde. Sin agregación, métricas ni alertas:

- Un fallo silencioso en `processFinishedMatch` puede dejar a un usuario sin puntos sin que nadie se entere.
- Un spike de 5xx en producción no notifica.
- Los `[AC/...]` son útiles para debug en vivo pero no se persisten más allá del retention de Railway (~30 días).

## What changes

Capability nueva: **`error-monitoring`**.

### Sentry (opción primaria)

- `npm install @sentry/nextjs`.
- `sentry.{server,client,edge}.config.ts` con DSN desde env var.
- `Sentry.captureException` en:
  - Cron handler cuando provider lanza error tipado.
  - `processFinishedMatch` cuando un user falla individualmente.
  - `submitPrediction` para errores no esperados (los `ok:false` con `code` son validación normal, no se reportan).
  - Auth callback cuando el backfill de username falla.
- Filtrar errores conocidos / esperados (Auth.js `UntrustedHost` en dev, etc.).

### Structured logs

`src/lib/debug-log.ts` evoluciona:
- `dlog` (existente) sigue como `console.log` para debug local.
- `info(scope, message, data)`, `warn(...)`, `error(...)` envían a Sentry (en producción) + stdout (siempre).

### Env

```
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
```

Opcionales: sin DSN → noop, sigue funcionando todo en stdout.

### Alerting

- Slack webhook con Sentry → canal `#wmundial-errors`.
- Reglas: severidad ≥ error con freq ≥ 5/h.

## Impact

- **Coste**: Sentry free tier 5k events/mes. Bastante.
- **Riesgo**: PII en los reportes. Mitigación: `beforeSend` que strippea `email`, `name`, payloads de predicción con identificadores.
- **Bloquea**: nada.
- **Desbloquea**: monitoreo necesario antes de abrir a usuarios.
