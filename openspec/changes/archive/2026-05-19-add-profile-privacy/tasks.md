# Tasks — add-profile-privacy

## Schema

- [ ] 1. Decidir: tabla `user_privacy` o JSONB en `users`. Probable JSONB para evitar JOIN.
- [ ] 2. Migration con default values (todos `true`, visibility `public`).

## Server

- [ ] 3. `getPublicProfile` con `viewerId` opcional.
- [ ] 4. Lógica de gating (private → 404 salvo owner; friends_only → check amistad).
- [ ] 5. Stripping de fields según toggles.

## Leaderboard

- [ ] 6. `getRealSnapshot` respeta `show_points` y `show_name_initial_only`.
- [ ] 7. `<RankRow>` no clicable cuando user es private.

## UI ajustes

- [ ] 8. `/ajustes/privacidad` con switches grandes + preview.
- [ ] 9. Action handler que persiste cambios.
- [ ] 10. Link desde avatar dropdown.

## i18n

- [ ] 11. Namespace `privacy.*`.

## Tests

- [ ] 12. Unit de cada combinación.
- [ ] 13. E2E: setear private → otro user va a /u/<username> y ve 404.

## Docs

- [ ] 14. `docs/decisions.md` §21 con default policy + razón.
- [ ] 15. `docs/privacy.md` con explicación de toggles para users.
