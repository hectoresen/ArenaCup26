# Runbook pre-Mundial — reset y switch al torneo

> Procedimiento para resetear el estado de juego dos días antes del
> Mundial 2026 (kickoff el **11 de junio de 2026**) y dejar la app
> lista para que el torneo arranque limpio.

## Cuándo ejecutarlo

**Recomendado**: **lunes 9 de junio de 2026** (kickoff jueves 11 jun).
Margen de 48h para que:
- Los users no pierdan datos in-flight de partidos pre-Mundial todavía
  en curso.
- Si algo falla en el reset, hay tiempo de restaurar desde backup
  antes del primer partido oficial.

## Qué NO se toca

Estos datos siguen intactos para preservar el contexto social del user:

| Tabla                    | Por qué se preserva                                  |
|--------------------------|------------------------------------------------------|
| `users`                  | Cuentas, perfiles, países, avatares.                 |
| `friendships`            | Amistades aceptadas + solicitudes pendientes.        |
| `invitations`            | Links de invitación generados.                        |
| `groups`                 | Grupos privados creados por usuarios.                |
| `group_memberships`      | Pertenencia activa. Solo se limpian `frozen_*`.      |
| `teams` + `team_external_ids` | El sync los reutiliza por external_id.          |
| `achievement_definitions`| El catálogo de logros del producto.                  |
| `sessions` / `accounts`  | Sesiones Auth.js activas + OAuth Google.             |

## Qué se borra / resetea

| Tabla                | Operación                                                    |
|----------------------|--------------------------------------------------------------|
| `matches`            | DELETE all (cascade)                                         |
| `predictions`        | DELETE (cascade desde `matches`)                             |
| `point_events`       | DELETE (cascade desde `matches`)                             |
| `match_external_ids` | DELETE (cascade desde `matches`)                             |
| `user_points`        | UPDATE → totalPoints, streak, streakMax, correctCount, simpleHits = 0 |
| `user_achievements`  | DELETE all                                                   |
| `ranking_snapshots`  | DELETE all                                                   |
| `group_memberships.frozen_*` | SET NULL (limpia puntos congelados de ex-miembros)   |
| `notifications`      | DELETE huérfanas (match_id null) + scoring/achievements kinds |

## Procedimiento paso a paso

### Paso 1 · Backup completo (1 min)

Antes de tocar nada, snapshot de seguridad. Si algo va mal, restauras
y vuelves a empezar. Usamos el workflow `db-backup.yml` con
`workflow_dispatch` para forzar un dump ahora mismo y subirlo como
artifact:

```bash
# Disparar manual el workflow de backup
gh workflow run db-backup.yml
# Esperar ~2 min y comprobar
gh run list --workflow=db-backup.yml --limit 1
# (Debe aparecer en `completed success`.)
```

El backup queda subido como artifact `wmundial-backup` con retención
90 días. Si algo va mal en los pasos siguientes, lo descargas con:

```bash
gh run list --workflow=db-backup.yml --limit 5
gh run download <run-id> --name wmundial-backup --dir ./restore
zcat ./restore/wmundial-*.sql.gz | psql "$DATABASE_PUBLIC_URL"
```

El workflow scheduled (`db-backup.yml`) corre automáticamente cada
noche a las 03:00 UTC y produce otro artifact diario.

### Paso 2 · Dry-run del reset (30s)

Verifica qué va a hacer el script SIN ejecutar destructivo:

```bash
railway run --service wmundial -- \
  npx tsx scripts/dev-reset-matches.ts --for-tournament
```

Salida esperada:
```
Plan:
  1. DELETE FROM matches  (cascade → predictions, point_events)
  2. UPDATE user_points → 0/0/0/0/0  para todos los usuarios
  3. DELETE FROM user_achievements (todos los logros desbloqueados)
  4. DELETE FROM ranking_snapshots (todo el histórico de ranking)
  5. UPDATE group_memberships SET frozen_* = NULL  (limpia ex-miembros)
  6. DELETE FROM notifications  (huérfanas + scoring/achievements)

Estado actual: N usuarios REALES tienen datos de scoring.

⚠  Si ejecutas esto, ESOS usuarios pierden sus puntos.
⚠  Y también todos sus logros, historial de ranking y notificaciones.
⚠  Requiere `--confirm --really-prod` para proceder.

Ejecuta con `--confirm --really-prod --for-tournament` para aplicar.
```

