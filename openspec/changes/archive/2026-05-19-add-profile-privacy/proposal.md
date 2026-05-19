# add-profile-privacy

## Why

Hoy `/u/<username>` es siempre público. Cualquiera con la URL ve:
- Nombre real, país, foto.
- Puntos exactos, racha, aciertos.
- Catálogo completo de logros desbloqueados.

Para muchos users esto es invasivo, sobre todo si comparten cuenta de Google con foto real. Necesitamos controles granulares.

## What changes

Capability nueva: **`profile-privacy`**.

### Schema

`user_privacy` table o JSONB col en users con:
- `profile_visibility enum('public', 'friends_only', 'private')` default `public`.
- `show_name_initial_only boolean` default `false`.
- `show_country boolean` default `true`.
- `show_image boolean` default `true`.
- `show_points boolean` default `true`.
- `show_achievements boolean` default `true`.

### Server

- `getPublicProfile(db, username, viewerId)` ahora recibe el `viewerId`.
- Si `profile_visibility = 'private'` → notFound (excepto si `viewerId === ownerId`).
- Si `profile_visibility = 'friends_only'` y no son amigos → notFound (depende de `add-social-friends`).
- Stripping de campos según los toggles. Si `show_country: false`, devuelve null en country/flag.

### UI ajustes

- `/ajustes/privacidad` con switches.
- Preview "Así te ven los demás" en la misma página.

### Leaderboard impact

- Por defecto, todos siguen visibles en el ranking (`show_points: true`).
- Si el user pone `show_points: false`, en `/ranking` aparece como "Jugador anónimo #1234" con su rank pero sin nombre.
- Si pone `profile_visibility: private`, el row se renderiza no clicable.

## Impact

- **Schema**: 1 tabla nueva o JSONB en users (decidir en task §1).
- **UX**: feature claramente necesaria pero no urgente.
- **Bloquea**: nada.
- **Desbloquea**: confianza para users que no quieren exponer datos reales.
