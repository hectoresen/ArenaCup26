# `docs/` — índice de documentación humana

Documentación viva del proyecto. Para el flujo de trabajo de spec-driven development y propuestas de cambio, ver [`../openspec/`](../openspec/).

El README principal del repo ([`../README.md`](../README.md)) tiene el dosier completo con descripciones largas. Esta tabla es el atajo cuando ya sabes qué buscas.

## Producto y dominio

| Doc                                            | Estado     | Resumen                                                              |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| [`glossary.md`](glossary.md)                   | vivo       | Vocabulario del dominio (predicción, combo, racha, TBD…).            |
| [`business-rules.md`](business-rules.md)       | cerrado    | Reglas operativas no-scoring: 7 estados de partido, eliminatorias, ventana de predicción, username, eliminar cuenta. |
| [`scoring.md`](scoring.md)                     | cerrado    | Tabla canónica de puntos. Source of truth del scoring engine.        |
| [`achievements.md`](achievements.md)           | cerrado    | Catálogo formal de los 28 logros con id, tier, trigger y si es compartible. |
| [`public-profile.md`](public-profile.md)       | cerrado    | Estructura del perfil público `/u/<username>`.                       |
| [`groups.md`](groups.md)                       | vivo       | Grupos de competición: caps, notificaciones, ranking del grupo, reglas leave/expel, descubrir con candado. |
| [`bots.md`](bots.md)                           | activo     | Bots que pueblan el ranking durante el cold-start del Mundial. 27 usuarios sintéticos con comportamiento funcional idéntico al real. |

## Arquitectura

| Doc                                            | Estado     | Resumen                                                              |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| [`architecture.md`](architecture.md)           | vivo       | Diagrama de 10 000 m + flujos principales (login, predicción, scoring). |
| [`infrastructure.md`](infrastructure.md)       | vivo       | Servicios en producción, conexiones, dónde vive cada cosa.           |
| [`decisions.md`](decisions.md)                 | vivo       | Bitácora de decisiones técnicas vigentes (ADRs).                     |
| [`roadmap.md`](roadmap.md)                     | vivo       | Plan de trabajo consolidado: bloques, backlog, ítems aterrizados.    |

## Operación

| Doc                                            | Estado     | Resumen                                                              |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| [`quickstart.md`](quickstart.md)               | vivo       | Levantar el proyecto en local en 5 minutos.                          |
| [`deployment.md`](deployment.md)               | vivo       | Despliegue, variables de entorno, troubleshooting del primer arranque. |
| [`security.md`](security.md)                   | vivo       | Runbook de seguridad: secrets, auditoría, operativa manual del owner. |
| [`testing.md`](testing.md)                     | vivo       | Filosofía y estándares de testing. Threshold de cobertura + gaps conocidos + anti-patrones. |
| [`pre-launch-checklist.md`](pre-launch-checklist.md) | activo | Lista canónica de lo pendiente antes y durante el Mundial. |
| [`incident-2026-05-18-data-wipe.md`](incident-2026-05-18-data-wipe.md) | histórico | Post-mortem del wipe accidental + reglas para prevenir recurrencia. |
| [`data-pipeline.md`](data-pipeline.md)         | vivo       | Cómo llegan los datos a la app: crons, fuentes, flujo gol → ranking. |
| [`api-football-config.md`](api-football-config.md) | vivo   | Config del provider deportivo + IDs de liga + switch al Mundial 2026. |
| [`match-data-research.md`](match-data-research.md) | histórico  | Pre-análisis de APIs candidatas. Decisión: api-football. Plan de failover. |
| [`pre-launch-testing.md`](pre-launch-testing.md) | activo    | Estrategia de validación end-to-end antes del kickoff del Mundial.    |

## Referencias visuales

| Doc                                                          | Estado     | Resumen                                                  |
| ------------------------------------------------------------ | ---------- | -------------------------------------------------------- |
| [`leaderboard-reference.html`](leaderboard-reference.html)   | vivo       | Source of truth del diseño del ranking en vivo.          |
| [`achievements-reference.html`](achievements-reference.html) | vivo       | Diseño del catálogo de logros + sprite SVG inline.       |
| [`public-profile-reference.html`](public-profile-reference.html) | vivo   | Diseño del perfil público.                               |

## Convenciones de estado

- **vivo**: se actualiza cada vez que cambia el comportamiento que documenta.
- **cerrado**: definición congelada. Cambios requieren propuesta en `openspec/changes/`.
- **histórico**: refleja una decisión pasada; útil como contexto, no se actualiza con la realidad actual.
- **activo**: en construcción o iteración explícita.
