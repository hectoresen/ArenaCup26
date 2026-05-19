# add-matches-filters

## Why

`/partidos` agrupa por día y muestra todos los partidos sin filtro. En el modo `date-window` actual el sync trae partidos de **todas las ligas** del rango (a menos que `MATCH_DATA_LEAGUE_FILTER` esté set). Si dejamos el filtro vacío para no perdernos ligas activas, el listado se llena de:

- Partidos del MLS Next Pro.
- 3. Division Norway.
- Tunisia Ligue 1.
- ...

Imposible navegar para un user que solo quiere ver La Liga + Champions o seguir solo MLS.

## What changes

Capability nueva: **`matches-filters`**.

### Filtros UI

Top de `/partidos`:
- **Pills** seleccionables: "Todos" / "En vivo" / "Hoy" / "Mañana" / "Esta semana".
- **Dropdown ligas** con multi-select. Por defecto: ligas con ≥1 partido en la ventana actual. Búsqueda inline.
- **Switch "Solo con mi predicción"**: muestra solo partidos donde ya he submitted.
- Filtros persistidos en URL (`?leagues=140,253&when=this-week&onlyMine=true`).

### Schema (opcional)

Considerar `user_preferences` table o JSONB col en `users` con `favorite_leagues int[]` para que los filtros sean default por user.

### Backend

`getMatchesList({ db, userId, when, leagueIds, onlyMine })` adapta `WHERE matches.kickoff_at BETWEEN ... AND ...` + `leagues IN (...)` con el set de filtros.

### Empty states

Si los filtros dejan 0 resultados → variante del `EmptyMatchesState` con "No hay partidos que coincidan con tus filtros" + CTA "Quitar filtros".

## Impact

- **Coste**: una query más con índices apropiados (kickoff_at ya indexado).
- **Bloquea**: nada.
- **Desbloquea**: navegabilidad de `/partidos` cuando el catálogo crezca.
