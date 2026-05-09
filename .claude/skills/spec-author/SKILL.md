---
name: spec-author
description: Use when the user wants to draft a new OpenSpec change proposal, scaffold an `openspec/changes/<name>/` folder, or convert an idea into proposal.md + tasks.md + spec.md. Triggers on phrases like "abre una propuesta", "nueva spec", "draft an OpenSpec change", "scaffold a change for X".
---

# spec-author

Te encargas de **convertir ideas en propuestas OpenSpec bien formadas** dentro de `openspec/changes/`. No escribes código de aplicación; escribes specs.

## Cuándo activarte

- El usuario pide una nueva propuesta ("abre una propuesta para X", "nueva spec", "scaffold change").
- El usuario describe una funcionalidad nueva sin propuesta previa.
- Hay que actualizar un `spec.md` existente porque cambian los requisitos.

## Cuándo NO activarte

- Implementar código que ya tiene propuesta abierta. Eso lo hace el flujo normal usando el `tasks.md` existente.
- Cambios triviales (typos, comentarios). No requieren propuesta.

## Pasos

1. **Lee primero** `openspec/project.md`, `openspec/AGENTS.md` y los `openspec/specs/<capability>/spec.md` afectados.
2. Si el alcance no está claro, **pregunta** al usuario con `AskUserQuestion`. Decisiones de dominio (puntos, copys, prioridades) **nunca se asumen**.
3. **Elige nombre**: `<verbo>-<dominio>-<detalle>` en kebab-case. Verbos: `add`, `update`, `remove`, `migrate`.
4. **Crea la carpeta** `openspec/changes/<nombre>/` con:
   - `proposal.md` — secciones `Why`, `What changes`, `Impact`. Formato en `openspec/AGENTS.md`.
   - `tasks.md` — checklist implementable, ≤ 10 tareas. Si crece, divide la propuesta.
   - `design.md` — solo si hay decisiones técnicas no obvias (algoritmos, trade-offs, esquema DB nuevo).
   - `specs/<capability>/spec.md` — **estado futuro completo** de la capability afectada (no diff).
5. **Sigue la plantilla del spec**: `# Purpose`, `# Requirements`, cada requirement con `## Requirement N` y al menos un `### Scenario:` (Given/When/Then).
6. **Reporta** al usuario qué creaste y qué decisiones quedaron pendientes.

## Buenas prácticas

- Una propuesta = una capability afectada idealmente. Si toca dos, justifica en `## Impact` por qué no se divide.
- Los scenarios cubren el happy path **y** al menos un edge case (ej. predicción fuera de plazo, partido cancelado).
- No copies código de la solución: el spec describe **qué** y **por qué**, no **cómo**.
- Marca decisiones pendientes con `> DECISIÓN PENDIENTE: …` en el cuerpo del spec.

## Resultado esperado

Una carpeta `openspec/changes/<nombre>/` lista para revisión humana. El usuario puede aprobarla, pedir cambios o cancelarla.
