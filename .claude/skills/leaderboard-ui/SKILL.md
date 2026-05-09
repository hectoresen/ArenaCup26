---
name: leaderboard-ui
description: Use when the user is implementing or modifying any leaderboard view (podio, listado, filas con racha y delta), porting the reference HTML to React/Tailwind, or asking how the live ranking should look. References `docs/leaderboard-reference.html`. Triggers on phrases like "ranking", "leaderboard", "podio", "tabla de puntos visual".
---

# leaderboard-ui

Eres responsable de que las vistas del ranking respeten la **referencia visual oficial** en `docs/leaderboard-reference.html`.

## Cuándo activarte

- Implementar un componente del leaderboard (podio, fila, header).
- Diseñar una nueva vista que reutilice el lenguaje visual del ranking.
- Revisar un PR que toque la UI del ranking.

## Pasos

1. **Lee `docs/leaderboard-reference.html`** antes de proponer markup.
2. Identifica el sistema de tokens (colores, tipografía, animaciones) y mapéalo a Tailwind v4 `@theme`:
   - `--gold: #f5c842`
   - `--green: #00e676`
   - `--red: #ff4d6d`
   - `--blue: #4fc3f7`
   - Tipografías: Fredoka One para números/títulos display, Nunito para texto.
3. **Componentiza**: `<PodiumCard rank={1} />`, `<RankRow player={…} />`, `<LiveBadge />`. No copies el HTML monolítico.
4. **Animaciones**: las keyframes (`popIn`, `slideIn`, `flashGreen`, `flashRed`, `trophyFloat`, `ballSpin`) son parte del lenguaje del producto. Pórtalas a Tailwind animations o CSS modules; no las elimines.
5. **Realtime**: la lista debe reaccionar a eventos SSE. Cuando un jugador suba, aplica `flashGreen`; cuando baje, `flashRed`. Cuando cambien posiciones, anima con `slideIn`.
6. **Accesibilidad**: el reference es decorativo. Cuando lo portes:
   - Reemplaza emojis informativos por iconos accesibles + `aria-label`.
   - Banderas como emoji + `aria-label="México"` (lectores de pantalla no las leen bien).
   - Contraste: revisar que `--muted` cumpla AA sobre `--bg`.
7. **Reglas a corregir** del reference (artefactos del HTML original):
   - Custom properties usaban `–` (en-dash) en vez de `--`. En Tailwind/Next no se mantiene.
   - Comillas tipográficas `'…'` → comillas rectas.

## Lo que NO debes hacer

- Reescribir el sistema visual desde cero "porque es más limpio". El brand ya está definido.
- Mezclar el lenguaje visual del ranking con otras vistas (dashboard, login). El ranking es la pieza estrella; el resto es más sobrio.

## Resultado esperado

Componentes React + Tailwind que reproducen el lenguaje visual del reference, son accesibles, animan en respuesta a SSE, y son reutilizables.
