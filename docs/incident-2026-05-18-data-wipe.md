# Incident — 2026-05-18 · Wipe accidental de puntos de usuarios reales

## Resumen

Durante una operación de QA para repoblar la BD de partidos, el script
`admin-reset-matches` (endpoint temporal) borró **todas las predicciones
y `point_events` de usuarios reales** vía `DELETE FROM matches CASCADE`
y reseteó `user_points` a 0.

- **Severidad**: Alta (cualquier usuario que hubiera estado prediciendo
  perdió su histórico y puntos).
- **Producción afectada**: Sí (es prod, no había staging separado).
- **Datos perdidos**: predicciones, point_events, totalPoints/streak/
  correctCount de todos los usuarios que NO eran seed placeholders.
- **Datos preservados**: cuentas (`users`), logros (`user_achievements`),
  amistades (`friendships`), invitaciones, perfiles.

## Línea temporal

1. Petición legítima: limpiar partidos viejos del seed WC2022 para
   repoblar desde api-football con la nueva config.
2. Razonamiento: `DELETE FROM matches` con FK `onDelete: cascade` se
   llevaría predictions + point_events. Asumido OK porque las
   predictions eran sobre matches obsoletos.
3. Se ejecutó el script `dev-reset-matches.ts` vía un endpoint admin
   temporal `/api/cron/admin-reset-matches` gateado por `CRON_SECRET`.
4. El user reportó después: "se han borrado todos los datos de
   ranking de usuarios, puntuación y demás".

## Causas raíz

### Causa 1 · No distinguí QA de producción

Acepté "limpiar la BBDD" sin preguntar "¿hay usuarios reales
prediciendo ahora mismo?". El script estaba pensado para una BD de
QA donde solo viven los seeds, pero se ejecutó contra la BD de
producción donde había datos reales.

**Regla nueva**: cualquier operación destructiva sobre tablas con
datos derivados de usuarios reales (`predictions`, `point_events`,
`user_points`, `user_achievements`) requiere:
1. Una pregunta explícita "¿estás seguro? hay N usuarios reales con
   datos en esta tabla".
2. Snapshot previo (pg_dump de las tablas afectadas).
3. Documentación de qué se preservó vs qué se borró.

### Causa 2 · `user_points` se trata como BD primaria

`user_points` es una **denormalización** de `point_events`. La forma
correcta de "resetear" puntos de un usuario es:

```sql
DELETE FROM point_events WHERE user_id = ...;
-- y luego recomputar user_points desde scratch
```

NO:

```sql
UPDATE user_points SET total_points=0, streak=0, ...;
```

Este último bypassa el audit trail. Hoy se hizo lo segundo, lo cual
deja `user_points` desincronizado de su fuente de verdad (que también
se borró). Resultado: imposible recomputar sin restaurar de backup.

### Causa 3 · Endpoint admin en `main`

`/api/cron/admin-reset-matches` se desplegó en producción durante
~30 min. Aunque protegido por `CRON_SECRET`, ese secret está en
GitHub Actions y Railway. Cualquier persona con acceso a uno de los
dos podría haberlo disparado.

**Regla nueva**: endpoints destructivos NO viven en `main` jamás.
Si necesito ejecutar SQL contra prod, los caminos válidos son:
1. Conexión directa al Postgres de Railway desde mi máquina (script
   con `--confirm`), no expuesto vía HTTP.
2. Migration Drizzle versionada y revisada en PR.
3. Branch separada efímera (deploy preview de Railway) que se borra
   tras la operación.

## Mitigaciones aplicadas

- ✅ Endpoint admin borrado (commit `63f116c`, 2026-05-18).
- ✅ Script `scripts/dev-reset-matches.ts` endurecido con guard que
  cuenta usuarios reales con datos y exige `--really-prod` extra si
  detecta >0.
- ✅ Este documento como referencia operativa.

## Recuperación de los datos perdidos

El backup diario corre a las 03:00 UTC. El último backup útil sería
el de **2026-05-18 03:00 UTC** (hora del incident: ~14:00 UTC).
Restauración manual no se intentó porque el usuario indicó que sus
datos previos no eran críticos.

Para futuros incidentes de esta clase:

1. `pg_restore` solo las tablas afectadas (`predictions`,
   `point_events`, `user_points`) desde el último backup.
2. Recomputar `user_points` desde `point_events` para garantizar
   consistencia.
3. Notificar a los usuarios afectados.

## Acciones de seguimiento

- [ ] Considerar `deleted_at` (soft delete) en `matches` en vez de
      cascade hard. Preserva predictions + point_events incluso si
      un match se "borra" lógicamente.
- [ ] Job de recompute de `user_points` desde `point_events` (idempotente,
      ejecutable manualmente para detectar deriva).
- [ ] Branch `staging` con BD separada para QA destructivo.
- [ ] Documentar en `docs/security.md` el runbook "qué nunca hacer
      en prod".
