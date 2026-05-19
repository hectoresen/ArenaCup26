# Tasks — add-social-friends

## Schema

- [ ] 1. Enum `friendship_status` ('pending', 'accepted', 'blocked').
- [ ] 2. Tabla `friendships` con unique compuesto.
- [ ] 3. Migration drizzle.

## Server

- [ ] 4. `src/server/friends/queries.ts` con todas las queries listadas.
- [ ] 5. Validación: no self-friend, no duplicado, no si bloqueado.
- [ ] 6. Tests unit con BD en memoria.

## UI perfil público

- [ ] 7. Botón dinámico "+ Añadir" / "⏳ Pendiente" / "✓ Amigos" según estado.
- [ ] 8. Action handler client.

## Páginas dedicadas

- [ ] 9. `/amigos` lista amigos + buscador por username.
- [ ] 10. `/amigos/solicitudes` con accept/reject.
- [ ] 11. Badge en avatar/nav con pending count.

## Mini-leaderboard de amigos

- [ ] 12. Switch en `/inicio` "Global / Amigos".
- [ ] 13. Switch en `/ranking` idem.

## MatchCard hint

- [ ] 14. Query "¿cuántos amigos del current user predijeron match X?".
- [ ] 15. Renderiza badge si > 0.

## Notificaciones

- [ ] 16. Extender enum `notification_kind` con `friend_request`, `friend_accepted`.
- [ ] 17. Crear notificación en `sendFriendRequest` y `acceptFriendRequest`.

## i18n

- [ ] 18. Namespace `friends.*` para los 4 locales.

## Tests

- [ ] 19. Component test de cada estado del botón.
- [ ] 20. E2E: user A invita a user B, B acepta, A ve a B en lista.

## Docs

- [ ] 21. `docs/decisions.md` §20 con "amistad bidireccional vs follow asimétrico" (elegimos bidireccional con accept).
