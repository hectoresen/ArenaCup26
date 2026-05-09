# CLAUDE.md

Lee `AGENTS.md` primero. Este archivo solo recoge **deltas específicos de Claude Code** sobre las convenciones generales.

## Skills disponibles en este proyecto

Invocables vía `Skill` cuando aplique:

- **`spec-author`** — drafta una propuesta OpenSpec completa (`proposal.md` + `tasks.md` + `specs/`) a partir de una idea en lenguaje natural.
- **`scoring-rules`** — actualiza y verifica la coherencia de `docs/scoring.md` y los specs derivados.
- **`leaderboard-ui`** — referencia el `docs/leaderboard-reference.html` cuando se implementan vistas del ranking; mapea estilos del HTML de referencia a Tailwind.
- **`achievements-ui`** — referencia el `docs/achievements-reference.html` y el catálogo `docs/achievements.md` cuando se implementan vistas de logros o el catálogo del perfil público.
- **`public-profile-ui`** — referencia el `docs/public-profile-reference.html` y `docs/public-profile.md` cuando se implementa la página `/u/<username>`. Delega el catálogo de logros en `achievements-ui`.

## Preferencias de tooling

- **Edit > Write** para archivos existentes; siempre lee antes.
- **TaskCreate** para cualquier propuesta OpenSpec con más de 2 pasos: traduce el `tasks.md` de la propuesta a tasks de la sesión.
- **Agent Explore** para localizar archivos cuando el repo crezca; **Plan** antes de cambios cross-cutting.
- **AskUserQuestion** para decisiones de dominio (puntuaciones, copys, prioridades). Nunca asumas reglas de negocio.

## Memoria

- Guarda en memoria preferencias estables del usuario (estilo de commits, idioma de copys, herramientas favoritas).
- **No** guardes estado efímero del proyecto (qué propuesta está abierta, qué tarea está en curso). Eso vive en `openspec/changes/`.
- Convierte fechas relativas a absolutas antes de guardar.

## Resumen final de turno

Una o dos frases. Qué cambió y qué queda.
