# Roadmap consolidado — 2026-05-15

Merge entre el análisis del producto (Héctor, 2026-05-15) y el backlog
técnico existente (cyber-audit + propuestas OpenSpec abiertas).
Orden por **bloques** de valor/esfuerzo, no estricto secuencial:
dentro de un bloque las tareas son independientes y pueden moverse.

---

## Bloque A — Quick wins (1 sesión)

Cosas pequeñas pero visibles. Las hacemos primero para ganar
tracción.

- **A1 · Link "Ver ranking completo"** (`3.3`). Botón en
  `<MiniLeaderboard>` debe llevar a `/ranking`. Hoy no hace nada.
- **A2 · Hero stats: rank + racha**  (`3.2`). En `/inicio`,
  reemplazar la chip "Sin racha · 0" por "Tu posición · #N".
  Si hay racha activa, mover el chip "🔥 ×N" al header al lado
  de "Hola, {nombre}".
- **A3 · Copy marketing en ranking** (`1.2`). Pequeño párrafo
  sobre la landing/`/ranking` explicando que es gratis, que
  predices partidos del Mundial 2026 y compites con quien
  quieras. 2-3 líneas. Translate i18n.
- **A4 · Link "Volver al panel" en `/u/<username>`** (`5.1`).
  CTA discreto arriba/abajo que regrese a `/inicio` (solo cuando
  el viewer es el dueño del perfil; los anónimos no lo necesitan).

## Bloque B — Tie-breaking + online presence

Sistema de desempate definitivo + indicador online.

- **B1 · Última actividad** (`1.1`). Actualizar
  `users.last_active_at = now()` en cada request server-side del
  user logado (middleware o layout `(app)`). Indicador verde en
  `<RankRow>` si `last_active_at >= now() - 24h`.
- **B2 · Sistema de desempate** (`1.4` + `7`). Reordenar
  `getRealSnapshot` con tie-break:
    1. Total points desc *(ya hecho)*.
    2. Rachas: `(SELECT max(racha) FROM user_points)` o si guardamos
       `streak_max`. Necesita columna nueva `users_points.streak_max`
       que se actualiza en `processFinishedMatch`.
    3. "Calidad de rachas": # de hits que fueron simple vs double.
       Nueva columna `user_points.simple_hits` (cuenta de hits con
       `kind = 'simple'` o `'exact'`).
    4. Participación: # de predicciones totales (count `predictions`
       por user) — ya derivable, no necesita columna.
  Empate 0 sigue por `createdAt asc` *(ya hecho)*.
- **B3 · Docs scoring + FAQ** del tie-break. Actualizar
  `docs/scoring.md` y crear una entrada en `/faq` explicando el
  orden.

## Bloque C — Profile editor

Editar nombre + avatar desde el perfil propio.

- **C1 · `users.name_changed_at` + `users.image_changed_at`**.
  Cooldown de 48h por columna. Migración drizzle.
- **C2 · Galería de avatares pre-curados**. ~20 emojis grandes o
  ilustraciones SVG (deportivos, banderas, monumentos, animales).
  Server-side static asset; el user elige `avatar_id` (col nueva
  en users). Si `avatar_id` es null, usar `image` de Google.
- **C3 · `/u/<username>` editor inline** cuando viewer === owner
  (`5.2` + `5.3`):
   - Click en nombre → input inline + save (server action con
     cooldown check).
   - Click en avatar → modal con galería + opción "volver al de
     Google".
   - Toast 3s "Solo puedes cambiarlo cada 48h" cuando bloqueado.
- **C4 · Hola {nombre} editable in-place** (`2.2`). En `/inicio`
  el saludo es clickable; reusa la misma lógica de C3.
- **C5 · Caja "Últimas 5 predicciones"** (`5.4`) en `/u/<username>`
  propio. Sub-set de `getPredictionHistory(userId, limit=5)` con
  "Ver más" → `/historial`.
- **C6 · Stats de rachas** (`5.5`). Nueva caja:
  "Mejor racha · 7" "Rachas alcanzadas · 3" "Racha actual · 2".
  Requiere `streak_max` y un counter de rachas alcanzadas (≥3).
- **C7 · Caja "Mis invitaciones"** (`5.6`). Placeholder con copy
  "Aún no has invitado a nadie" + CTA "Invitar a un amigo"
  (fase 6 → no funcional aún).

## Bloque D — Cards de próximos partidos rediseñadas

- **D1 · `<MatchCard>` redesign** (`3.1`):
  Mobile-first:
  ```
  ┌───────────────────────────────────┐
  │   🇪🇸 España      🇨🇴 Colombia    │
  │   (logo nombre)   (logo nombre)   │
  │                                   │
  │            VS                     │
  │          Hoy · 22:30              │
  │                                   │
  │              [Predecir →]         │
  └───────────────────────────────────┘
  ```
  - VS centrado.
  - Equipos a cada lado con bandera + nombre, alineados verticalmente.
  - Fecha y hora debajo del VS.
  - Botón "Predecir" fijo en la esquina inferior derecha (o full
    width si la card es pequeña, depende de viewport).
  - Mantener "Cerrado" cuando kickoffPast.

