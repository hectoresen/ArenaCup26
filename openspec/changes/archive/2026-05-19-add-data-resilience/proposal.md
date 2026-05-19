# add-data-resilience

## Why

Hoy:
- Backups Postgres: Railway los hace por defecto pero **no he verificado retention ni restore**.
- No hay PR environments — toda iteración aterriza directa en `main` → producción.
- Sin estrategia de DR: si la BD se corrompe, perdemos predicciones, puntos, logros.

Cuando la app tenga usuarios reales, esto deja de ser opcional.

## What changes

Capability nueva: **`data-resilience`**.

### Backups verificados

- Verificar Railway plan: cuántos snapshots conserva, frecuencia.
- Si Hobby plan no llega: añadir cron diario que hace `pg_dump` y sube a S3 / R2.
- Test de restore: descargar último backup, restaurarlo en una BD test, comprobar que arranca la app.
- Runbook en `docs/operations.md` con pasos exactos.

### PR environments

- Railway soporta PR environments via integración GitHub. Activarlo.
- Cada PR → nuevo deploy con BD efímera (free tier permite hasta N concurrent).
- URL de preview commenteada automáticamente en el PR.
- Auto-cleanup al merge / cierre.

### Migration safety

- Block migraciones destructivas en CI (DROP COLUMN, DROP TABLE) sin label `migration-destructive` aprobado por reviewer.
- Verificar que cada migración es backwards-compatible 1 versión hacia atrás (rolling deploy).

### Disaster recovery doc

- `docs/disaster-recovery.md`:
  - Cómo restaurar desde último backup.
  - Cómo replicar BD a otro provider (escape hatch si Railway cae).
  - Cómo comunicar a usuarios (status page).

### Status page

- Plain HTML estática en `https://status.wmundial.app` o usar `instatus.com` free.

## Impact

- **Coste**: PR envs gratis si caben en quota Railway. Backups extra ~1€/mes en R2.
- **Bloquea**: nada.
- **Desbloquea**: confianza para abrir a usuarios. Cumplir GDPR (derecho al borrado verificable, recuperación de datos).
