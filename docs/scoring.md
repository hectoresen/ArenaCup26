# Tabla de puntuación

> Estado: **fijada** (2026-05-05). Cualquier ajuste futuro pasa por una propuesta `update-scoring-<motivo>` en `openspec/changes/`.

## Predicciones

| Acción                                  | Puntos | Notas                                                        |
| --------------------------------------- | -----: | ------------------------------------------------------------ |
| Acierto simple (ganador o empate)       |    +10 | El usuario acertó el resultado pero no el marcador.          |
| Acierto exacto (marcador exacto)        |    +30 | **Sustituye al simple**, no se suman ambos.                  |
| Falla                                   |     +0 | Resetea la racha a 0 (ver combos).                           |

## Doble predicción

El usuario puede cubrir **dos de los tres resultados posibles** (victoria local, empate, victoria visitante) en una misma predicción, a cambio de recibir la mitad de puntos.

### Combinaciones permitidas

| Notación | Cubre                                                      |
| -------- | ---------------------------------------------------------- |
| **1X**   | Victoria local **o** empate                                |
| **X2**   | Empate **o** victoria visitante                            |
| **12**   | Victoria local **o** victoria visitante (sin empate)       |

### Reglas

| Caso                                                            | Puntos |
| --------------------------------------------------------------- | -----: |
| Ocurre uno de los dos resultados cubiertos                      |    +5  |
| Ocurre el tercer resultado (no cubierto)                        |     0  |

- Las dobles son **siempre de resultado**, sin marcador exacto. No existe acierto exacto en una doble.
- Una doble acertada cuenta como **un acierto** de cara a la racha (suma 1).
- Una doble fallida resetea la racha a 0, igual que una predicción simple fallida.
- **En eliminatoria, las dobles `1X` y `X2` no aplican** (no hay empate oficial). La `12` es trivial y se desactiva. Solo se permite predicción simple con marcador exacto opcional. Ver `docs/business-rules.md`.

### UX obligatoria

Al activar el modo doble, la interfaz debe informar al usuario **antes de confirmar** la predicción:

> Aviso: Estás eligiendo una doble. Si aciertas, ganarás **+5 puntos** (la mitad de un acierto simple). Si esta predicción forma parte de tu racha, los próximos bonus de combo se verán **reducidos** a +3 / +5 / +9 (en vez de +5 / +15 / +50).

## Combos / rachas

Bonus puntual al alcanzar cada hito de aciertos consecutivos. El valor depende de si la racha que alcanza el hito **contiene al menos una predicción doble acertada**:

| Hito                       | Bonus completo (racha sin dobles) | Bonus modificado (racha con ≥1 doble) |
| -------------------------- | --------------------------------: | ------------------------------------: |
| 3 aciertos consecutivos    |                                +5 |                                    +3 |
| 5 aciertos consecutivos    |                               +15 |                                    +5 |
| 10 aciertos consecutivos   |                               +50 |                                    +9 |

- El bonus se otorga **una sola vez por hito alcanzado** dentro de la misma racha activa.
- "Racha sin dobles" significa que **todas** las predicciones acertadas que la componen son simples o exactas.
- Una sola doble acertada en la racha activa basta para reducir todos los bonus posteriores hasta que la racha se rompa.
- Una predicción fallida resetea la racha a 0; los hitos vuelven a estar disponibles al iniciar una nueva racha.

### Etiqueta visual "En racha"

En el leaderboard, junto al nick del usuario, se muestra un icono de fuego con el contador de racha cuando el usuario alcanza el **3º acierto consecutivo** (1er hito de combo). La etiqueta desaparece al fallar una predicción. No se muestra con racha de 1 ó 2.

## Engagement

| Acción                                                   | Puntos | Notas                                                |
| -------------------------------------------------------- | -----: | ---------------------------------------------------- |
| Participar en una encuesta del día                       |    +1  | El usuario contesta antes del cierre.                |
| Acertar la encuesta del día                              |    +1  | Adicional al de participar (máx **+2** por encuesta). |
| Login diario                                             |    +0  | Ver capability `achievements`. No afecta puntos.     |
| Invitar a un amigo (acto de compartir el enlace)         |    +0  |                                                      |
| Un referido acierta su **primera** predicción            |   +10  | Al referidor. **One-time** por referido.             |

## Anti-trampa

- **Cierre de predicciones**: cada predicción se bloquea al **kick-off oficial** del partido. A partir de ese instante no se acepta envío ni edición.
- **Edición de predicción**: ilimitada hasta el kick-off. Cuenta la última versión enviada antes del bloqueo.
- **Resultados oficiales**: los puntos se confirman como definitivos cuando se registra el resultado oficial del partido (ver capability `match-data`). Antes de eso pueden existir como **provisionales** (ver sección "Cálculo en vivo").

### Casos especiales

Las reglas anteriores se modifican en estos contextos. Detalles completos en `docs/business-rules.md`:

- **Eliminatoria**: el "empate" no es predicción simple válida. Las dobles `1X` y `X2` no aplican; solo predicción simple con marcador exacto opcional. El **marcador exacto** cuenta hasta el final de la prórroga (120'), sin penaltis. El **ganador** sí incluye los penaltis.
- **Pospuesto**: la predicción se mantiene, editable hasta el nuevo kick-off.
- **Cancelado**: predicción anulada, puntos = 0, la racha **salta** el partido (no se rompe).

## Cálculo en vivo

Mientras un partido está **en curso**, el sistema calcula puntos **provisionales** con el marcador actual:

- En el **dashboard del usuario**, cada predicción del partido en vivo muestra un preview: "vas a ganar +X puntos si termina así".
- En el **leaderboard**, los puntos provisionales se suman al total y se identifican visualmente como tales (la UI debe diferenciarlos de los oficiales).
- Al **finalizar** el partido (status `FINISHED` confirmado por la API o por el admin), los provisionales se **confirman** como oficiales.
- Si el partido es **pospuesto o cancelado**, los provisionales se **descartan** sin afectar a totales oficiales.
- La racha y los hitos de combo **no se actualizan** con provisionales: solo se modifican al cierre oficial.

Las reglas de puntuación de las secciones anteriores (simple, exacto, doble, combo) se aplican **igual** a los cálculos provisionales que a los oficiales; lo que cambia es el momento del cómputo.

## Logros (fuera del alcance de scoring)

El **login diario** y otras conductas habituales (rachas de días, primera predicción, primer top-3 del día, etc.) no otorgan puntos pero sí desbloquean **logros** que el usuario puede mostrar opcionalmente en su perfil público. La capability `achievements` se especifica por separado en una propuesta futura.

## Implementación

- Los valores anteriores deben vivir en un único módulo `src/server/scoring/rules.ts` consumido por el motor de puntuación. **Nunca duplicar** valores en componentes ni queries.
- El skill `scoring-rules` (en `.claude/skills/scoring-rules/SKILL.md`) audita la coherencia entre este documento y el código.

## Cambios futuros

Cualquier ajuste se registra como propuesta `update-scoring-<motivo>` en `openspec/changes/`. Si afecta partidos ya resueltos, debe especificar política de recálculo histórico.
