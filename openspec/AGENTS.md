# openspec/AGENTS.md

Workflow **spec-driven** para este repositorio. Toda propuesta de cambio pasa por aquí antes de tocar código.

## Estructura

```
openspec/
├── project.md             # contexto vivo del proyecto
├── AGENTS.md              # este archivo
├── specs/                 # capacidades desplegadas (estado actual)
│   └── <capability>/
│       ├── spec.md        # WHAT y WHY de la capacidad
│       └── design.md      # HOW (opcional)
└── changes/
    ├── <change-name>/     # kebab-case, ej. add-leaderboard-realtime
    │   ├── proposal.md    # por qué, qué cambia, impacto
    │   ├── tasks.md       # checklist implementación
    │   ├── design.md      # decisiones técnicas (opcional)
    │   └── specs/<capability>/spec.md  # estado futuro completo
    └── archive/
        └── YYYY-MM-DD-<change-name>/   # propuestas completadas
```

## Ciclo de vida de un cambio

1. **Draft** — alguien (humano o IA) crea `changes/<nombre>/proposal.md`. Status: en discusión.
2. **Aprobado** — se añade `tasks.md` con checklist y, si procede, `design.md` y los `specs/<capability>/spec.md` futuros.
3. **In progress** — se implementa marcando tareas en `tasks.md` (`- [x]`).
4. **Aplicado** — código mergeado. La propuesta se promueve: el contenido de `changes/<nombre>/specs/` se mueve a `openspec/specs/` (sustituyendo los anteriores) y la carpeta original se mueve a `archive/YYYY-MM-DD-<nombre>/`.

## Convenciones

- **Nombres**: `<verbo>-<dominio>-<detalle>` en kebab-case. Ejemplos: `add-leaderboard-realtime`, `update-scoring-combos`, `remove-credentials-auth`.
- **Una capability por carpeta dentro de `specs/`**. Una capability es una superficie cohesiva (auth, leaderboard, prediction-flow, scoring-engine, dashboard).
- **`spec.md` siempre estructurado** como:
  - `# Purpose` — para qué existe la capacidad.
  - `# Requirements` — lista numerada de requisitos.
  - Cada requisito incluye `## Scenario:` con condición → comportamiento esperado.

## Plantilla mínima — `proposal.md`

```markdown
# <Nombre del cambio>

## Why
Breve motivación. ¿Qué problema resuelve, qué oportunidad abre?

## What changes
Lista de capacidades afectadas y cómo:
- `auth`: nueva capacidad — login con Google.
- `leaderboard`: amplía requirement R3 con paginación.

## Impact
Riesgos, dependencias, breaking changes.
```

## Plantilla mínima — `tasks.md`

```markdown
# Tasks — <Nombre del cambio>

- [ ] 1. Diseño de schema (Drizzle) para <X>.
- [ ] 2. Endpoint API en `app/api/<…>/route.ts`.
- [ ] 3. UI en `app/<…>`.
- [ ] 4. Tests Vitest cubriendo happy path.
- [ ] 5. Test Playwright del flujo end-to-end.
- [ ] 6. Actualizar `openspec/specs/<capability>/spec.md`.
- [ ] 7. Mover propuesta a `archive/YYYY-MM-DD-<nombre>/`.
```

## Plantilla mínima — `specs/<capability>/spec.md`

```markdown
# Purpose
Una frase. ¿Por qué existe esta capacidad?

# Requirements

## Requirement 1: <título>
Descripción breve y normativa.

### Scenario: <título>
- **Given** ...
- **When** ...
- **Then** ...
```

## Reglas para IA

- Antes de proponer un cambio, **lee `specs/`** para no contradecir capacidades existentes.
- Si un cambio borra/altera una capacidad existente, debe explicarlo en `## Impact` y aportar el spec futuro completo (no diff).
- Si la propuesta toca varias capacidades, **divídela**. Una propuesta por capacidad cuando sea factible.
- No archives una propuesta hasta que el código esté mergeado y el `spec.md` actualizado.
