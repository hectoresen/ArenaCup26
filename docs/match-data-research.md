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

### API-Football (RapidAPI)

- **URL**: https://www.api-football.com
- **Plan gratis**: 100 req/día (insuficiente para producción).
- **Plan Pro**: ~$10/mes, 7 500 req/día.
- **Plan Ultra**: ~$25/mes, 75 000 req/día.
- **Cobertura Mundial**: sí (FIFA World Cup en su catálogo).
- **Eventos live**: `fixtures/events` con goles, tarjetas, sustituciones en tiempo casi-real.
- **Pros**: rica en eventos, comunidad amplia, documentación.
- **Contras**: vendor RapidAPI, ToS variable.

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

## Combinaciones recomendables

Para cumplir la **redundancia** (dos APIs simultáneas), seleccionar dos con perfiles complementarios:

| Combinación                                 | Coste/mes | Pros                                                            | Contras                                                |
| ------------------------------------------- | --------: | --------------------------------------------------------------- | ------------------------------------------------------ |
| API-Football + Football-Data.org            |     ~$10  | Eventos live de calidad en primaria; backup gratis garantizado. | Football-Data tiene latencia mayor en live.            |
| Sportmonks + API-Football                   |   ~$25-40 | Máxima resiliencia, datos cruzables para reconciliación.        | Coste mayor; dos vendors de pago.                      |
| Football-Data.org + TheSportsDB             |        $0 | Cero coste.                                                     | Latencia alta, eventos live pobres. Riesgo en MVP.     |
| Sportmonks + Sportmonks (regiones distintas)|     ~$30  | Failover dentro del mismo vendor (evita discrepancias).         | Si Sportmonks cae globalmente, no hay failover real.   |

## Preguntas para tomar la decisión

1. **¿Qué presupuesto mensual asumimos?** — Define qué planes son realistas (gratis vs ~$10 vs ~$30+).
2. **¿La API cubre prórrogas y penaltis del Mundial?** — Verificar en sandbox antes de comprar.
3. **¿Necesitamos eventos detallados** (goleadores, asistentes, tarjetas) o basta con marcador en vivo? — Afecta a encuestas tipo "¿quién marcará primero?" y al feed de actividad.
4. **Política de reconciliación**: si las dos fuentes discrepan en marcador, ¿cuál gana? ¿La más reciente, la primaria, la mayoría?
5. **Caching y rate-limit**: ¿polling desde el server con queue o WebSockets cuando estén disponibles?

## Pasos siguientes

1. Solicitar trial / claves de API en al menos dos candidatas (recomendado: API-Football y Sportmonks).
2. Probar fixture del Mundial 26 en sandbox: comprobar IDs, estructura, latencia, formato de eventos.
3. Decidir presupuesto.
4. Cerrar decisión y abrir propuesta `add-match-data-providers` que defina:
   - Adapter pattern con interfaz común (`MatchDataProvider`).
   - Implementación de los dos providers seleccionados.
   - Política de failover y reconciliación.
   - Caching y rate-limit handling.
