# Match data — pre-análisis de fuentes

> Estado: **DECISIÓN CRÍTICA PENDIENTE**. El equipo evaluará las APIs candidatas. Sin esta decisión no se puede arrancar la capability `match-data` ni el modo en vivo de `scoring-engine` y `leaderboard`.

## Requisitos derivados del scope

1. **Cobertura completa del Mundial 26** — los 64 partidos, todas las fases (grupos, eliminatorias, prórroga, penaltis).
2. **Fixture programable** — disponible al inicio del torneo para sembrar la BD.
3. **Resultados oficiales** al cierre de cada partido (marcador final).
4. **Eventos en vivo durante el partido** — goles, autogoles, prórroga, penaltis. **Requisito clave** para:
   - Leaderboard que se mueve mientras se juegan los partidos.
   - Preview "vas a ganar +X puntos si termina así" en el dashboard del usuario.
   - Feed de actividad in-app con cambios de posición en tiempo real.
5. **Latencia razonable**: ≤ 30 s entre el evento real y la actualización en la web.
6. **Redundancia**: usaremos **dos APIs en paralelo**. Si la primaria deja de responder durante un partido, la secundaria toma el relevo automáticamente.

## APIs candidatas

### Football-Data.org

- **URL**: https://www.football-data.org
- **Plan gratis**: 10 req/min, competiciones top.
- **Cobertura Mundial**: por verificar (habitualmente sí).
- **Eventos live**: limitados en plan gratis; cambios con cierta latencia.
- **Pros**: gratis, REST estándar, registro inmediato.
- **Contras**: rate limit muy bajo para polling agresivo; eventos en vivo escasos.

### API-Football (api-sports.io)

- **URL**: https://www.api-football.com — documentación en https://www.api-football.com/documentation-v3
- **Investigado** 2026-05-09 (vía SportsAPI directory + WebSearch; el dominio bloquea WebFetch directo con 403/Cloudflare).

**Planes** (precios oficiales, USD/mes):

| Plan       | USD/mes | Requests/día | Notas                                  |
| ---------- | ------: | -----------: | -------------------------------------- |
| Free       |     $0  |        100   | Insuficiente para producción.          |
| Pro        |    $19  |      7 500   | Roza el límite con varios partidos en paralelo a 15 s de polling. |
| Ultra      |    $29  |     75 000   | Cómodo para todo el Mundial.           |
| Mega       |    $39  |    150 000   | Sobrado, incluye margen para retries.  |

**Datos en vivo**:

- **Refresco oficial**: cada **15 segundos**. El endpoint `fixtures/live` y `fixtures/events` reflejan los cambios con esa cadencia. No es "segundo a segundo" — es una cadencia útil, pero no instantánea.
- **WebSocket**: **NO disponible**. La API es REST puro; el cliente debe hacer polling. Confirmado en su documentación pública (no se anuncia push protocol).
- **Endpoints relevantes**: `fixtures` (lista/filtrado), `fixtures/live`, `fixtures/events`, `fixtures/lineups`, `fixtures/statistics`, `odds`.

**Datos incluidos en TODOS los planes pagos** (por la página oficial):

- Livescore, Lineups, Schedules and Results, Stats, Live Stats, Historical Data, Pre-Match Odds, Inplay Odds, Predictions.
- "Todos los planes pagos incluyen todas las competiciones" — el Mundial no requiere plan superior.

**Cobertura del Mundial 2026**:

- FIFA World Cup está listado en su página `coverage`. Aún por verificar en sandbox que el fixture 2026 ya esté sembrado y con qué `league_id`.

**Cálculo aproximado de presupuesto de requests** (para planificar):

- 64 partidos del Mundial ≈ 90 minutos cada uno.
- Polling de 15 s sobre N partidos en vivo simultáneos = 4 req/min/partido = 360 req/partido (90 min).
- Pico típico del Mundial: 1-4 partidos en paralelo. Pico = ~1 440 req durante esa franja.
- Total torneo: ~64 × 360 = 23 040 req solo de polling de partidos en vivo, repartidos en 5 semanas ≈ 4 600/día de media. **Plan Pro $19 sirve**, pero con poco margen para fixture, eventos auxiliares y reintentos. **Plan Ultra $29** es el sweet spot para producción.

