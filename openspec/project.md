# project.md — WebMundial 26

Contexto vivo del proyecto para asistentes IA. Actualízalo cuando una decisión cambie.

## Vision

Experiencia social-competitiva alrededor del Mundial 2026. La estrella es un **ranking en vivo** de usuarios que predicen partidos y acumulan puntos. Los resultados deportivos son secundarios.

## Audiencia

- Aficionados al fútbol que quieren competir entre amigos durante el Mundial.
- Sesgo a móvil (web-first responsive, no app nativa).
- Idioma principal: español. Inglés en backlog.

## Stack & rationale

- **Next.js 15 (App Router) + React 19** — Server Components y streaming encajan con el ranking en vivo (SSE) y reducen JS en cliente.
- **TypeScript estricto** — el dominio (puntos, predicciones) gana mucho con tipos.
- **Tailwind v4** — `docs/leaderboard-reference.html` ya define un sistema de colores; lo portamos a `@theme`.
- **PostgreSQL (Neon) + Drizzle** — relacional encaja con users/matches/predictions; Drizzle es TS-first y serverless-friendly.
- **Auth.js v5** — Google OAuth para onboarding rápido en fase 1; sesiones en DB. El provider `credentials` para registro manual queda diferido a fase 2 (depende de infra de email).
- **SSE en vez de WebSockets** — el ranking es push servidor→cliente unidireccional; SSE evita un servidor stateful y encaja con Vercel serverless.
- **Zod** — validación en bordes (formularios, payloads de API, env).
- **Vitest + Playwright** — Vitest cerca del código, Playwright para flujos críticos (login, predicción, ver ranking).

## Restricciones / decisiones cerradas

- No hay app nativa. Solo web responsive.
- No moneda real, no apuestas. Solo puntos virtuales.
- Datos de partidos: por definir (¿API externa? ¿carga manual?). Pendiente decisión de dominio.
- Privacidad: mínima recogida (email, nombre, avatar). RGPD aplica.

## Fuera de alcance (por ahora)

- Chat entre usuarios.
- Notificaciones push móviles.
- Internacionalización completa.
- Pagos / monetización.

## Dominio (resumen, ver `docs/glossary.md`)

- **Predicción** — voto de un usuario sobre un partido.
- **Acierto simple** — usuario acertó ganador o empate.
- **Acierto exacto** — usuario acertó marcador.
- **Combo** — N aciertos consecutivos sin fallo.
- **Racha** — número actual de aciertos consecutivos del usuario.
- **Puntos** — moneda virtual del ranking. Reglas en `docs/scoring.md`.

## Decisiones cerradas

- **Scoring** (2026-05-05, ampliado 2026-05-06 con doble predicción) — tabla de puntuación, combos, doble oportunidad, anti-trampas y política de referidos fijados en `docs/scoring.md`.
- **Notificaciones — fase 1** (2026-05-06) — solo **in-app** (toasts, feed de actividad, badge de campana). Web Push y email transaccional diferidos a fase 2.
- **Auth — fase 1** (2026-05-06) — solo **Google OAuth**. El registro manual con email/contraseña queda diferido a fase 2 (requeriría infra de email transaccional para verificación y recuperación de contraseña).
- **Achievements** (2026-05-06) — catálogo de 24 logros en 6 tiers fijado en `docs/achievements.md`. Evaluación al cierre oficial de partido (no con provisionales).
- **Perfil público** (2026-05-06) — alcance fijado en `docs/public-profile.md`: identidad, stats básicas, bandera opcional, catálogo de logros. Accesible sin login.
- **Reglas de partidos** (2026-05-07) — taxonomía de 7 estados, ventana de predicción desde fixture, comportamiento de pospuesto y cancelado, reglas específicas de eliminatoria (marcador hasta 120', ganador con penaltis, dobles `1X`/`X2`/`12` desactivadas). Detalles en `docs/business-rules.md`.
- **Reglas de cuenta** (2026-05-07) — username `[a-z0-9_]` 3-20 lowercase, lista cerrada de rutas reservadas, cambio único con reserva permanente del viejo, hard delete al eliminar cuenta. Detalles en `docs/business-rules.md`.

## Decisiones pendientes

Cosas que el equipo debe cerrar antes de implementar:

1. **CRÍTICA — Origen de datos** de fixture, resultados y eventos en vivo (capability `match-data`). Requisitos ampliados: cobertura del Mundial 26, eventos en tiempo real (no solo resultado final), redundancia con **dos APIs en paralelo** (failover). Pre-análisis de candidatas en `docs/match-data-research.md`. **Bloquea** el modo en vivo de `scoring-engine` y `leaderboard`.
