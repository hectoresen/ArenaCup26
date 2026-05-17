# Testing — estrategia y estándares

Este documento define **cómo se prueba el código de ArenaCup26** y por qué. Lee esto antes de añadir o cambiar tests.

## Filosofía

1. **Los tests son la especificación del comportamiento esperado.** El código es el medio para satisfacer esa especificación, no al revés.
2. **Cuando un test falla, primero se cuestiona el código.** Si tras inspeccionarlo concluyes que el comportamiento debe cambiar, el cambio se justifica en la PR; nunca se "ajusta el test al nuevo caso" sin entender por qué.
3. **Los tests deben ser auto-explicativos.** El nombre del test es la regla del producto, no el nombre de la función. Compara:
   - ❌ `it("calls insert with correct args")`.
   - ✅ `it("guarda una redemption por invitee aunque el link sea ilimitado")`.
4. **Prohibido `any`** en código de producción. En tests permitido solo en mocks donde es la forma idiomática de Vitest, y aun así se prefiere `unknown` o tipos exactos cuando es viable.

## Capas

| Capa                  | Herramienta                 | Cuándo se usa                                                                                          |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Unit**              | Vitest                      | Funciones puras: scoring engine, transformaciones, helpers, normalizadores, generadores.               |
| **Component**         | Vitest + Testing Library    | Componentes React. Validan render según props, interacciones (`userEvent`) y accesibilidad básica.     |
| **Integración local** | Vitest (mocks puntuales)    | Server actions: validamos el contrato (return + side effect simulado) sin tocar BD real.               |
| **E2E**               | Playwright                  | Páginas públicas + flujos críticos sin login complejo. Corre en CI sobre `npm run build && start`.     |

### Por qué no integración full con BD

Levantar un Postgres real en cada run (testcontainers, pg-mem) añade tiempo y complejidad para un beneficio que en gran parte ya cubrimos:
- Las **transformaciones puras** (la mayoría del scoring engine, los resolvers, los normalizadores) viven en módulos aislados y se prueban directo.
- Las **queries con SQL** se cubren funcionalmente en E2E + smoke manual post-deploy.

Cuando una capability se vuelva mission-critical (p. ej. el pipeline de scoring tras el primer partido del Mundial), abriremos una propuesta `add-test-db-fixtures` para introducir testcontainers solo en esa capa.

## Patrones de tests aceptados

### Funciones puras
- Importar la función, llamarla con inputs explícitos y comparar la salida.
- Cubrir: caso feliz, casos borde (vacío, null, una sola entrada, secuencias no monótonas), invariantes documentados.
- Naming: el nombre del test describe la **regla de negocio**, no el shape del input.

```ts
it("better-with-friends triggers on first referred user's first hit", () => {
  expect(RULES["better-with-friends"]?.(ctx({ referredFirstHits: 0 }))).toBe(false);
  expect(RULES["better-with-friends"]?.(ctx({ referredFirstHits: 1 }))).toBe(true);
});
```

### Componentes React
- Usar `renderWithProviders` (incluye next-intl + theme).
- Buscar elementos por **rol/label/texto visible**, no por `data-testid` salvo último recurso.
- Para interacción: `userEvent.setup()` + assertions sobre el mock del server action.

```ts
it("calls sendFriendRequest with the typed username (strips leading @)", async () => {
  const user = userEvent.setup();
  renderWithProviders(<AddFriendForm />);
  await user.type(screen.getByPlaceholderText("@username"), "@krawer");
  await user.click(screen.getByRole("button", { name: /Enviar/ }));
  expect(mockedSend).toHaveBeenCalledWith("krawer");
});
```

### Server actions / módulos con I/O
- Mockear el cliente de Drizzle a nivel de método (`db.insert`, `db.select`, ...).
- Verificar:
  - Que la action devuelve el `Result` esperado.
  - Que llama al método correcto del db (sin asertar el SQL exacto — eso es implementación).
  - Que llama a `revalidatePath` con la ruta correcta.
- Si la lógica de negocio es no-trivial (validaciones, race-conditions, idempotencia), **extrae** la parte pura a un helper testeable y prueba ese helper en lugar del wrapper.

Ejemplo del patrón "extraer la pieza pura":
- `getRankHistory` toca BD → no testeable directamente.
- Extraemos `summarizeRankHistory(rows)` → testeamos esto con 4 casos (vacío, 1 elemento, serie monótona, serie no monótona).
- `getRankHistory` queda como un wrapper trivial (SELECT + delegate al helper). Su contrato se valida en E2E.

## Coverage