**Pros**: rica en eventos detallados (goleadores, tarjetas, sustituciones, alineaciones), todos los planes incluyen todas las competiciones, comunidad amplia, documentación accesible.

**Contras**: solo polling REST (sin WS), refresco 15 s no es instantáneo, dominio detrás de Cloudflare anti-bot (no afecta a la API en sí pero sí a la web).

### Live-Score-API

- **URL**: https://live-score-api.com — pricing https://live-score-api.com/prices
- **Investigado** 2026-05-09 vía WebFetch directo a `/prices`.

**Planes** (precios oficiales, EUR/mes):

| Plan         | EUR/mes | Requests/día | Overage   | Notas                              |
| ------------ | ------: | -----------: | :-------: | ---------------------------------- |
| Trial        |     €0  |       1 500  |    —      | 14 días, para evaluación.          |
| Starter      |    **€11** |    14 500  | €0.002/req | El plan que tú mencionabas.        |
| Professional |    €26  |      50 000  | €0.001/req | Equivalente al Ultra de API-Football. |
| Premium      |    €69  |      75 000  | €0.001/req | Más cómodo, soporte priorizado.    |
| Commentary   |   €190  |     100 000  | €0.001/req | Incluye narración minuto a minuto. |
| Custom       |   N/D   |       Custom |   Custom  | Negociable enterprise.             |

**Qué incluye el plan Starter €11/mes** (verificado en su página de pricing):

- Live scores, Match Events (goles, tarjetas, sustituciones), Live commentary, Fixtures, Standings, Live standings, Historical data, Pre-match odds, In-play odds, Team/Country/Competition data, Translations, Statistics, Lineups, Head-to-head, Top goalscorers.
- Soporte por email con 2 días de SLA.
- **Sí incluye datos en vivo**: con €11 ya tienes acceso a livescore + match events + lineups + statistics. No hace falta subir a planes superiores para tener "lo en vivo".

**Refresco / latencia**:

- **Refresco oficial**: **NO publicado** en su pricing ni en `/help` (que devuelve 404). Habría que pedirles los detalles por email o sacarlos del sandbox del plan Trial.
- Su nav promociona "real-time results" pero sin compromiso medible.

**WebSocket / push**:

- **NO documentado**. Su pricing y documentación pública NO mencionan WebSocket, Webhook, ni ningún protocolo push. La API parece ser REST puro con polling cliente.
- Referencias genéricas en blogs ("algunas live-score APIs ofrecen 1 s de refresco vía WS") **NO son específicas de live-score-api.com** — no se confirman para este proveedor.

**Cobertura del Mundial 2026**:

- "World Cup API" aparece destacado en su menú principal, pero **no hay confirmación explícita** del fixture del Mundial 2026 en su material público. Verificar en Trial.

**Pros**: precio bajo de entrada (€11), planes con overage por request (no se "rompe" si te pasas), incluye lineups y commentary desde Starter.

**Contras**: opacidad en latencia/refresh rate, sin WebSocket documentado, falta confirmación oficial de cobertura del Mundial 2026.

### Sportmonks (planes específicos del Mundial 26)

- **URL**: https://www.sportmonks.com/football-api/world-cup-api/world-cup-2026/
- **Investigado** 2026-05-09 vía WebFetch + WebSearch.

Sportmonks ofrece **dos planes específicos para el Mundial 2026** (separados de su catálogo estándar de fútbol completo):

| Plan          | Mensual  | Anual (mes equivalente) | Incluye                                                                                                          |
| ------------- | -------: | ----------------------: | ---------------------------------------------------------------------------------------------------------------- |
| **Advanced**  | **€69**  | €55/mo (anual)         | Fixtures, live scores, in-game events, squads, standings, bracket data, player stats. **Plan que tú creaste cuenta.** |
| All-In        | €129     | €103/mo (anual)        | Todo lo del Advanced **+** predictions, xG (expected goals), Pressure Index, odds pre-match e in-play de 50+ casas. |

**Cobertura del Mundial 2026** (verificado en su web):