Confirma que la cifra de usuarios afectados encaja con lo esperado
antes de continuar.

### Paso 3 · Ejecutar el reset (10s)

```bash
railway run --service wmundial -- \
  npx tsx scripts/dev-reset-matches.ts \
  --confirm --really-prod --for-tournament
```

Salida esperada:
```
→ Borrando matches (cascade)...
✓ matches borrados (cascade aplicó a predictions + point_events + match_external_ids).
→ Reseteando user_points para todos los usuarios...
✓ user_points reseteados.
→ Borrando user_achievements...
✓ N filas de user_achievements eliminadas.
→ Borrando ranking_snapshots...
✓ M filas de ranking_snapshots eliminadas.
→ Limpiando frozen_* en group_memberships...
✓ K membresías con frozen_* reseteado.
→ Limpiando notifications huérfanas y de scoring...
✓ P notificaciones eliminadas.

Siguientes pasos:
  1. (Si vienes de pre-Mundial) Cambia env vars Railway: ...
  2. Trigger manual del cron `match-data-sync` ...
  3. Trigger `npm run bootstrap` ...
```

### Paso 4 · Cambiar env vars Railway al modo Mundial (1 min)

```bash
railway variables --service wmundial \
  --set MATCH_DATA_MODE=season \
  --set MATCH_DATA_LEAGUE_ID=1 \
  --set MATCH_DATA_SEASON=2026 \
  --skip-deploys

# Vacía el filtro de ligas (el modo season ignora MATCH_DATA_LEAGUE_FILTER
# pero conviene limpiarlo para no llevarnos a engaño en el futuro).
# CLI no permite SET con valor vacío via --set; bórralo:
railway variables delete MATCH_DATA_LEAGUE_FILTER --service wmundial
```

⚠ Hasta el paso 7 (deploy) estas vars no se aplican.

### Paso 5 · Deploy de la app (3-5 min)

Triggea un deploy para que el wmundial recoja las env vars nuevas:

```bash
# Push vacío para forzar redeploy:
git commit --allow-empty -m "chore: switch al Mundial 2026 (reset pre-tournament)"
git push
```

Espera a que Railway termine el deploy (verás `SUCCESS` en
`railway deployments list`). El self-scheduler in-process arrancará
con la nueva configuración.

### Paso 6 · Sync inicial del calendario Mundial (~30s)

Trigger manual del cron de sync-fixtures para popular los 72 partidos
de fase de grupos del Mundial en BD:

```bash
CRON_SECRET=$(railway variables --service wmundial --kv | grep CRON_SECRET= | cut -d= -f2-)
curl -s -X POST "https://www.arenacup26.com/api/cron/sync-fixtures" \
  -H "Authorization: Bearer $CRON_SECRET" | python3 -m json.tool
```

Salida esperada (entre otros):
```
{
  "synced": true,
  "report": {
    "inserted": 72,
    "updated": 0,
    ...
  }
}
```

72 inserts cuadra con: 24 equipos × 3 jornadas de fase de grupos.

### Paso 7 · Reseed predicciones bots (1 min)

Activa el flag y dispara bootstrap para que los 27 bots predigan los
72 partidos del Mundial recién insertados:

```bash
railway run --service wmundial -- \
  SEED_BOT_PREDICTIONS=true npm run bootstrap
```

Salida esperada:
```
→ Bootstrap: seeding achievements catalog…
✓ Achievements ready (25 rows reconciled).
→ Bootstrap: migrating old leaderboard placeholders…
✓ No legacy placeholders to remove.
→ Bootstrap: seeding 27 bot users…
✓ Bots reconciled — created=0, updated=27.
→ Bootstrap: seeding bot predictions (SEED_BOT_PREDICTIONS=true)…
✓ Bot predictions — created=1944, matches=72, bots=27.
→ Bootstrap: backfilling team-spirit ...
✓ Team-spirit backfilled for 0 user(s).
```

`27 bots × 72 partidos = 1944 predicciones` cuadra.

### Paso 8 · Verificación (5 min)

Comprueba en producción:

