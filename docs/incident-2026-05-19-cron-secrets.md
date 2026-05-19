# Incident 2026-05-19 — Crons sin secretos + Railway outage

## TL;DR

Tras el rediseño de los workflows (`live-scoring.yml` y `match-data-sync.yml`)
del 18-may, los secrets `RAILWAY_LIVE_URL` y `RAILWAY_SYNC_URL` **nunca se
configuraron en GitHub Actions**. Resultado: cero llamadas a los endpoints
de cron durante ~32 horas. Coincidió además con un outage global de
Railway (backboard 503) que impidió validar el fix en directo.

Síntomas reportados por el usuario:
- Arsenal-Burnley (18-may) finished en BD pero sin scoring — historial lo
  pintaba como "Pendiente".
- Partidos de hoy 18:30/19:15 UTC también finished sin scoring (los vio
  más tarde como "Premier 20:30/21:15" hora local).
- Partido a las 22:00 UTC que ya había empezado seguía como "Pronto" en
  /inicio.

## Cronología

| UTC          | Evento                                                                 |
|--------------|------------------------------------------------------------------------|
| 18-may 13:00 | Última ráfaga de updates a `matches` (81 filas). Sync funcionó.        |
| 18-may post-13:00 | Reactivación de los workflows live-scoring + match-data-sync.     |
| 18-may → 19-may 21:35 | Cero updates a `matches`. Cron caído silenciosamente.        |
| 19-may 21:35 | Sync manual via curl (Claude) → 31 inserts, 14 updates. Triggered scoring de matches finished sin point_events. |
| 19-may 21:50 | Deploy 8408dd9c (commit 43960a5: self-healing scoring) → SUCCESS.      |
| 19-may 22:10 | User configura `RAILWAY_SYNC_URL` y `RAILWAY_LIVE_URL` en GH Secrets.  |
| 19-may 22:10 | `Match data sync` workflow OK. `Live scoring` falla con `curl 60` SSL. |
| 19-may 22:20 | Railway entera empieza a fallar (backboard 503, app 502/timeout).      |

## Root cause

1. **Cron silencioso**: los workflows de GitHub Actions tenían un check
   defensivo `if [ -z "$URL" ]; then exit 1; fi`, pero al no estar
   configurado el secret, el workflow exit 1 desde el 18-may. Sin
   Sentry/Slack alerts conectados a "GitHub Actions failure", nadie se
   enteró.
2. **SSL error**: el secret `RAILWAY_LIVE_URL` que el user puso da
   `curl: (60) SSL: no alternative certificate subject name matches target
   host name 'www.arenacup26.com'`. Desde mi máquina `openssl s_client`
   confirma que `www.arenacup26.com` SÍ tiene SAN válido. Sospecha: copy/paste
   añadió whitespace / CRLF al final del secret. Workflows actualizados para
   imprimir `Target host` + byte-count y diagnosticarlo rápido.
3. **Bug derivado**: matches que pasaban `live → finished` mientras el
   cron estaba caído quedaban en BD con `status='finished'` pero sin
   `point_events` para las predicciones existentes. El sync posterior
   no detectaba la transición porque `current.status` ya era `finished`.
   **Fix**: commit `43960a5` añadió un sweep self-healing.

## Fixes aplicados

- `43960a5` — `fix(sync): self-healing scoring para matches finished con preds huérfanas`.
- `119ad64` — `fix(dashboard): polling también pre-kickoff para capturar scheduled→live`.
- `57f4c53` — `chore(cron): diagnóstico de host + script smoke-test api-football`.

## Lo que queda PARA MAÑANA

### Cuando Railway esté de vuelta

1. **Verificar el secret SSL**:
   - Ir a GitHub → Settings → Secrets → Actions → `RAILWAY_LIVE_URL`.
   - Borrarlo y crearlo de nuevo escribiendo `https://www.arenacup26.com/api/cron/live-scoring`
     a mano (no copy/paste, evitar CRLF).
   - Ejecutar `Live scoring` workflow manualmente. El log ahora dirá
     `Target host: 'www.arenacup26.com' (URL bytes: 53)`. Si bytes != 53
     hay caracteres extra.

2. **Disparar smoke-test api-football**:
   ```bash
   railway run -- npx tsx scripts/test-api-football.ts
   ```
   Confirma que la cuota es razonable, que las ligas devuelven fixtures, y
   que hay fixtures con status `LIVE` / `FT` en curso.

3. **Disparar sync manual** (curl con CRON_SECRET):
   ```bash
   SECRET=$(railway variables --service wmundial --json | jq -r .CRON_SECRET)
   curl -sS -X POST -H "Authorization: Bearer $SECRET" https://www.arenacup26.com/api/cron/sync-fixtures | jq
   curl -sS -X POST -H "Authorization: Bearer $SECRET" https://www.arenacup26.com/api/cron/live-scoring | jq
   ```
   El primero hace ventana ±1/+7d con 12 ligas. El segundo respeta
   `shouldSyncLive` — devolverá `synced: false` si no hay live ni
   kickoff próximo.

4. **Verificar en BD** que el sweep self-healing tiene 0 hits:
   ```sql
   SELECT m.id, m.status, ht.name AS home, at.name AS away,
          (SELECT count(*) FROM predictions p WHERE p.match_id = m.id) AS preds,
          (SELECT count(*) FROM predictions p
             WHERE p.match_id = m.id
               AND NOT EXISTS (
                 SELECT 1 FROM point_events pe
                 WHERE pe.match_id = p.match_id AND pe.user_id = p.user_id
               )) AS unscored
   FROM matches m
   LEFT JOIN teams ht ON ht.id = m.home_team_id
   LEFT JOIN teams at ON at.id = m.away_team_id
   WHERE m.status = 'finished'
     AND m.kickoff_at > now() - interval '7 days'
   ORDER BY m.kickoff_at DESC;
   ```

5. **Configurar también** los secrets de los otros 2 workflows que aún
   los necesitan (siguen exit 1 por la misma razón):
   - `RAILWAY_AUTO_REJECT_URL` → `https://www.arenacup26.com/api/cron/auto-reject-bot-requests`
   - `RAILWAY_SNAPSHOT_URL` → `https://www.arenacup26.com/api/cron/snapshot-ranking`

### Mejoras de prevención (no urgente)

- Conectar Sentry a "GitHub Actions workflow failed". Hoy no nos enteramos
  durante 32h. Mismo principio que la regla de "3 fallos seguidos del cron".
- Considerar un endpoint `/api/health/cron` que devuelva
  `{ last_sync: <ts>, last_live: <ts>, stale: bool }` y un check externo
  (UptimeRobot, etc.) que avise si `stale=true`.
- Ampliar `POST_KICKOFF_WINDOW_MIN` de 30 a 120 min para que un cron que
  ha estado caído un par de horas recupere las transiciones perdidas en
  el siguiente tick (hoy quedan colgadas).