- Provider: `@vitest/coverage-v8`.
- Comando: `npm test -- --coverage` (o `npx vitest run --coverage`).
- Threshold actual en `vitest.config.ts` (2026-05-16):

| Métrica   | Threshold | Estado actual | Meta mid-term | Meta long-term |
| --------- | --------- | ------------- | ------------- | -------------- |
| Statements | 39 %     | 39.87 %       | 60 %          | 80 %+          |
| Branches   | 77 %     | 77.61 %       | 80 %          | 90 %+          |
| Functions  | 50 %     | 51.44 %       | 70 %          | 90 %+          |
| Lines      | 39 %     | 39.87 %       | 60 %          | 80 %+          |

Si una PR baja del threshold, el comando falla. **No bajes el threshold para que pase**: añade tests donde aplique o, si la parte nueva no necesita test (e.g. un nuevo `route.ts` que solo orquesta helpers ya probados), añádelo al `exclude` de `coverage` con justificación en el commit.

### Roadmap de cobertura

Las grandes lagunas conocidas (pendientes de cerrar, en orden de prioridad):

1. **`src/server/scoring/pipeline.ts` (currently 0 %).** El engine puro (`engine.ts`) está al 100 %; el pipeline orquesta + persiste. Hay un test para `matchRowToOutcome`. Falta cubrir el flujo de `processFinishedMatch` extrayendo la decisión "is hit?" a un helper puro y mockeando `persistScore`.

2. **`src/lib/leaderboard/real.ts` (currently 0 % en coverage detail).** El `getRealSnapshot` arma el snapshot con joins; el `getRealSnapshotForUser` hace un query extra. Extraer el row → `Player` mapper a una función pura y testearla con fixtures.

3. **`src/server/friends/queries.ts` y `actions.ts` (currently 0 %).** Las acciones tienen reglas de negocio complejas (`already_pending`, `already_friends`, `blocked`, `self`). Mockear el db y validar cada code path. La query `areFriends` es trivial pero merece un test de "bidireccional" (la fila puede estar en cualquier dirección).

4. **`src/server/invitations/redemption.ts::redeemInvitationForUser` (currently 0 %).** Test del flujo principal: token inválido, self-redeem, ya redimido, exhausto, redemption atómica + friendship + notificación.

5. **`src/server/invitations/referral-payout.ts` (currently 0 %).** El atomic claim es el punto sensible. Test: dos llamadas concurrentes simuladas → solo una paga.

6. **`src/server/notifications/create.ts` (currently 0 %).** Trivial pero contrato público; un test que verifica el shape del INSERT.

7. **`src/server/predictions/submit.ts` (currently 0 %).** Server action core del producto. Validaciones zod, ventana de predicción, idempotencia.

8. **`src/server/push/*` (currently 0 %).** `sendPushTo` tiene tres ramas (`not_configured`, `gone`, `transient`). Mockear el cliente web-push.

9. **`src/server/profile/actions.ts` (currently 0 %).** Cooldown 48h, validaciones de avatarId, normalización de nombres.

Cada gap merece su propia PR con tests + (si hace falta) refactor que extraiga la parte pura.

## Anti-patrones a evitar

- **No usar `toMatchSnapshot`** para componentes con muchos elementos: los snapshots se aceptan ciegamente y dejan de proteger. Solo para outputs estables y específicos (e.g. el JSON resultado de un transform).
- **No reproducir las constantes del código en los tests.** Si una regla dice "10 puntos por referido", el test debería poder fallar si alguien cambia `REFERRAL_BONUS` a 5. Importa la constante o derívala del catálogo (`docs/scoring.md`).
- **No mockear funciones que no necesitas mockear.** Si un componente cliente solo usa `useTranslations`, el provider del helper de tests ya lo cubre — no añadas un `vi.mock` para cada hook de next-intl.
- **No usar `setTimeout` para esperar a un effect.** Usa `await screen.findByText(...)` o `waitFor(...)`.
- **No probar implementation details.** "Que se llame a este método interno" no es un test válido. El contrato observable (return value, DOM, side effect) sí.

## Cuando un test falla en CI

1. Lee el mensaje de error completo. La mayoría de las veces es claro (assertion fallida, prop faltante, mock mal configurado).
2. Reproduce local: `npx vitest run <archivo>`.
3. Si el comportamiento esperado cambió por una decisión deliberada del producto, actualiza el test **y** documenta el motivo en el commit.
4. Si el comportamiento NO debería haber cambiado, revisa el diff que rompió el test — ahí está el bug.
5. Nunca commitees `.skip` o `xfail` sin abrir un issue/TODO con fecha de cierre.
