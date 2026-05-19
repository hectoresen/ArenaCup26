# add-social-friends

## Why

El producto se describe como "plataforma social y competitiva", pero hoy es 100% competitivo individual. El user puede ver el ranking global, su rank, sus logros — pero no puede:

- Añadir a otros usuarios como amigos.
- Ver un mini-ranking solo entre amigos.
- Comparar su perfil 1-a-1 contra otro.
- Saber qué amigos predicieron el próximo partido.

Sin esto, la app no engancha: el user mira su rank, ve que está #1230 de 12k, y se cierra. Con amigos: "estoy 2º entre mis 10 amigos esta semana" → vuelve.

## What changes

Capability nueva: **`social-friends`**.

### Schema

`friendships` table:
- `id uuid pk`.
- `requester_id uuid fk users.id cascade`.
- `addressee_id uuid fk users.id cascade`.
- `status enum friendship_status ('pending', 'accepted', 'blocked') not null default 'pending'`.
- `created_at timestamp default now()`.
- `accepted_at timestamp nullable`.
- Unique(`requester_id`, `addressee_id`).

### Server

- `sendFriendRequest(fromId, toUsername)`.
- `acceptFriendRequest(reqId)`, `rejectFriendRequest(reqId)`, `removeFriend(fromId, otherId)`.
- `getFriends(userId)` — lista accepted.
- `getFriendsLeaderboard(userId)` — el mismo getRealSnapshot pero filtrado a `userId IN (friends + me)`.
- `getPendingRequests(userId)` — para badge en el nav.

### UI

- En `/u/<username>` un botón **"+ Añadir amigo"** o **"⏳ Pendiente"** o **"✓ Amigos"**.
- En el avatar dropdown del shell, nueva entrada **"Amigos"** con sub-páginas:
  - `/amigos` — lista de amigos.
  - `/amigos/solicitudes` — pendings.
- En el dashboard, opción "Ver mini-leaderboard entre amigos" (toggle).
- En `<MatchCard>`, "3 amigos predijeron este partido" como hint si ≥1 amigo lo hizo.

### Notificaciones

- Nuevo `notification_kind: friend_request`, `friend_accepted`.
- Push (cuando aterrice `add-web-push-notifications`).

## Impact

- **Schema**: 1 tabla nueva + enum.
- **Bloquea**: nada.
- **Desbloquea**: gran parte del atractivo social. Aumenta retención significativamente.
