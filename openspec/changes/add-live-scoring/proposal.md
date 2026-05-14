# add-live-scoring

## Why

Hoy `computeProvisionalScore` solo aplica si la BD tiene `homeScore/awayScore` actualizados. Pero con cron cada 3h, durante un partido vivo la BD trae goles minutos tarde. El live card muestra `Se calcula al final` (placeholder) si no hay datos, no puntos provisionales reales.

## What changes

Capability nueva: **`live-scoring`**.

### Hot window detection

- Calcular ventana "hot": partidos con `status="live"` o `kickoff_at ± 2.5h`.
- Workflow GitHub Actions con `cron: "*/2 * * * *"` (cada 2 min) que solo se ejecuta si Hot window no vacía. Decisión: hacerlo client-side en el workflow (querying la BD via Railway) o server-side (un endpoint dedicado que devuelve "hay live" para evitar API quota).

Mejor: endpoint `/api/cron/sync-live` que solo llama `/fixtures?live=all` (1 req) y reconcilia los matches que ya están en BD con sus scores actuales. **No** crea partidos nuevos.

### Worker GitHub Actions

- `.github/workflows/sync-live.yml` cron `*/2 * * * *`.
- Llama `/api/cron/sync-live`.
- Coste: 96 req × 2 min × hora kickoff = 720 req máx pero solo durante kickoffs realistas → ~30-60 req/día.

### computeProvisionalScore

- Sigue funcionando. Solo cambia que la BD se actualiza más rápido durante el live.
- Posible feature visible: contador "puntos ahora mismo" que se actualiza vía SSE (cuando `add-leaderboard-sse` esté).

### Hot ladder

- En el panel del user, mientras hay un live, mostrar una mini-ladder con los users que están ganando puntos en ese partido en tiempo real. Reusa SSE.

## Impact

- **Coste API**: +30-60 req/día solo si hay partidos en curso. Sumado al sync principal: 100-130 req/día. Justo en el límite del free tier — verificar con métricas.
- **Bloquea**: depende de `add-leaderboard-sse` para experiencia push completa.
- **Desbloquea**: live scoring real, suspense durante kickoffs.
