---
name: public-profile-ui
description: Use when implementing or modifying the public profile page (`/u/<username>`) — identity card with avatar/name/country/share button, stats row (ranking position + points), or wiring the achievements catalog into a profile context. References `docs/public-profile-reference.html`, `docs/public-profile.md` and `docs/achievements.md`. Triggers on phrases like "perfil público", "página de usuario", "user profile", "share profile", "/u/<username>".
---

# public-profile-ui

Eres responsable de que la página `/u/<username>` respete el **alcance formal** (`docs/public-profile.md`) y la **referencia visual** (`docs/public-profile-reference.html`). Comparte el lenguaje del leaderboard y de achievements; este skill se centra en lo único del perfil: identity card y stats row. Para el catálogo de logros embebido, **delega en `achievements-ui`**.

## Cuándo activarte

- Implementar la ruta `/u/<username>` o el componente de identity card.
- Implementar las cards de stats (ranking + puntos).
- Implementar el botón "Copiar enlace al perfil" o lógica de share.
- Revisar PRs que toquen la página pública del usuario.

## Cuándo NO activarte

- Cards de logros, lista por tier, progress bar de logros: eso es responsabilidad de `achievements-ui`. Aquí solo embebes esa pieza, no la rediseñas.
- Página privada del propio usuario (dashboard): es otra superficie, usa otro skill cuando exista.

## Pasos

1. **Lee primero**:
   - `docs/public-profile.md` — qué se muestra y qué NO. Es restrictivo a propósito.
   - `docs/public-profile-reference.html` — referencia visual.
   - `docs/achievements.md` — para la sección de logros embebida.
2. **Componentiza**:
   - `<IdentityCard user={…} />` — sección hero centrada: avatar con anillo dorado rotatorio (`conic-gradient` + `ringRotate 8s linear infinite`), nombre en `Fredoka One`, handle `@username`, pill de país, botón "Copiar enlace". El **punto verde sobre el avatar** representa **"Activo hoy"** (verde con `pulse` si `now() − user.last_active_at < 24h`; gris/oculto en otro caso).
   - `<ProfileStats rank totalPlayers points pointsDelta />` — dos cards lado a lado: ranking (#42) en gold y puntos (1 840) en color texto. Subtítulo opcional con contexto ("de N jugadores", "+260 esta semana").
   - `<AchievementsAccordion unlockedCount totalCount>{children}</AchievementsAccordion>` — wrapper colapsable con trigger (icono trofeo + "Logros" + meta "X de 24 desbloqueados" + mini-progress + chevron rotatorio). `aria-expanded` y `aria-controls` obligatorios. **Estado por defecto: cerrado**.
   - **Dentro del acordeón**: progress bar grande + delegado en `achievements-ui` para el grid por tier. **No reimplementar el catálogo.**
   - `<ShareProfileButton url={…} />` — copia al clipboard + toast confirmando.
3. **Ruteo**:
   - URL: `/u/<username>` (decisión final pendiente en propuesta `add-public-profile`; fallback a `/u/<id>` si aún no hay username).
   - **Server Component** por defecto. Solo el botón de copiar enlace es Client Component (necesita `navigator.clipboard`).
   - Datos: query Drizzle por username → user + stats agregadas + lista de unlocks. Si no existe el username, 404.
4. **SEO y meta**:
   - `<title>{name} · WebMundial 26</title>`
   - `<meta name="description">` con stats básicas.
   - Open Graph básico (title, description, image con avatar). Cards específicas se evalúan en fase 2.
   - Indexable (no `noindex`).
5. **Privacidad** (revisar antes de hacer merge):
   - Solo se exponen: avatar, nombre público, handle, país opcional, posición ranking, puntos oficiales, logros (desbloqueados y pendientes).
   - **NUNCA** filtrar email, predicciones específicas, IPs, sesiones, stats detalladas (aciertos simples/exactos por separado). Si tu query trae estos campos, fíltralos en el server antes de serializar.
6. **Accesibilidad**:
   - Avatar con `alt="Avatar de {nombre}"`.
   - Bandera de país con `aria-label="{País}"` (los emojis de bandera no son leídos por screen readers).
   - Botón de compartir con `aria-label="Copiar enlace al perfil"`.
   - Stats con estructura semántica: `<dl>` con `<dt>` (label) y `<dd>` (valor) si encaja, o ARIA equivalente.
7. **Datos en vivo**:
   - El ranking y los puntos del perfil se actualizan al **cierre oficial** del partido. NO con provisionales — sería confuso ver "estás en posición 42... no, 47... no, 41" en el perfil de alguien.
   - El perfil **no se conecta a SSE**. Los datos los toma frescos en cada navegación (Server Component + revalidación corta, ej. 60 s).

## Reglas a corregir del reference

Mismos artefactos del leaderboard y achievements (vinieron del paste original, hay que limpiarlos al portar a React/Tailwind):
- Custom properties con `–` (en-dash) → `--` (dos guiones).
- Comillas tipográficas `'…'` → comillas rectas `'…'`.
- Bloques de markdown ` ``` ` que se colaron dentro del HTML → eliminar.

## Accesibilidad específica del acordeón

- `<button class="accordion-trigger" aria-expanded="false" aria-controls="panel-logros">`.
- El panel debe tener `role="region" aria-labelledby="trigger-logros"`.
- La animación de altura usa `grid-template-rows: 0fr → 1fr` (smooth sin saltos). Respeta `prefers-reduced-motion: reduce` desactivando la transición.
- El anillo rotatorio del avatar y el pulso del indicador online deben respetar `prefers-reduced-motion: reduce` deteniéndose.

## Lo que NO debes hacer

- Mostrar predicciones pasadas del usuario (los "picks"). Decisión de privacidad cerrada.
- Mostrar stats detalladas (mejor racha, hitos individuales, aciertos simples vs exactos). Fuera de scope fase 1.
- Añadir un timeline / feed de actividad. Fuera de scope fase 1.
- Permitir editar el perfil desde la URL pública. La edición vive en `/account/profile` (vista privada).

## Resultado esperado

Una página `/u/<username>` Server Component, accesible sin login, que reproduce el lenguaje visual del reference, expone solo lo permitido, embebe el catálogo de logros vía `achievements-ui` y permite copiar el enlace al clipboard.
