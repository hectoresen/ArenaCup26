# add-fixture-seed-wc2022

## Why

`docs/pre-launch-testing.md` recomienda como **enfoque A** un replay del Mundial 2022 para validar end-to-end antes del 11 de junio: 64 partidos reales con prórrogas, penaltis, goleadas, remontadas. La final 3-3 ARG-FRA ganada por Argentina en penaltis es el caso edge **definitivo** para nuestro scoring engine.

Sin un dataset histórico, los tests del engine se quedan en escenarios sintéticos. Con WC 2022, podemos:

- Validar que las **predicciones reales** (un usuario que dijo "Argentina gana") puntúan como esperamos.
- Demo realista del leaderboard con datos que el equipo conoce de memoria.
- Cuando aterrice `add-leaderboard-sse`, replayear los eventos minuto a minuto y validar la pipeline completa.

## What changes

Capability nueva: **`fixture-seed-wc2022`**.

- `src/server/seeds/wc2022/teams.ts` con las **32 selecciones** que disputaron Qatar 2022, agrupadas A-H, con código FIFA, nombre en inglés y emoji bandera.
- `src/server/seeds/wc2022/matches.ts` con **24 partidos** (los 16 de eliminatoria con datos completos + 8 representativos de la fase de grupos):
  - Round of 16 (8): incluye Japón-Croacia y Marruecos-España, ambos a penaltis.
  - Cuartos (4): Croacia-Brasil y Países Bajos-Argentina, ambos a penaltis.
  - Semis (2), tercer puesto (1).
  - **Final**: ARG 3-3 FRA, Argentina gana 4-2 en penaltis. La iconic.
  - 8 partidos representativos de grupos: Qatar-Ecuador, Inglaterra-Irán, Argentina-Arabia Saudí (la upset), Francia-Australia, Alemania-Japón (la upset), España-Costa Rica (7-0), Brasil-Serbia, Portugal-Ghana.
- `src/server/seeds/wc2022/seed.ts` con `seedWC2022(db)`: limpia `predictions` y `matches`, upsertea teams por code (idempotente), inserta matches resolviendo team IDs.
- `scripts/seed-wc2022.ts` — CLI entrypoint con un aviso de "esto borra predictions y matches".
- `package.json`: script `seed:wc2022`.
- `src/server/seeds/wc2022/seed.test.ts` con **15 tests** organizados en 3 grupos:
  - Teams: cuenta, códigos únicos, formato 3 letras, nombres y banderas no vacíos, distribución 4×8 grupos, finalistas presentes.
  - Matches: cuenta exacta por stage, slugs únicos, equipos referenciados existen, scoreAtExtra solo en knockouts, penaltyWinner solo cuando extra-time empató, casos icónicos (final ARG-FRA, upset Argentina-Arabia, dobles penaltis de Croacia).
  - Integración con scoring engine: una predicción simple "perfecta" en cada partido devuelve 10 pts, una exacta perfecta devuelve 30, y la final 3-3 acierta como exact aunque hubiera penaltis.

**No incluye**:

- Los 40 partidos restantes de la fase de grupos. Quedan para una propuesta `update-wc2022-group-completion` cuando hagamos un replay 100% completo. Los 24 actuales bastan para todos los escenarios de validación que necesitamos hoy.
- Goleadores, alineaciones, eventos minuto a minuto. Eso es responsabilidad de `add-match-data-providers` cuando consuma APIs reales.
- Un mecanismo de "rebobinar y replayear". Los datos están en BD; el dispositivo de replay es propuesta separada.

## Impact

- **Bloquea**: nada.
- **Desbloquea**:
  - El test runner del engine puede iterar sobre los 24 partidos y comparar contra los puntos esperados. Inmediato.
  - Demos del leaderboard con datos realistas en lugar del mock de 10 jugadores.
  - Cuando aterrice `add-leaderboard-sse`, replay realista del Mundial completo en staging acelerado.
- **Riesgos**:
  - El seed es **destructivo** sobre `matches` y `predictions`. Hay aviso en el script y la propuesta lo documenta. Solo para dev/staging.
  - Datos copiados de memoria; pueden tener errores menores. Los tests específicos (final 3-3, upset Argentina-Saudí, penaltis de Croacia) cubren los casos críticos. El resto se puede revisar contra un fixture FIFA oficial.

## Decisiones tomadas

- **Solo 24 partidos en v1**: alcance suficiente para validar el engine. Los 40 restantes de grupos no aportan casos edge nuevos.
- **Códigos FIFA de 3 letras** como clave natural: idempotencia del seed sobre teams sin necesidad de UUIDs externos.
- **Truncate-and-insert sobre matches**: garantiza consistencia exacta entre el catálogo en código y la BD. Asume que el seed se ejecuta sobre dev/staging, no prod.
- **Nombres de equipos en inglés**: estándar deportivo internacional. La localización se gestiona via `next-intl` cuando exista la UI de equipos (FAQ, fixture, etc.).
- **Slug `wc2022-<stage>-<home>-<away>`** para tracking interno en código (no se persiste en BD). Permite buscar un partido específico por nombre legible.
- **Test de integración cruzado con scoring engine**: el test recorre los 24 partidos, calcula el ganador real con la misma lógica del engine, y verifica que una predicción simple del ganador correcto puntúa 10. Si el seed o el engine cambian de forma incompatible, este test cae.
