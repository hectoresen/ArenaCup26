# Pre-launch testing — validar predicciones y leaderboard antes del 11 de junio

> Estado: **estrategia abierta** (2026-05-10). Recopila enfoques candidatos. Decisión final cuando se cierre el primer prototipo end-to-end de `prediction-flow` + `scoring-engine` + `leaderboard-sse`.

El Mundial 2026 arranca el **11 de junio de 2026**. Quedan ~5 semanas. Cualquier bug crítico que aparezca durante el primer partido tiene impacto desproporcionado en confianza y retención. Este doc recoge cómo vamos a probar el producto **antes** de esa fecha, sin esperar a que el torneo real lo descubra por nosotros.

## Riesgos a mitigar

1. **Bugs de scoring en casos edge**: prórroga + penaltis, partido pospuesto/cancelado, doble predicción, combos, racha que "salta", reglas de eliminatoria.
2. **Pérdida de eventos en vivo**: dos goles seguidos en 30 s, fallo de polling, recuperación de la API tras caída.
3. **Race conditions**: 50 000 usuarios prediciendo el mismo partido y cerrando la ventana al kick-off.
4. **Failover entre APIs**: cuando API-Football falla, Live-Score-API toma el relevo y los marcadores no divergen.
5. **Discrepancias UI vs. BD**: lo que ve el usuario en el SSE coincide con lo que se ha persistido al cierre del partido.
6. **RTL en árabe**: los flujos de predicción y leaderboard se mantienen usables en árabe.

## Enfoques candidatos

### A. Replay del Mundial 2022 (recomendado como base)

**Idea**: tomar la totalidad del Mundial 2022 de Qatar (64 partidos, prórrogas, penaltis, todo el bracket) y reinyectar los eventos en nuestro sistema, acelerados o a velocidad real.

**Por qué encaja**:

- Los datos están **públicamente disponibles** (Wikipedia, FIFA, scrappable o exportable de las APIs candidatas en su modo "histórico").
- Cubre todos los casos edge reales: prórroga (Argentina-Francia final), penaltis (Croacia-Brasil cuartos), goleadas, remontadas.
- Podemos correrlo **una vez por noche** durante la fase de pruebas — cada noche, un Mundial completo simulado en X horas.

**Lo que necesitamos**:

- Capability nueva `match-data-replay`: un módulo dev/staging-only que toma un fixture grabado (`fixture.json`) y emite eventos al `scoring-engine` con timing acelerado. Bypassa las APIs externas.
- Seed con el fixture de Qatar 2022 en `seeds/wc-2022.json`.
- Comando `pnpm replay:wc2022 --speed=60x` (60 partidos por minuto, p.ej.).

**Limitaciones**: solo valida el motor de eventos y scoring; no valida la integración real con las APIs (esa es B).

### B. Beta cerrada con competición real en curso

**Idea**: el día que tengamos el primer prototipo (auth + predicción + leaderboard) usable, abrirlo a 30-50 testers reales para predecir una **competición que esté ocurriendo ahora mismo**. Hoy (mayo 2026) tenemos:

- **Champions League** — semis y final (mediados de mayo).
- **Liga doméstica** española — últimas jornadas.
- **UEFA Nations League** preparatorios al Mundial.

**Por qué encaja**:

- Datos llegan en vivo de las APIs reales (API-Football + Live-Score-API), no simulados.
- Comportamiento de usuarios reales: clicks raros, latencias variables, navegadores variados.
- Detecta bugs de UX que ningún test automatizado detecta.

**Lo que necesitamos**:

- Capability `add-match-data-providers` cerrada (pendiente).
- `add-prediction-flow` cerrada (pendiente, requiere mockup).
- Mecanismo simple de invitación cerrado (lista de emails permitidos).

**Limitaciones**: depende de tener mockups del flujo de predicción (bloqueado).

### C. Synthetic fixtures con escenarios edge

**Idea**: en dev local, una colección de fixtures sintéticos creados a mano, cada uno reproduciendo un escenario específico:

- `01-grupo-empate.json`: partido de grupos que termina en empate, predicción simple correcta y exacta.
- `02-grupo-goleada.json`: 5-0, marcador exacto ultra-difícil.
- `03-eliminatoria-prorroga.json`: 1-1 al 90', 2-1 al 120', sin penaltis.
- `04-eliminatoria-penaltis.json`: 1-1 al 90', 1-1 al 120', penaltis 4-3.
- `05-pospuesto-y-reagendado.json`: status `postponed` con cambio de `kickoff_at`.
- `06-cancelado.json`: status `cancelled`, predicción anulada, racha "salta".
- `07-doble-predicción.json`: combinaciones 1X / X2 / 12 con cada resultado posible.
- `08-combo-roto-por-doble.json`: racha de 5 con una doble en medio → bonus modificado.