## Bloque E — Partidos: dos sub-pestañas + bracket

- **E1 · Tabs internas** en `/partidos`:
  - "Todos" (vista actual).
  - "Bracket" (nuevo).
- **E2 · Vista bracket** (`4.1`). Diagrama de eliminatorias del
  Mundial 2026: octavos → cuartos → semis → final + 3er puesto.
  Cajas vacías para partidos sin equipos resueltos todavía. Cada
  caja muestra:
    - Partido jugado → marcador + tu predicción + puntos.
    - Partido futuro → tu predicción o CTA "Predecir".
    - Partido TBD → sombreado, sin acciones.
  Se conecta con `matches` filtrado por `stage IN ('round-of-16',
  'quarter', 'semi', 'third-place', 'final')`. Requiere componente
  visual nuevo (no es trivial).

## Bloque F — Invitaciones (fase análisis, no implementación)

- **F1 · Decisión técnica** (`6`):
  - **Modelo elegido**: link de invitación (`?invite=<userId>`)
    sobre email. Justificación: webapp ligera sin servicio de
    email, link tiene mayor conversion rate, no requiere setup
    de proveedor SMTP.
  - **Flujo propuesto**:
    1. User A clica "Invitar a un amigo" → genera link
       `https://wmundial.app/?invite=<A.userId>`.
    2. User B abre el link → cookie `wm_invite_by=<A.userId>`
       set 30 días.
    3. User B hace signup con Google.
    4. Auth.js callback signIn lee la cookie y crea fila en
       nueva tabla `invitations(inviter_id, invitee_id, created_at)`.
    5. Cuando B hace su primera predicción acertada (`first-hit`
       achievement), se desbloquea `better-with-friends` para A
       (logro existente).
- **F2 · Schema** (placeholder en este bloque):
  ```sql
  CREATE TABLE invitations (
    id uuid PRIMARY KEY,
    inviter_id uuid REFERENCES users(id),
    invitee_id uuid REFERENCES users(id) UNIQUE,
    created_at timestamptz DEFAULT now(),
    activated_at timestamptz NULL
  );
  ```
- **F3 · Copys frontales no funcionales**: solo cajas en perfil
  + CTA "Invitar". Botón abre modal con link copiable.
- **F4 · Implementación funcional**: se decide en una sesión
  posterior cuando el resto esté maduro.

## Bloque G — País por IP (decisión)

- **G1 · Análisis RGPD/cookies** (`2.1`):
  - Si solo leemos `request.geo.country` (Vercel/Cloudflare) y NO
    persistimos la IP, NO se necesita banner de cookies
    (legitimate interest). Aplicaríamos en el wizard `/bienvenido`
    pre-rellenando el selector de país.
  - Si persistiéramos la IP, sí necesitaríamos banner.
  - **Decisión recomendada**: pre-rellenar con geo del request +
    user puede cambiar antes de confirmar. Sin persistir IP.
  - Railway no expone `geo` nativamente (es Vercel/Cloudflare-only);
    para hacerlo en Railway necesitamos llamar a un servicio
    externo (ipapi.co, ip-api.com, etc.) — coste latency + free
    tier limitado. Para el sprint actual: no auto-detectar, dejar
    el wizard manual.

## Pendientes del backlog técnico original

Sin solapamiento con el análisis de producto, siguen activos:

- **CRIT-1 · Rotar credenciales filtradas**
  (`API_FOOTBALL_KEY`, `GOOGLE_CLIENT_SECRET`). Tarea operativa
  manual, al final del sprint.
- **Activar Sentry**: crear cuenta + `SENTRY_DSN` en Railway.
  Sin esto, el monitoring sigue en noop.
- **Páginas legales** (`/privacy`, `/terms`). Necesarias antes
  de abrir signups públicos en EU.
- **add-social-friends** (relaciones bidireccionales). Tras
  bloques A-F arriba, este es el siguiente gran salto del
  producto. La caja `5.6` "Mis invitaciones" es el preámbulo.
- **add-leaderboard-sse** (push real). Reemplaza polling 30s.
- **add-ranking-history** (delta ▲/▼ + sparkline reales).
- **add-matches-filters** (filtros sobre `/partidos`).
- **add-live-scoring** (workflow `*/2` durante partidos en curso).
- **add-product-analytics** (Plausible).
- **add-mobile-polish** (PWA + safe-area iOS + a11y audit).
- **add-data-resilience** (pg_dump → R2 + status page + PR envs).
- **add-e2e-tests** (Playwright golden paths).
- **add-web-push-notifications** (retención fuera de app).

## Orden de ataque sugerido

```
Sprint 1 (esta sesión):  Bloque A + Bloque B
Sprint 2:                Bloque C (profile editor)
Sprint 3:                Bloque D (cards rediseñadas)
Sprint 4:                Bloque E (bracket Mundial)
Sprint 5:                Bloque F (invitaciones, fase implementación)
Sprint 6+:               add-social-friends + leaderboard-sse + …
```

Esto es una guía; cualquier ítem se puede mover si descubrimos
un dependency o si el coste real difiere.
