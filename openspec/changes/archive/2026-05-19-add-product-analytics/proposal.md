# add-product-analytics

## Why

No tenemos ningún tipo de analítica. No sabemos:
- Cuántos users entran a la landing y abandonan vs hacen login.
- Cuántas predicciones se hacen por jornada.
- Qué páginas son las más visitadas dentro del shell.
- Cuántos users completan el onboarding.
- Cuántos abren la app desde una notificación push (cuando exista).

Sin datos no podemos priorizar bien. Decidir entre `add-social-friends` y `add-matches-filters` es a ciegas.

## What changes

Capability nueva: **`product-analytics`**.

### Stack

**Plausible** (privacy-friendly, no cookies, cumple GDPR sin banner) — opción primaria. Alternativa: PostHog (más potente con session replay, pero requiere banner cookies en EU). Recomendado Plausible para evitar el coste de UX del banner.

### Setup

- Crear cuenta en plausible.io.
- Self-host: no (requiere infra extra). SaaS plan 9€/mes.
- Añadir script en `<head>` con CSP `'plausible.io'` en allowlist.

### Eventos custom

Más allá del pageview automático, trackear vía `plausible('Event', { props })`:

- `Signup` con `provider: 'google'`.
- `OnboardingStarted`, `OnboardingCompleted`, `OnboardingSkipped`.
- `PredictionSubmitted` con `kind: 'simple'|'exact'|'double-1x'|'double-x2'`.
- `MatchOpened` con `status`.
- `AchievementUnlocked` con `tier`.
- `FriendRequestSent`, `FriendRequestAccepted` (cuando aterrice `add-social-friends`).
- `PushSubscribed`, `PushClicked` (cuando aterrice `add-web-push-notifications`).
- `RankingViewed` con `scope: 'global'|'friends'`.

### Dashboards

- Funnel: landing → signup → onboarding completed → primera predicción → primer acierto.
- Retención: % users que vuelven D1, D7, D30.
- Engagement: predicciones/jornada/user.

## Impact

- **Coste**: 9€/mes Plausible. Aceptable.
- **Privacy**: Plausible no usa cookies; sin GDPR banner.
- **Bloquea**: `add-security-hardening` (CSP debe incluir plausible.io).
- **Desbloquea**: decisiones product-driven.
