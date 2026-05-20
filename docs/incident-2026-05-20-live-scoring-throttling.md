# 2026-05-20 — GH Actions throttling del live-scoring + retirada del cron HTTP

## TL;DR

El workflow `live-scoring.yml` con `cron: */2 * * * *` se ejecutaba
realmente cada **30-60 min** en lugar de cada 2 min durante alta carga
global de GitHub Actions. Resultado: partidos en vivo sin actualizar
en BD durante 30-60 min, marcadores y minutos del partido obsoletos
en `/inicio` y `/partidos`. Detectado durante el partido Ilves vs
Inter Turku a las 15:00 UTC (kickoff exacto).

**Resolución**: el live-scoring se movió a un **self-scheduler
in-process** dentro del proceso Node del wmundial (`setInterval` real
cada 2 min). El workflow de GH Actions + endpoint HTTP +
`RAILWAY_LIVE_URL` secret fueron eliminados completamente — pagar
tier superior de GH Actions no resuelve el problema (es limitación
de plataforma, no de pricing).

## Cronología (UTC)

| Hora       | Evento                                                                     |
|------------|----------------------------------------------------------------------------|
| 11:58      | Tick `live-scoring.yml` ejecuta (último antes del partido).                |
| 13:11      | Tick (1h 13min después, no 2 min).                                         |
| 14:08      | Tick (57 min después).                                                     |
| **15:00**  | **Kickoff Ilves vs Inter Turku** (liga finlandesa, Veikkausliiga, ID 244). |
| 15:00→15:15| 15 min de partido sin que el cron se dispare. BD = `scheduled`.            |
| 15:15      | Tick ejecuta. BD pasa a `live` con goal 0-1. Otros partidos sin score.    |
| 15:30+     | User Hector reporta: "/inicio no muestra el partido en vivo".              |
| ~15:35     | Diagnóstico vía Railway logs: el cron pinga el endpoint con cadencia ~1h. |
| ~17:00     | Commit `d9bdbf3`: self-scheduler in-process (safety + funcional).         |
| ~21:30     | Commit `1de327e`: parser fix — usar `goals` en vez de `score.fulltime`.    |
| ~22:00     | Verificado con SC Freiburg 0-2 Aston Villa min 53 — funciona.             |
| 23:00      | Commit eliminando workflow + endpoint + secret. Post-mortem cerrado.      |

## Causa raíz

Dos bugs independientes que se manifestaron a la vez:

### 1) GH Actions free tier no honra cron de alta frecuencia

GitHub Actions documenta:

> "Scheduled events can be delayed during periods of high loads of
> GitHub Actions workflow runs. High load times include the start of
> every hour."
> — [docs.github.com](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)

En la práctica, durante carga global alta los crons `*/2 min` pueden
saltar hasta una hora entre ejecuciones. Subir a tier pagado **NO
resuelve** esto — es comportamiento de la plataforma, no de pricing.

### 2) Parser leía `score.fulltime` para todos los estados

`extractScoreAt90()` del parser de api-football leía
`raw.score.fulltime` siempre que el partido no fuera scheduled. Pero
api-football reporta `score.fulltime: null` mientras el partido está
en juego — el marcador en vivo vive en `raw.goals`. Resultado: los
partidos que sí pasaban a `live` lo hacían **sin score**. Esto
amplificó la percepción del primer bug: incluso cuando el cron sí
disparaba, el `home_score`/`away_score` quedaba en NULL.

## Resolución

### a) Self-scheduler in-process

Nuevo `src/server/cron/in-process-scheduler.ts` enganchado en
`src/instrumentation.ts`. `setInterval` de 2 min reales dentro del
proceso Node:

- Llama directo a `shouldSyncLive` + `syncFixtures` +
  `triggerKickoffReminders` — sin HTTP, sin bearer.
- Tick inmediato al arranque para catch-up tras deploy.
- Idempotente (flag `started` evita doble registro).
- Cero infra adicional, cero coste.

Ver `docs/data-pipeline.md §self-scheduler` para detalles operativos.

### b) Parser corregido

`extractScoreAt90()` discrimina por estado:
- `live` / `extra_time` / `penalty_shootout` → `raw.goals`.
- `finished` → `score.fulltime` (con fallback a `goals`).
- `scheduled` / `cancelled` / `postponed` → null.

Test de regresión en `api-football.parser.test.ts` para que no
vuelva a colarse.

### c) Eliminación del cron HTTP (post-mortem cleanup)

Borrados:
- `.github/workflows/live-scoring.yml`
- `src/app/api/cron/live-scoring/` (route + handler + tests).
- Mención al secret `RAILWAY_LIVE_URL` en docs.

Acción pendiente del user: eliminar el secret `RAILWAY_LIVE_URL` en
GitHub → Settings → Secrets → Actions (cosmético, no rompe nada si
se queda).

## Lecciones

1. **GH Actions schedule no es para tiempo real**. Funciona para
   crons diarios/cada hora pero los `*/2 min` son una expectativa,
   no una garantía. Confirmado en producción, no solo en docs.
2. **Self-cron in-process es viable a esta escala** — single-instance,
   tráfico moderado, cero coste. Si crece el tráfico o pasa a
   multi-instancia, se mueve a Railway Cron service.
3. **Verificar fields del provider en estado live, no solo finished.**
   El test del parser solo cubría `fulltime` post-FT. Añadido test
   para `live 2H` que comprueba que `scoreAt90` viene de `goals`.

## Migración futura (no urgente)

Si el tick interno empezara a afectar latencia de requests web
(medible en Sentry), mover a **Railway Cron service** aislado:

```bash
railway service create --name live-scoring-cron
# Imagen pequeña: node:22-alpine + script que invoca POST contra
# /api/cron/live-scoring (sí, reintroduciríamos el endpoint si fuera
# necesario, pero solo para uso interno desde Railway).
```

Coste estimado: 3-5 €/mes con plan Hobby de Railway. Mientras tanto,
self-cron in-process cumple sobradamente.