- Cobertura completa de los **104 partidos** (formato 48 equipos del Mundial 26).
- Tres países anfitriones (USA, Canadá, México) con sus zonas horarias.
- Datos en vivo: **"actualizados en menos de 15 segundos"** según su web.
- Goles, tarjetas, sustituciones, penaltis y prórroga.
- 99,99% de uptime con verificación multi-fuente 24/7.

**WebSocket / Pusher** (⚠️ pendiente de confirmar):

- **NO documentado públicamente** en los planes World Cup. Su web habla solo de REST y "livescore API".
- Sportmonks históricamente ofrece **Pusher** (canal pub/sub, no WebSocket puro) en algunos planes premium del catálogo estándar — pero **no se confirma para los planes World Cup**.
- **Acción para ti**: en el dashboard de tu cuenta, comprobar si el plan Advanced €69 expone "Pusher", "Streaming", "Push" o "Webhooks" en la sección de credenciales/integraciones. Si NO lo expone, es polling REST puro.

**Cálculo de presupuesto del Advanced €69 mes**:

- 104 partidos × ~90 min × 4 polls/min (15 s) = ~**37 500 polls** sobre datos en vivo durante todo el torneo.
- Pico: 4 partidos en paralelo durante 90 min = ~1 440 polls/cluster — sobrado en cualquier plan de Sportmonks.

**Pros**: plan dedicado al Mundial → coverage garantizada y por escrito en su web; precio fijo por torneo; vendor único (sin gestionar dos contratos durante el Mundial). El All-In a €129 añade xG y predictions si los queremos para encuestas/proyecciones.

**Contras**: si su web dice solo "REST" y el dashboard no expone Pusher, no tenemos ventaja sobre API-Football a 15 s. Si lo expone, **es la única opción asequible con push real**.

### Sportmonks (catálogo estándar — referencia)

Por completitud, los planes estándar de Sportmonks Football (fútbol completo, no solo Mundial):

| Plan        | Mensual   | Ligas          | Notas                                |
| ----------- | --------: | -------------: | ------------------------------------ |
| Starter     | €29       | 5              | Insuficiente, no incluye el Mundial. |
| Growth      | €99       | 30             | Hay que verificar si incluye WC.     |
| Pro         | €249      | 120            | Sobredimensionado para nuestro alcance. |
| Enterprise  | Custom    | 2 300+         | Out of scope.                         |

Conclusión: para nuestro caso, el plan **Advanced World Cup €69** es el match perfecto a nivel de cobertura. La duda crítica es si trae push.

### Sportradar

- **URL**: https://sportradar.com
- **Plan**: enterprise, contacto comercial.
- **Cobertura**: el oro estándar del mercado.
- **Pros**: usado por casas oficiales y broadcasters.
- **Contras**: sobredimensionado y caro para nuestro proyecto. Probablemente fuera de presupuesto.

### TheSportsDB

- **URL**: https://www.thesportsdb.com
- **Plan gratis**: comunidad, datos crowd-sourced.
- **Cobertura Mundial**: sí, pero con latencia.
- **Eventos live**: limitados, no fiables.
- **Pros**: gratis, sin registro estricto.
- **Contras**: calidad variable; no apto para producción crítica.

## ¿"Segundo a segundo" es realista con estos providers?

**Refresco confirmado** (todos REST polling, salvo verificación pendiente en Sportmonks dashboard):

| Provider              | Refresco oficial | WebSocket / Push        |
| --------------------- | :--------------: | :---------------------: |
| API-Football          | 15 s             | ❌ Solo REST            |
| Live-Score-API        | No publicado     | ❌ No documentado       |
| Sportmonks WC €69     | < 15 s           | ⚠️ Pendiente verificar en dashboard |

Con polling REST cliente-servidor a 15 s, la **cadena completa** desde el evento real hasta el navegador del usuario es:

```
[gol real] → [API recoge dato] → [nuestro server poll] → [scoring engine] → [SSE al cliente] → [DOM]
   ~5-15s        ~0-15s                ~0-1s               ~0-1s
```

En el peor caso, **~30 segundos** de latencia visible en pantalla. En la práctica, ~10-20 s. Aceptable para un leaderboard. **No es "segundo a segundo"** salvo que Sportmonks Advanced exponga Pusher en tu dashboard.

**Para latencia sub-5 s genuina** las opciones realistas hoy son:

