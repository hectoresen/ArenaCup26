# Pre-launch checklist — ArenaCup26

Lista canónica de lo pendiente antes (y durante) del Mundial 2026.
Actualizar a medida que se resuelven items. Para histórico y deltas
ver `docs/roadmap.md`.

Última actualización: 2026-05-18.

## Dominios

- [ ] **DNS de `arenacup26.es`** en Arsys.
  - CNAME `www.arenacup26.es` → `if6qrgw3.up.railway.app`
  - TXT `_railway-verify.www.arenacup26.es` → `railway-verify=2a976c257f712873af7290cf484a0cdd8140cd6005e5b92aca4066432ccda59d`
- [ ] **Apex `arenacup26.com`** sin enrutar. Decidir entre:
  - Camino A: migrar DNS a Cloudflare → CNAME flattening + 301 nativo.
  - Camino B: aceptar `www.` como canónico definitivo y olvidar apex.
- [ ] **`arenacup26.eu` y `arenacup26.online`** parked. Necesitan upgrade
  del tier de Railway (2 custom domains max actualmente) o URL forwarding
  desde Arsys cuando lo soporten.

## Monitoring + Observabilidad

- [ ] **Activar Sentry**. Ver "Walkthrough Sentry" abajo. Sin esto el
  monitoring está en noop y los errores en producción son ciegos.
- [ ] **Sentry rebrand cosmético**: tras crear la cuenta, actualizar
  `next.config.ts:163-164` (`org: "webmundial-26"`, `project: "webmundial"`)
  a los slugs reales de ArenaCup26.
- [ ] **Alerta de cron failures**: configurar regla en Sentry para que
  3 fallos consecutivos de `match-data-sync` o `live-scoring` notifiquen
  por email o Slack. Sin esto, un cron caído pasa desapercibido durante días.
- [ ] **Monitor de cuota api-football**: alerta cuando `requests/day >
  6000` (80% del límite Pro de 7500). Hoy no hay forma de saberlo
  sin entrar al dashboard del provider.

## Backups durante el Mundial

- [x] **Cadencia elevada en torneo** — workflow `db-backup-tournament.yml`
  cada 6h con date guard (11 jun → 19 jul 2026), sube a prefijo
  `tournament/`. El daily `db-backup.yml` sigue activo en paralelo.
- [ ] **Lifecycle policy del bucket**: configurar borrado automático
  de `tournament/*` tras 14 días para que ~150 backups no se acumulen.
- [ ] **Probar el restore al menos una vez** antes del kickoff. Sin
  validación, los backups son confianza ciega.
- [x] **Script `recompute-user-points.ts`** idempotente que recalcula
  `user_points` desde `point_events`. Action item del incidente
  2026-05-18. Uso dry-run por defecto; `--apply` persiste.

## Entorno de staging

- [ ] **Montar staging real**. Hoy `main = prod`. Opciones:
  - Railway "PR Environments" (auto-spinea BD + service por PR).
  - Segundo proyecto Railway "arenacup26-staging" con env vars duplicadas.
  Sin staging, cualquier op destructiva tiene riesgo neto > 0.

## Performance y escala

- [ ] **`processFinishedMatch` batch**: hoy itera user-por-user. Con
  5k predictores en un match son 5k iteraciones secuenciales (~30-60s).
  Si 4 matches terminan a la vez, cuello de botella real. Refactor
  a procesado batch + commit por chunks.
- [ ] **Performance audit pre-launch**: Lighthouse mobile, TTI, LCP.
  Especialmente con el calendario completo del Mundial (104 partidos)
  cargando en `/partidos` aunque el LIMIT 250 lo cubre.
- [ ] **CDN para assets estáticos**: revisar si Railway sirve `/icon.svg`,
  `/pwa-icon.svg`, OG image con cache adecuado. Si no, considerar
  Cloudflare delante.

## Realtime mejoras

- [ ] **`add-ranking-pubsub`** (OpenSpec abierto en
  `openspec/changes/add-ranking-pubsub/`). Bajaría latencia del ranking
  de 15s → sub-segundo. Requiere investigar si Upstash REST soporta
  `SUBSCRIBE` o si toca polling de key con TTL corto. ½ día.

## Producto

- [ ] **Bloque G — País por IP** (en `docs/roadmap.md`): decisión
  pendiente. Hoy el onboarding requiere selección manual de país.

## Operacional manual

- [ ] **Rotación periódica de secrets**: AUTH_SECRET, CRON_SECRET,
  GOOGLE_CLIENT_SECRET. Recomendable cada 6 meses; obligatorio si
  hay sospecha de filtración.
- [ ] **Plan de respuesta a incidentes**: quién contesta a
  `contact@arenacup26.com` durante el Mundial. Si llegan reportes
  de bug a las 22:00 de un día de partido, ¿hay alguien atendiendo?

## Done este sprint (referencia)

- ✅ Rebrand `webmundial26` → `arenacup26` (2026-05-15+).
- ✅ Plan Pro de api-football activado + IPs allowlist vacía.
- ✅ Crons reactivados (sync cada 3h, live cada 2 min).
- ✅ Bug del SSE controller cleanup arreglado.
- ✅ Bug del 204+body en live-scoring arreglado.
- ✅ Endpoint admin destructivo eliminado + guard en script.
- ✅ Post-mortem incident docs/incident-2026-05-18-data-wipe.md.
- ✅ Push activado en 5/7 kinds (faltan solo `system` no aplica y
  `prediction_locked` que es nuevo — kickoff reminder).
- ✅ Kickoff reminder cron piggyback en live-scoring.
- ✅ `/status` pingea api-football real con timeout 3s.
- ✅ Cooldown UI countdown para nombre/avatar.
- ✅ Email `contact@arenacup26.com` integrado en legales + footer + VAPID.
- ✅ /partidos ordenado por relevancia + LIMIT 250.
- ✅ Favicon transparente + OG image + Apple icon.
