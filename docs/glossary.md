# Glosario del dominio

Vocabulario común para que humanos y agentes IA hablen igual. Si introduces un término nuevo, añádelo aquí en la misma propuesta.

| Término             | Definición                                                                    |
| ------------------- | ----------------------------------------------------------------------------- |
| **Predicción**      | Voto de un usuario sobre el resultado o marcador de un partido.               |
| **Predicción simple** | Predicción de un único resultado, opcionalmente con marcador exacto.        |
| **Doble predicción** (doble oportunidad) | Predicción que cubre **dos** de los tres resultados posibles. Otorga la mitad de puntos al acertar y reduce el bonus de combo si forma parte de la racha. |
| **1X / X2 / 12**    | Notaciones de la doble predicción. **1X** = victoria local o empate. **X2** = empate o victoria visitante. **12** = victoria local o visitante (sin empate). |
| **Acierto simple**  | Predijo correctamente ganador o empate, pero no el marcador exacto.           |
| **Acierto exacto**  | Predijo el marcador exacto.                                                   |
| **Combo**           | N aciertos consecutivos sin un fallo. Genera bonus de puntos.                 |
| **Racha (streak)**  | Número actual de aciertos consecutivos del usuario. Se reinicia con un fallo. |
| **Puntos**          | Moneda virtual del ranking. No tiene valor real ni se puede canjear.          |
| **Puntos provisionales** | Puntos calculados con el marcador **en vivo** de un partido en curso. Se muestran como preview en el dashboard y mueven el leaderboard en tiempo real. Se **confirman** al cerrar el partido o se **descartan** si se pospone/cancela. La racha y los combos solo se actualizan con puntos confirmados. |
| **Failover (match-data)** | Cambio automático de la API primaria a la secundaria cuando la primaria falla. Forma parte de la redundancia de la capability `match-data`. |
| **Leaderboard**     | Ranking global de usuarios ordenado por puntos descendentes.                  |
| **Encuesta**        | Pregunta corta de engagement. Otorga puntos por participar.                   |
| **Invitación**      | Acción de un usuario que comparte su enlace de referido. Otorga puntos al referidor cuando el referido hace ≥ 1 predicción. |
| **Kick-off**        | Hora oficial de inicio de un partido. Marca el cierre de admisión de predicciones. |
| **TBD** (To Be Determined) | Equipos aún sin determinar en partidos futuros (semis, final pre-bracket). Los partidos en este estado son visibles en gris pero no predecibles hasta que se confirman los equipos. |
| **Eliminatoria**    | Rondas finales del Mundial (octavos, cuartos, semis, final, tercer puesto) donde no puede haber empate oficial. El marcador exacto cuenta hasta el final de la prórroga (120'); el ganador incluye penaltis si los hubo. Las dobles `1X` y `X2` no aplican. |
| **Estado de partido** | Cualquiera de los 7 estados definidos en `docs/business-rules.md`: `scheduled-tbd`, `scheduled`, `prediction-locked`, `live`, `finished`, `postponed`, `cancelled`. |
| **Logro**           | Insignia desbloqueable por conducta (racha de login, primer acierto, etc.). No otorga puntos; el usuario puede mostrarla en su perfil público. |
| **Tier**            | Nivel de rareza de un logro. Seis tiers: común, poco común, épico, legendario, mítico, GOAT. Cada uno tiene paleta y reglas visuales propias. Ver `docs/achievements.md`. |
| **GOAT**            | "Greatest Of All Time". Tier reservado al campeón absoluto del torneo. Único: solo lo desbloquea el #1 del ranking al cierre del Mundial. |
| **Logro shareable** | Logro con un chip de compartir en la card (tiers legendario, mítico, GOAT). Todos los logros son visibles en el perfil público; "shareable" es solo visual. |
| **Etiqueta "En racha"** | Badge con icono de fuego junto al nick en el leaderboard. Aparece a partir del **3º acierto consecutivo** (1er hito de combo). |
| **Perfil público**  | Página accesible por enlace (`/u/<username>`) con avatar, nombre, bandera opcional, posición de ranking, puntos totales y catálogo completo de logros. Sin login para verlo. Ver `docs/public-profile.md`. |
| **Capability**      | Unidad cohesiva de funcionalidad. Una carpeta en `openspec/specs/`.           |
| **Propuesta**       | Cambio en discusión. Vive en `openspec/changes/<nombre>/`.                    |
