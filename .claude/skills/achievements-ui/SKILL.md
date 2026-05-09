---
name: achievements-ui
description: Use when the user is implementing or modifying any achievement view (catalog grid, locked/unlocked cards, tier sections, share chips, progress bar) or porting the reference HTML to React/Tailwind. References `docs/achievements-reference.html` and `docs/achievements.md`. Triggers on phrases like "logros", "achievements", "catálogo de logros", "perfil público", "tiers", "GOAT".
---

# achievements-ui

Eres responsable de que las vistas de logros respeten el **catálogo formal** (`docs/achievements.md`) y la **referencia visual oficial** (`docs/achievements-reference.html`). Funcionas como hermano del skill `leaderboard-ui`: comparten lenguaje visual y tokens.

## Cuándo activarte

- Implementar la página de logros del usuario o el catálogo en su perfil público.
- Diseñar la card de un logro, el badge de tier, el chip de compartir o la barra de progreso.
- Revisar un PR que toque la UI de logros o la sección de logros del perfil público.

## Pasos

1. **Lee primero**:
   - `docs/achievements.md` — catálogo formal con id, título, tier, trigger y `is_shareable`.
   - `docs/achievements-reference.html` — referencia visual.
   - `docs/public-profile.md` — cómo se enmarca dentro del perfil.
2. **Mapea los tokens** a Tailwind v4 `@theme`. Los colores ya están definidos en `leaderboard-reference.html`; aquí se añaden los tiers:
   - `--color-tier-common: #34d97b`
   - `--color-tier-rare: #4fc3f7`
   - `--color-tier-epic: #c084fc`
   - `--color-tier-legendary: #f5c842` (mismo gold)
   - `--color-tier-mythic: #ff8c42`
   - `--color-tier-goat: #a8d8ff`
3. **Componentiza**:
   - `<AchievementCard achievement={…} unlocked={bool} />`
   - `<TierSection tier="epic" achievements={…} />`
   - `<ProgressBar unlockedCount unlockedTotal />`
   - `<ShareChip href={…} />`
4. **Estados**:
   - `unlocked`: full color + check badge.
   - `locked`: greyscale 0.7, opacity 0.36, lock icon, sin animaciones de hover de glow.
   - Cards de tier legendary, mythic y goat usan layout `wide` (icon a la izquierda, contenido a la derecha) y muestran `share-chip` al hover.
5. **Animaciones** (heredadas del leaderboard reference):
   - `popIn` en header y progress bar.
   - `slideIn` escalonado en cards (con clases `d0`-`d23` o equivalente Tailwind con `animation-delay`).
   - `iconPulse` en legendarios, `iconPulseFire` en míticos, `iconPulseIce` en goat.
   - `shimmer` continuo solo en el GOAT card.
6. **Accesibilidad**:
   - Cada card debe tener `aria-label` con título + tier + estado (locked/unlocked).
   - El icono SVG con `role="img"` y `<title>` interno.
   - Las animaciones deben respetar `prefers-reduced-motion: reduce`.
   - Contraste de texto: el `ach-desc` (color `--muted`) sobre el `--bg` o `--card` debe cumplir AA.
7. **Reglas a corregir** del reference HTML (mismos artefactos del leaderboard):
   - Custom properties `–` → `--`.
   - Comillas tipográficas → comillas rectas.
   - Bloques ` ``` ` markdown que se colaron en el HTML → eliminar.

## Lo que NO debes hacer

- Inventar logros nuevos o cambiar triggers. La fuente de verdad es `docs/achievements.md`. Si propones uno nuevo, abre una propuesta `update-achievements-<motivo>`.
- Hardcodear los datos de los 24 logros en el componente. Deben venir de la BD (`achievement_definitions`) sembrada con el catálogo.
- Mezclar la página de logros con la de leaderboard. Son superficies distintas; comparten tokens, no estructura.
- Mostrar progreso de logros con datos provisionales. Solo se mueven con cierres oficiales (consistente con racha y combos).

## Resultado esperado

Componentes React + Tailwind que reproducen el lenguaje visual del reference, accesibles, animados, con datos del catálogo formal, encajables tanto en `/account/achievements` (vista privada) como en `/u/<username>` (perfil público).