```bash
PG_URL=$(railway variables --service Postgres --kv | grep DATABASE_PUBLIC_URL= | cut -d= -f2-)
DATABASE_URL="$PG_URL" psql -c "
SELECT
  (SELECT COUNT(*) FROM matches) AS total_matches,
  (SELECT COUNT(*) FROM matches WHERE stage = 'group') AS group_matches,
  (SELECT COUNT(*) FROM predictions) AS total_predictions,
  (SELECT COUNT(*) FROM user_points WHERE total_points > 0) AS users_with_points,
  (SELECT COUNT(*) FROM user_achievements) AS achievements_unlocked,
  (SELECT COUNT(*) FROM ranking_snapshots) AS history_rows;
"
```

Resultados esperados:
- `total_matches`: 72 (solo grupos a partir del switch; cuartos+ se irán
  sincronizando conforme api-football los publique post-bracket).
- `group_matches`: 72.
- `total_predictions`: 1944 (todas de bots; humanos predecirán cuando
  abran la app y elijan).
- `users_with_points`: 0 (nadie aún; primer partido no ha sido jugado).
- `achievements_unlocked`: 0.
- `history_rows`: 0.

En la app:
- `/inicio`: live card vacía (no hay live aún), próximo partido = Mexico
  vs South Africa el 11 jun.
- `/partidos`: 72 cards, todas scheduled.
- `/ranking`: top 100 con todos los users + 27 bots, todos a 0 pts.

Si algo no cuadra → restaurar backup del paso 1:
```bash
pg_restore --clean --no-owner -d "$PG_URL" backup-pre-mundial-*.dump
```

## Resultados esperados post-reset

- ✅ 5 usuarios reales con cuentas activas, 0 puntos, 0 logros, 0
  predicciones. Amistades y grupos intactos.
- ✅ 27 bots con 0 puntos pero 72 predicciones precargadas (que se
  scorearán según se vayan jugando los partidos).
- ✅ 72 fixtures del Mundial 2026 fase de grupos cargados en BD.
- ✅ El self-scheduler in-process arrancará a actualizar marcadores
  cada 2 min cuando el primer partido entre en ventana `±15/30 min`
  de kickoff.
- ✅ Las cards live de `/inicio` y `/partidos` se activarán automático.

## Próximas fases del torneo

api-football publica los fixtures de eliminatorias DESPUÉS de que se
defina el bracket en el campo (no hay equipos en cuartos hasta que
acabe la fase de grupos). El cron `match-data-sync` (cada 3h) los
traerá a BD a medida que aparezcan. Los bots NO predicen eliminatoria
por diseño — sus puntos quedan congelados.

## Rollback

Si por algún motivo necesitas deshacer el switch (e.g. error en el
flag MATCH_DATA_MODE):

```bash
# 1. Revertir env vars al modo date-window
railway variables --service wmundial \
  --set MATCH_DATA_MODE=date-window \
  --set MATCH_DATA_LEAGUE_FILTER=140,39,135,78,61,2,3,253,71,128,218,13,11,307,88,144,255,106,197,103,244,98,292

# 2. Restaurar BD desde el backup del paso 1
PG_URL=$(railway variables --service Postgres --kv | grep DATABASE_PUBLIC_URL= | cut -d= -f2-)
gh run list --workflow=db-backup.yml --limit 5
gh run download <run-id-del-paso-1> --name wmundial-backup --dir ./restore
zcat ./restore/wmundial-*.sql.gz | psql "$PG_URL"

# 3. Trigger redeploy
git commit --allow-empty -m "chore: rollback pre-Mundial switch"
git push
```

Si quieres ver el sistema de backups en detalle (cadencia diaria
03:00 UTC + cadencia 6h durante el Mundial vía
`db-backup-tournament.yml`), consulta `docs/backups.md`.

## Referencias

- Script: [`scripts/dev-reset-matches.ts`](../scripts/dev-reset-matches.ts)
- Bootstrap: [`scripts/bootstrap.ts`](../scripts/bootstrap.ts)
- Bots: [`docs/bots.md`](bots.md)
- Pipeline de datos: [`docs/data-pipeline.md`](data-pipeline.md)
- Switch api-football: [`docs/api-football-config.md`](api-football-config.md)
- Incidente original que motivó el guardrail: [`docs/incident-2026-05-18-data-wipe.md`](incident-2026-05-18-data-wipe.md)
