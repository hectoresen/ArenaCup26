# Catálogo de logros

> Estado: catálogo cerrado (2026-05-06). Las decisiones detalladas de evaluación, animación de unlock y reordenación se cierran en la propuesta `add-achievements`.

## Sistema de tiers

| Tier         | Color (token)                                | Significado                                      |
| ------------ | -------------------------------------------- | ------------------------------------------------ |
| Común        | `#34d97b` (verde)                            | Hitos iniciales, accesibles a casi todo el mundo. |
| Poco común   | `#4fc3f7` (azul)                             | Logros que requieren constancia.                 |
| Épico        | `#c084fc` (morado)                           | Logros de habilidad o cobertura.                 |
| Legendario   | `#f5c842` (dorado, mismo gold del leaderboard) | Logros de élite. Aparece chip de compartir.    |
| Mítico       | `#ff8c42` (naranja)                          | Posiciones top del ranking en algún momento.     |
| GOAT         | `#a8d8ff` (azul hielo)                       | Único: campeón absoluto del torneo.              |

La paleta está alineada con `docs/leaderboard-reference.html` y el mockup en `docs/achievements-reference.html`.

## Reglas globales

- Los logros se evalúan **al cierre oficial del partido** (no con puntos provisionales). Esto evita que un logro se desbloquee y se vuelva a bloquear si un equipo remonta.
- Una vez desbloqueado, un logro **no se pierde** aunque las condiciones cambien después.
- Todos los logros son **siempre visibles** en el perfil público del usuario (desbloqueados y pendientes). El flag `is_shareable` es solo visual: añade un chip de compartir en la card y se considera el logro "presumible".

## Catálogo

### Común (7)

| ID                     | Título              | Trigger                                                                    | Shareable |
| ---------------------- | ------------------- | -------------------------------------------------------------------------- | :-------: |
| `first-hit`            | Primer Acierto      | Acertar la primera predicción del torneo (simple, exacto o doble).         |    no     |
| `good-eye`             | Buen Ojo            | Acumular 10 aciertos (cualquier tipo) a lo largo del torneo.               |    no     |
| `group-analyst`        | Analista de Grupos  | Predecir al menos 10 partidos de la fase de grupos (del torneo).           |    no     |
| `first-hundred`        | Primer Centenar     | Acumular 100 puntos oficiales.                                             |    no     |
| `better-with-friends`  | Mejor con Amigos    | Un usuario referido (vía link de invite a la app) acierta su primera predicción. |    no     |
| `five-of-five`         | Cinco de Cinco      | Acertar el marcador exacto en 5 partidos distintos.                        |    no     |
| `team-spirit`          | Espíritu de Equipo  | Crear o unirse a tu primer grupo de competición. **Bypass al gate de partidos** (acción social, no rendimiento). |    no     |

### Poco común (4)

| ID            | Título            | Trigger                                                              | Shareable |
| ------------- | ----------------- | -------------------------------------------------------------------- | :-------: |
| `power-200`   | 200 de Potencia   | Superar los 200 puntos oficiales acumulados.                         |    no     |
| `on-fire`     | En Llamas         | Alcanzar el hito de **5 aciertos consecutivos** en una racha.        |    no     |
| `exact-shot`  | Exacto            | Acertar el marcador exacto de un partido.                            |    no     |
| `top-100`     | Top 100           | Entrar al menos una vez en el top 100 del ranking global.            |    no     |

### Épico (6)

| ID                  | Título              | Trigger                                                                          | Shareable |
| ------------------- | ------------------- | -------------------------------------------------------------------------------- | :-------: |
| `total-strategist`  | Estratega Total     | Predecir todos los partidos de la fase de grupos sin excepción.                  |    no     |
| `half-world`        | Medio Mundo         | Realizar predicciones en al menos el 50% de los partidos del Mundial.            |    no     |
| `elite-shooter`     | Tirador de Élite    | Acertar el marcador exacto en 10 partidos distintos.                             |    no     |
| `top-50`            | Top 50              | Entrar al menos una vez en el top 50 del ranking global.                         |    no     |
| `double-streak`     | Doble Racha         | Conseguir al menos **2 rachas que alcancen el hito de 5** a lo largo del torneo. |    no     |
| `the-step-before`   | El Penúltimo Paso   | Acertar el resultado de **una** semifinal del Mundial.                           |    no     |

