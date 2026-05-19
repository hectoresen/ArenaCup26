# add-mobile-polish

## Why

El diseño es mobile-first pero hay detalles sin verificar en device real:

- Safe-area iOS (notch, home indicator) — el bottom-nav puede solaparse con la barra de gestos.
- Hover states que en touch quedan "pegados" (sticky hover).
- Tap targets pequeños en el podium card (44x44 mínimo Apple HIG).
- Pull-to-refresh ausente.
- Sin haptic feedback en interacciones clave (predicción enviada, ranking sube).
- Sin instalación como PWA.

## What changes

Capability nueva: **`mobile-polish`**.

### Safe area

- `viewport-fit=cover` en `<head>`.
- `padding-bottom: env(safe-area-inset-bottom)` en `<BottomNav>`.
- `padding-top: env(safe-area-inset-top)` en `<TopNav>` o usar `pt-safe` con plugin.

### Sticky hover fix

- Wrap hover effects en `@media (hover: hover)` para que no se activen en touch.

### Tap targets

- Audit con Lighthouse. Mínimo 44x44 en cards del podium, botones de la campana, switches.

### Pull-to-refresh

- En `/ranking` y `/inicio`, gesture de pull → llama `router.refresh()`.
- Indicador visual (spinner).

### Haptic feedback

- `navigator.vibrate(...)` en:
  - Predicción enviada → vibrate(20).
  - Logro desbloqueado → patrón pulse.
  - Subir rank → ligero pulse.

### PWA

- `manifest.json` con icons, `display: standalone`, theme color.
- Service worker mínimo (reusado de `add-web-push-notifications`).
- Botón "Añadir a pantalla principal" en avatar dropdown si `beforeinstallprompt` disponible.

### A11y audit

- Pasar axe DevTools por cada ruta.
- Verificar focus visible en todo elemento interactivo.
- Verificar contraste 4.5:1 en text + 3:1 en UI components.

## Impact

- **Riesgo**: PWA en iOS requiere "Add to Home Screen" manual hasta iOS 18. Documentar.
- **Bloquea**: nada.
- **Desbloquea**: experiencia móvil pulida, pre-requisito para push iOS.