**Por qué encaja**:

- Tests automatizados (Vitest) sobre el `scoring-engine` que carguen cada fixture y verifiquen los puntos resultantes.
- 100% determinista. Reproducible con cada commit.

**Lo que necesitamos**:

- `add-scoring-engine` cerrada (pendiente, no requiere diseño ni API).
- Estructura `seeds/edge-cases/*.json` y un test runner.

**Limitaciones**: no cubre el comportamiento del poller ni del SSE; solo el scoring puro.

### D. Load testing con usuarios fake

**Idea**: scripts (k6, Artillery, o Vitest custom) que poblan la BD con N usuarios y M predicciones, y golpean el endpoint de leaderboard SSE con clientes simulados.

**Por qué encaja**:

- Antes de un Mundial real con miles de usuarios concurrentes, sabemos qué carga aguantamos.
- Detecta cuellos de botella en la capa de BD, en el SSE, en la cola de polling.

**Lo que necesitamos**:

- `add-leaderboard-sse` cerrada (pendiente).
- Script de seed `seeds/synthetic-users.ts` con M usuarios y N predicciones.
- Script de carga (`k6 run scripts/load-leaderboard.js` o similar).

**Limitaciones**: requiere infra de staging que pueda soportar esa carga.

### E. Dry run el día antes (smoke test final)

**Idea**: el 10 de junio (día antes del partido inaugural), un equipo reducido prueba el flujo end-to-end sobre el entorno de producción real:

- Crear cuenta nueva.
- Predecir el partido inaugural.
- Verificar que aparece en el leaderboard.
- Verificar que el SSE llega.
- Verificar que el scoring se calcula bien tras el partido.

**Por qué encaja**:

- Última red de seguridad antes del lanzamiento.
- Detecta problemas de configuración (env vars, DNS, certificados, etc.) que no aparecen en staging.

**Limitaciones**: nada se descarta hasta este punto; cualquier bug aquí es críticamente urgente.

## Plan recomendado

Orden de implementación, dependencias en paralelo:

1. **C — Synthetic edge-case fixtures**: hazlo en paralelo con `add-scoring-engine`. **No depende de nada externo**, pura lógica. Es el primer cinturón de seguridad.
2. **A — Replay del Mundial 2022**: cuando exista `add-scoring-engine` y `add-leaderboard-sse`. Da una validación end-to-end realista sin depender de APIs.
3. **D — Load test sintético**: cuando exista `add-leaderboard-sse` y se haya elegido infra de staging.
4. **B — Beta cerrada con Champions / Liga**: cuando aterrice `add-prediction-flow` (UI). Apunta a finales de mayo.
5. **E — Dry run el 10 de junio**: el día antes del Mundial.

## Anti-patrones a evitar

- **No probar nada hasta el día 1**: el modelo "lo veré cuando llegue" tiene una probabilidad alta de regalarnos un fallo crítico durante el partido inaugural.
- **Probar solo en local**: las APIs reales se comportan distinto bajo carga. Necesitamos staging contra las claves reales.
- **Confiar en que las traducciones del FAQ son correctas sin nativo**: especialmente árabe; piezas legales (RGPD, eliminación de cuenta) deben revisarse antes del lanzamiento.

## Próximos pasos concretos sin bloqueos

Cosas que **se pueden atacar ya** y empujan esta estrategia (no dependen de diseño ni de claves API):

- `add-scoring-engine`: función pura, ya tenemos schema y reglas. Permite construir el enfoque C inmediatamente.
- `add-fixture-seed-2022`: convertir el Mundial 2022 a JSON y seedearlo en BD. Permite construir A en cuanto exista el motor.
- `add-achievements-seed`: SQL/script que siembra los 24 logros del catálogo en `achievement_definitions`. Independiente.
- `add-edge-case-fixtures`: los 8 fixtures sintéticos del enfoque C, con tests Vitest validando los puntos.

Una vez aterricen `add-match-data-providers` y `add-leaderboard-sse` (cuando se desbloqueen), conectar A, B y D viene casi gratis.
