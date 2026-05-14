# add-onboarding-flow

## Why

Cuando un usuario nuevo entra por primera vez (vuelta del Google OAuth) lo soltamos directamente en `/inicio` con:
- Username auto-generado (no le hemos preguntado).
- País null (no sabemos su bandera).
- 0 logros, 0 puntos, racha 0.
- Sin idea de cómo funciona el sistema (simple/exact/dobles/combos/rachas).

Eso lleva a:
- Banderas vacías en el leaderboard.
- Usuarios que no entienden por qué un exact da 30 pts y un simple solo 10.
- Predicciones que se quedan en `double-1x` o `double-x2` sin saber por qué nunca dan tantos puntos.

## What changes

Capability nueva: **`onboarding-flow`**.

### Trigger

El primer login tras OAuth → si `users.country` es null Y `users.onboarded_at` es null, redirige a `/bienvenido` antes de `/inicio`.

### Schema

`users` nueva columna:
- `onboarded_at: timestamp("onboarded_at")` nullable, default null.

### Página `/bienvenido` (3 pasos)

1. **Identidad**: nombre confirmable + selector de país (combobox con bandera). Username auto-generado pero editable (validación reusada de `add-auth-google`).
2. **Cómo funciona**: una pantalla con 3 cards (simple = 10 pts, exact = 30 pts, dobles = 5 pts) + explicación corta de rachas y combos (3/5/10 hits seguidos = bonus). Mockup gráfico con emojis.
3. **Listo**: CTA "Empezar" → marca `onboarded_at = now()` + redirige a `/inicio`.

Cada paso tiene "Saltar" (no es bloqueante; los users que skip se quedan con auto-gen + tutorial accesible siempre desde `/faq`).

### i18n

- `onboarding.step1.{title,subtitle,namePlaceholder,countryPlaceholder,...}`.
- `onboarding.step2.{title,simpleTitle,simpleDesc,exactTitle,...}`.
- `onboarding.step3.{title,cta}`.

## Impact

- **Migración**: añade `onboarded_at` (nullable). Sin migración de datos: usuarios existentes lo tienen null → al siguiente login pasan por onboarding. Aceptable.
- **UX**: añade 3 clics al primer login. Mejor que un user perdido.
- **Bloquea**: nada.
- **Desbloquea**: dashboard con banderas correctas; user que entiende el scoring.
