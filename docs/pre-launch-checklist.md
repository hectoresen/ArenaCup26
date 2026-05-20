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
- [x] **Smart retention** — ambos workflows aplican la regla "borra
  un backup >10d **solo si existen ≥2 más recientes**" como step
  final. Garantiza mínimo 2 backups + cobertura de los últimos 10
  días. No requiere lifecycle policy en el bucket.
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

- [x] **`processFinishedMatch` batch** ✓ 2026-05-18: pre-carga batch
  de `alreadyScored` + `streakMap` (2 queries en vez de 2×N) +
  worker pool concurrency=25. Teórico ~150s → ~6s por match con
  5k predictores.
- [x] **Lighthouse CI workflow** (`.github/workflows/lighthouse.yml`):
  audita rutas públicas (landing es, faq, legal) en cada push a main
  + manual via `workflow_dispatch`. Config en `.lighthouserc.json`
  con thresholds warning: perf ≥ 0.75, a11y ≥ 0.9, LCP ≤ 2.5s,
  CLS ≤ 0.1, TBT ≤ 300ms. Reportes como artifacts 90 días.
- [ ] **Lighthouse manual de rutas autenticadas**: `/inicio`,
  `/ranking`, `/partidos`, `/u/<username>` necesitan sesión, no
  cubiertas por el CI. Auditar a mano con Chrome DevTools en local
  apuntando a prod, con sesión activa. Revisión: TTI < 3.5s,
  LCP < 2.5s, JS bundle de cada ruta razonable (`.next/static`
  inspectable en build output).
- [ ] **CDN para assets estáticos**: revisar si Railway sirve `/icon.svg`,
  `/pwa-icon.svg`, OG image con cache adecuado. Si no, considerar
  Cloudflare delante.

## Realtime mejoras

- [x] **`add-ranking-pubsub`** ✓ 2026-05-18 / ↩︎ 2026-05-20.
  Originalmente vía pointer Redis (Upstash). Retirado el 2026-05-20
  cuando Upstash interno de Railway resultó inestable y se decidió
  no migrar a Upstash Cloud — la latencia BD→UI vuelve a ser ≤15 s,
  suficiente para "ranking en vivo" y sin dependencia externa. Ver
  `docs/data-pipeline.md §SSE` para el rationale completo.

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