### Legendario (4)

| ID                | Título               | Trigger                                                                 | Shareable |
| ----------------- | -------------------- | ----------------------------------------------------------------------- | :-------: |
| `seer`            | Vidente              | Acertar el marcador exacto en **20** partidos distintos.                |    sí     |
| `top-10`          | Top 10               | Entrar al menos una vez en el top 10 del ranking global.                |    sí     |
| `world-citizen`   | Ciudadano del Mundo  | Realizar predicciones en absolutamente todos los partidos del Mundial.  |    sí     |
| `the-prophet`     | El Gran Profeta      | Acertar el marcador exacto de la Gran Final.                            |    sí     |

### Mítico (3)

| ID                   | Título              | Trigger                                                  | Shareable |
| -------------------- | ------------------- | -------------------------------------------------------- | :-------: |
| `on-the-podium`      | En el Podio         | Aparecer al menos una vez en el top 3 durante el torneo. |    sí     |
| `runner-up`          | Subcampeón          | Llegar a ocupar el top 2 en algún momento.               |    sí     |
| `king-of-the-moment` | El Rey del Momento  | Ocupar el #1 al menos una vez durante el torneo.         |    sí     |

### GOAT (1)

| ID            | Título            | Trigger                                                          | Shareable |
| ------------- | ----------------- | ---------------------------------------------------------------- | :-------: |
| `the-goat`    | El Mayor de Todos | Terminar el Mundial 2026 como **#1 absoluto** del ranking.       |    sí     |

**Total: 25 logros** (24 originales + `team-spirit` añadido 2026-05-19
con la feature de grupos de competición).

### Gate global de partidos

Los logros de **rendimiento** (puntos, racha, aciertos, ranking
position) están sujetos al gate `ACHIEVEMENTS_MIN_FINISHED_MATCHES`
(env var, default 0 en dev / 5 en prod). Mientras el gate esté
activo, `evaluateAndUnlock` no desbloquea logros de rendimiento
para evitar trivialidades del día 1 ("acerté una sola predicción
y ya tengo `first-hit`").

Los logros de **acción social** (hoy solo `team-spirit`) están en
la lista `GATE_BYPASS` y se evalúan ignorando el gate — son
acciones explícitas del user, no producto de un único resultado de
partido. La lista se mantiene en
`src/server/achievements/unlock.ts`.

Cuando el gate cae (≥ N partidos finalizados), todos los users
desbloquean retroactivamente sus logros pendientes en su siguiente
unlock check (siguiente match scored). Para `team-spirit` hay un
**backfill** en `scripts/bootstrap.ts` que se corre en cada
pre-deploy: idempotente, sin notificaciones spam.

## Modelo de datos preliminar

- `achievement_definitions` — id (PK), title, description, tier, trigger_kind, trigger_params (JSON), is_shareable, icon_id, sort_order.
- `user_achievements` — user_id (FK), achievement_id (FK), unlocked_at. PK compuesta.
- Las definiciones se siembran en una migración Drizzle; este documento es la fuente de verdad de qué se siembra.

## Decisiones pendientes (a cerrar en `add-achievements`)

- Política de **animación de unlock** in-app (toast + modal celebratorio escalado por rareza).
- Política de **reordenación** del listado: ¿pinned los recién desbloqueados durante 24 h?
- ¿Se muestra el progreso parcial en logros locked (ej. "12/20 exactos" en `seer`)? Recomendado sí, para incentivar.
- ¿Qué pasa con logros mutuamente excluyentes en su narrativa? Ej. "Subcampeón" y "El Rey del Momento" son ambos desbloqueables: ¿se muestran los dos? Recomendado sí, son hitos distintos.