- **Sportmonks** Advanced €69 **si expone Pusher/Streaming en el dashboard**. Hay que verificar.
- **AllSportsAPI** (allsportsapi.com) — anuncia "Football Push API" vía WebSocket. Precios sin verificar aún.
- **Sportradar** o **Roanuz** — enterprise, fuera del rango €0-100/mes.

## Combinaciones recomendables

Para cumplir la **redundancia** (dos APIs simultáneas), seleccionar dos con perfiles complementarios:

| Combinación                                                       | Coste/mes               | Latencia típica           | Push?                | Pros                                                                                       | Contras                                                                  |
| ----------------------------------------------------------------- | ----------------------: | ------------------------: | :------------------: | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **API-Football Pro + Live-Score-API Starter**                     | $19 + €11 ≈ **€30**     | 10-20 s                   | No                   | Presupuesto bajo, dos vendors distintos, redundancia real.                                 | Sin push. Verificar cobertura WC en Live-Score-API.                      |
| Sportmonks WC Advanced solo                                       | **€69** (€55 anual)     | 10-20 s · sub-5 si hay WS | ⚠️ verificar dashboard | Plan dedicado al Mundial, 104 partidos garantizados por contrato, único vendor.            | Sin redundancia (vendor único). Si cae Sportmonks durante un partido, no hay backup. |
| **Sportmonks WC Advanced + Live-Score-API Starter**               | €69 + €11 = **€80**     | 10-20 s · sub-5 si Sportmonks tiene WS | ⚠️ posible           | Cobertura WC garantizada por contrato + redundancia con vendor distinto + presupuesto razonable. | Coste mayor que la primera fila.                                         |
| Sportmonks WC Advanced + API-Football Pro                         | €69 + $19 ≈ **€88**     | 10-20 s                   | ⚠️ posible           | Las dos APIs más completas en eventos detallados.                                          | Coste mayor; misma latencia salvo que Sportmonks tenga Pusher.           |
| Sportmonks WC All-In                                              | €129 (€103 anual)       | 10-20 s                   | ⚠️ verificar         | Añade xG, predicciones, odds → útil si queremos encuestas tipo "¿cuántos goles?"            | Caro para fase 1; sin redundancia.                                       |
| API-Football Pro + Football-Data.org                              | ~$19 ≈ €18              | 15-25 s                   | No                   | Backup gratis.                                                                              | Football-Data lento en live.                                             |
| Football-Data.org + TheSportsDB                                   | $0                      | 30+ s                     | No                   | Cero coste.                                                                                 | Latencia alta, eventos pobres. Riesgo MVP.                              |

## Preguntas para tomar la decisión

1. **¿Qué presupuesto mensual asumimos?** — Define qué planes son realistas (gratis vs €30 vs €50+).
2. **¿Es aceptable 10-20 s de latencia en vivo, o queremos sub-5 s real?** — Si es lo primero, sirve la combinación API-Football Pro + Live-Score-API Starter (€30/mes total). Si es lo segundo, hay que mirar Sportmonks o AllSportsAPI con WebSocket.
3. **¿La API cubre prórrogas y penaltis del Mundial?** — Verificar en sandbox antes de comprar.
4. **¿Necesitamos eventos detallados** (goleadores, asistentes, tarjetas) o basta con marcador en vivo? — Afecta a encuestas tipo "¿quién marcará primero?" y al feed de actividad.
5. **Política de reconciliación**: si las dos fuentes discrepan en marcador, ¿cuál gana? ¿La más reciente, la primaria, la mayoría?
6. **Caching y rate-limit**: ¿polling desde el server con queue o WebSockets cuando estén disponibles?

## Pasos siguientes

1. Solicitar trial / claves de API en al menos dos candidatas (recomendado: API-Football y Sportmonks).
2. Probar fixture del Mundial 26 en sandbox: comprobar IDs, estructura, latencia, formato de eventos.
3. Decidir presupuesto.
4. Cerrar decisión y abrir propuesta `add-match-data-providers` que defina:
   - Adapter pattern con interfaz común (`MatchDataProvider`).
   - Implementación de los dos providers seleccionados.
   - Política de failover y reconciliación.
   - Caching y rate-limit handling.
