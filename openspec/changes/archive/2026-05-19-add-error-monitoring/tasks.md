# Tasks — add-error-monitoring

- [ ] 1. Crear proyecto en Sentry (organization `webmundial`).
- [ ] 2. `npm install @sentry/nextjs` + ejecutar el wizard (`npx @sentry/wizard@latest -i nextjs`).
- [ ] 3. Limpiar el wizard output: borrar archivos demo, ajustar `sentry.*.config.ts`.
- [ ] 4. `src/lib/env.ts`: `SENTRY_DSN`, `SENTRY_ENVIRONMENT` opcionales.
- [ ] 5. `src/lib/debug-log.ts`: añadir `info/warn/error` que multiplexan a Sentry + console.
- [ ] 6. Wrappear `processFinishedMatch` y `submitPrediction` con try/catch que reportan errores no esperados.
- [ ] 7. `beforeSend` con scrubbing de email, name, predictions personales.
- [ ] 8. Configurar Slack webhook en Sentry → canal del equipo.
- [ ] 9. Test manual: forzar un throw en cron, verificar que aparece en Sentry.
- [ ] 10. Doc en `docs/operations.md` con: cómo ver errores, cómo silenciar uno conocido, cómo escalar.
