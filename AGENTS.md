# AGENTS.md

Convenciones para **cualquier asistente IA** que opere sobre este repositorio (Claude Code, Cursor, Copilot, Aider, etc.). Las particularidades de Claude Code están en `CLAUDE.md`.

## Filosofía

- **Spec-first**. No se escribe código sin una propuesta abierta en `openspec/changes/`. Si la tarea no encaja en una propuesta existente, abre una nueva.
- **Iterar en pequeño**. Una propuesta debe poder implementarse en una sesión. Si crece, divídela.
- **El usuario decide el alcance**. Cuando una propuesta tenga ambigüedad, pregunta antes de asumir.

## Orden de lectura recomendado

1. `README.md` — qué es y por qué existe el proyecto.
2. `openspec/project.md` — contexto, stack, restricciones, dominio.
3. `openspec/AGENTS.md` — workflow OpenSpec exacto.
4. `docs/glossary.md` — vocabulario del dominio (predicción, racha, combo, etc.).
5. `docs/architecture.md` — visión técnica.
6. `docs/scoring.md` — reglas de puntuación.
7. `docs/leaderboard-reference.html` — referencia visual del ranking.

## Antes de tocar código

- ¿Existe una propuesta abierta que cubra esta tarea?
  - **Sí** → leer `proposal.md`, `tasks.md`, marcar la tarea como `in_progress`.
  - **No** → abrir una propuesta primero (ver `openspec/AGENTS.md`).
- ¿La tarea requiere decisiones de dominio (ej. cuántos puntos vale un acierto exacto)? Pregunta al usuario, no inventes.

## Convenciones de código (cuando se introduzcan)

- TypeScript estricto. `any` está prohibido salvo justificación documentada.
- Esquemas con Zod en los bordes (entrada API, parsing externo). Tipos derivados con `z.infer`.
- Server Components por defecto. `"use client"` solo cuando hay estado o efectos del navegador.
- Datos: queries Drizzle en `src/server/db/queries/*`. Nunca SQL crudo en el componente.
- Estilo: Tailwind utility-first. Tokens semánticos en `globals.css` cuando se repitan.

## Tests

- **Unit/integration**: Vitest, junto al archivo testeado (`x.ts` ↔ `x.test.ts`).
- **E2E**: Playwright en `e2e/`.
- Toda propuesta de cambio que añada lógica nueva debe incluir, mínimo, un test que cubra el happy path.

## Commits

- Convencional: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.
- Asunto en imperativo, ≤ 72 caracteres.
- Si la implementación cierra una propuesta, referencia su carpeta: `feat(leaderboard): SSE feed (closes change/add-leaderboard-realtime)`.

## Lo que NO debes hacer

- Saltarte el flujo OpenSpec porque parezca rápido.
- Añadir dependencias sin justificarlas en la propuesta.
- Inventar puntuaciones, copys o reglas de negocio. Pregunta.
- Mockear la base de datos en tests de integración.
- Subir secretos. `.env*` está en `.gitignore`; el `.env.example` es la fuente de verdad de qué variables existen.
