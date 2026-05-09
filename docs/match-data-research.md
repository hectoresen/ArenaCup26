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

### Sportmonks

- **URL**: https://www.sportmonks.com
- **Plan barato**: ~$15-30/mes para fútbol.
- **Cobertura Mundial**: sí.
- **Eventos live**: completo (eventos, alineaciones, lesiones).
- **WebSockets**: disponibles en planes superiores → push real-time sin polling.
- **Pros**: documentación buena, push nativo evita rate limits de polling.
- **Contras**: precio escala según dimensiones (estadísticas, alineaciones, etc.).

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

## ¿"Segundo a segundo" es realista con estos dos providers?

**No con API-Football ni Live-Score-API solos**:

- API-Football refresca cada **15 segundos** y solo expone REST. No hay WebSocket.
- Live-Score-API no documenta refresco ni WS.

Con polling REST cliente-servidor a 15 s, la **cadena completa** desde el evento real hasta el navegador del usuario es:

```
[gol real] → [API recoge dato] → [nuestro server poll] → [scoring engine] → [SSE al cliente] → [DOM]
   ~5-15s        ~0-15s                ~0-1s               ~0-1s
```

En el peor caso, **~30 segundos** de latencia visible en pantalla. En la práctica, ~10-20 s. Eso es bueno para un leaderboard pero no es "segundo a segundo".

**Para latencia sub-5 s genuina**, las opciones son:

- **Sportmonks** plan Starter+ con sus WebSocket / live-stream endpoints (~€30-50/mes).
- **AllSportsAPI** (allsportsapi.com) — anuncia "Football Push API" vía WebSocket que empuja al cliente cada vez que hay evento. Sin precios verificados aún en este doc.
- **Sportradar** o **Roanuz** — enterprise, fuera del rango €0-50/mes.

**Recomendación pragmática**: arrancar con **API-Football Pro $19** + **Live-Score-API Starter €11** como combinación redundante a 15 s. Si tras el arranque queremos verdadera latencia sub-5 s, abrir propuesta `update-match-data-providers-websocket` y migrar a Sportmonks o AllSportsAPI.

## Combinaciones recomendables

Para cumplir la **redundancia** (dos APIs simultáneas), seleccionar dos con perfiles complementarios:

| Combinación                                 | Coste/mes      | Latencia típica | Push? | Pros                                                            | Contras                                                |
| ------------------------------------------- | -------------: | --------------: | :---: | --------------------------------------------------------------- | ------------------------------------------------------ |
| **API-Football Pro + Live-Score-API Starter** | ~**$19 + €11** ≈ **€30** | 10-20 s     | No    | Cobertura sólida, dos vendors distintos, redundancia real, presupuesto contenido. | Sin WebSocket, polling 15 s. Hay que verificar la cobertura del Mundial 26 en Live-Score-API. |
| API-Football Ultra + Live-Score-API Starter | ~$29 + €11 ≈ €38 | 10-20 s    | No    | Más margen de requests para reintentos.                          | Igual que el anterior pero con coste algo mayor.       |
| API-Football Pro + Football-Data.org        |    ~$19        | 15-25 s         | No    | Backup gratis. Datos canónicos de Football-Data como reconciliación. | Football-Data tiene latencia mayor en live.            |
| Sportmonks Starter + API-Football Pro       |   ~€30 + $19 ≈ €48 | 5-10 s, sub-5 con WS | Sí (Sportmonks) | Push real-time en primaria, REST en backup. | Coste mayor. Requiere comprobar plan exacto de Sportmonks que incluya WS. |
| Football-Data.org + TheSportsDB             |        $0      | 30+ s           | No    | Cero coste.                                                     | Latencia alta, eventos live pobres. Riesgo en MVP.     |

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
