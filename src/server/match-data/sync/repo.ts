import type { Database } from "@/server/db/client";
import {
  matchExternalIds,
  matches,
  pointEvents,
  predictions,
  teamExternalIds,
  teams,
} from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type {
  CurrentMatchRow,
  DbMatchStatus,
  MatchExternalMap,
  MatchInsertRow,
  MatchRepo,
  MatchUpdatePatch,
  ProviderTeamUpsert,
  TeamExternalMap,
} from "./types";

/**
 * Implementación del `MatchRepo` contra Drizzle + Postgres. El
 * orquestador `syncFixtures` no la conoce directamente: recibe el
 * shape de `MatchRepo` y se mockea trivialmente en tests.
 */
export function createMatchRepo(db: Database): MatchRepo {
  return {
    async loadTeamMap(source) {
      const rows = await db
        .select({ teamId: teamExternalIds.teamId, externalId: teamExternalIds.externalId })
        .from(teamExternalIds)
        .where(eq(teamExternalIds.source, source));
      return new Map(rows.map((r) => [r.externalId, r.teamId])) as TeamExternalMap;
    },

    async loadMatchMap(source) {
      const rows = await db
        .select({ matchId: matchExternalIds.matchId, externalId: matchExternalIds.externalId })
        .from(matchExternalIds)
        .where(eq(matchExternalIds.source, source));
      return new Map(rows.map((r) => [r.externalId, r.matchId])) as MatchExternalMap;
    },

    async loadMatchById(matchId) {
      const rows = await db
        .select({
          id: matches.id,
          status: matches.status,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
          homeScoreExtra: matches.homeScoreExtra,
          awayScoreExtra: matches.awayScoreExtra,
          penaltyWinnerTeamId: matches.penaltyWinnerTeamId,
          kickoffAt: matches.kickoffAt,
          minute: matches.minute,
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      const result: CurrentMatchRow = {
        id: row.id,
        status: row.status as DbMatchStatus,
        homeTeamId: row.homeTeamId ?? "",
        awayTeamId: row.awayTeamId ?? "",
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        homeScoreExtra: row.homeScoreExtra,
        awayScoreExtra: row.awayScoreExtra,
        penaltyWinnerTeamId: row.penaltyWinnerTeamId,
        kickoffAt: row.kickoffAt,
        minute: row.minute,
      };
      return result;
    },

    async insertMatch(row: MatchInsertRow, externalId, source) {
      // Transaccional para que la fila de matches y su mapping nazcan juntos.
      // Si falla el insert del mapping, hacemos rollback y el siguiente cron
      // tick reintenta limpio.
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(matches)
          .values({
            stage: row.stage,
            homeTeamId: row.homeTeamId,
            awayTeamId: row.awayTeamId,
            kickoffAt: row.kickoffAt,
            status: row.status,
            homeScore: row.homeScore,
            awayScore: row.awayScore,
            homeScoreExtra: row.homeScoreExtra,
            awayScoreExtra: row.awayScoreExtra,
            penaltyWinnerTeamId: row.penaltyWinnerTeamId,
            minute: row.minute,
          })
          .returning({ id: matches.id });
        const newMatch = inserted[0];
        if (!newMatch) throw new Error("insertMatch: no row returned");
        await tx.insert(matchExternalIds).values({
          matchId: newMatch.id,
          source,
          externalId,
        });
        return newMatch.id;
      });
    },

    async updateMatch(matchId: string, patch: MatchUpdatePatch) {
      // updatedAt se refresca en cada update — el schema lo deja con
      // `defaultNow()` solo en insert; el cron lo refresca explícitamente
      // para que los consumidores SSE detecten el cambio.
      await db
        .update(matches)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(matches.id, matchId));
    },

    async findUnscoredFinishedMatchIds() {
      // Matches `finished` con AL MENOS una predicción que NO tiene fila
      // en `point_events` para ese `(userId, matchId)`. Usamos `exists`
      // sobre un anti-join para que Postgres pueda parar al primer match
      // que cumpla — más barato que `GROUP BY` + `HAVING`.
      const rows = await db
        .select({ matchId: matches.id })
        .from(matches)
        .where(
          and(
            eq(matches.status, "finished"),
            sql`exists (
              select 1
              from ${predictions} p
              where p.match_id = ${matches.id}
                and not exists (
                  select 1 from ${pointEvents} pe
                  where pe.match_id = p.match_id
                    and pe.user_id = p.user_id
                )
            )`,
          ),
        );
      return rows.map((r) => r.matchId);
    },

    async upsertTeamFromProvider(team: ProviderTeamUpsert, source: string) {
      // Identidad del team: (source, externalId). Si ese par YA tiene
      // mapping, reusamos su teamId. Si NO, creamos un team COMPLETAMENTE
      // nuevo — nunca reusamos un team por nombre o code, eso fue el
      // bug histórico que contaminaba la BD al hacer matches cross-provider.
      const existingMapping = await db
        .select({ teamId: teamExternalIds.teamId })
        .from(teamExternalIds)
        .where(
          and(eq(teamExternalIds.source, source), eq(teamExternalIds.externalId, team.externalId)),
        )
        .limit(1);
      if (existingMapping[0]) {
        return existingMapping[0].teamId;
      }

      // Generar code garantizado único (varchar(8) → espacio sobrado).
      // El resolver hace fallback a `<PREFIX><EXT>` si la heurística
      // colisiona — nunca devuelve un code que YA exista.
      const code = await resolveUniqueCode(db, team, source);

      // INSERT plano (no upsert): si el code colisiona aquí es bug —
      // queremos verlo, no sobreescribir silenciosamente otro team.
      const inserted = await db
        .insert(teams)
        .values({ code, name: team.name, flag: team.flag })
        .returning({ id: teams.id });
      const teamId = inserted[0]?.id;
      if (!teamId) {
        throw new Error(`upsertTeamFromProvider: team insert returned no row (code=${code})`);
      }

      // Crear el mapping (source, externalId) → teamId.
      await db.insert(teamExternalIds).values({
        teamId,
        source,
        externalId: team.externalId,
      });

      return teamId;
    },
  };
}

/**
 * Genera un código de 3 letras único. Estrategia:
 *   1. Si el provider trae un code de 3 letras y no colisiona → ese.
 *   2. Si no, derivar del nombre (primeras letras de las palabras).
 *   3. Si colisiona, añadir un sufijo basado en el externalId.
 */
/**
 * Genera un code único de hasta 8 chars para un team nuevo. Estrategia:
 *
 *  1. Si el provider trae un `code` corto y NO colisiona → ese.
 *  2. Si no, derivar 3 chars del nombre. Si NO colisiona → ese.
 *  3. Si colisiona, garantizar uniqueness con un code derivado del
 *     `(source, externalId)`. Formato `<PREFIX><EXT>` (p.ej.
 *     `AF1531` para api-football team 1531). El PREFIX viene del
 *     source (`AF` para `api-football`). Si por alguna razón el
 *     code derivado siguiera colisionando (caso extremadamente
 *     improbable: mismo source+externalId ya tiene team), añadimos
 *     un sufijo numérico hasta encontrar uno libre.
 *
 * NUNCA reusa un team existente — esa decisión la toma el caller
 * antes de llamar a esta función (lookup por mapping). Si llegamos
 * aquí es porque queremos un team NUEVO.
 */
async function resolveUniqueCode(
  db: Database,
  team: ProviderTeamUpsert,
  source: string,
): Promise<string> {
  const provided = (team.code ?? "").toUpperCase();
  if (provided.length >= 2 && provided.length <= 8 && !(await codeExists(db, provided))) {
    return provided;
  }

  const derived = deriveCodeFromName(team.name);
  if (!(await codeExists(db, derived))) {
    return derived;
  }

  // Heurística colisiona → fallback garantizado único por externalId.
  // Prefix por source (mantiene el code legible).
  const prefix = source === "api-football" ? "AF" : source.slice(0, 2).toUpperCase();
  const extPart = team.externalId.replace(/[^0-9A-Za-z]/g, "").slice(0, 6);
  let candidate = `${prefix}${extPart}`.slice(0, 8);
  if (!(await codeExists(db, candidate))) return candidate;

  // Último recurso: añadir sufijo numérico (eslogan: si esto se
  // dispara, hay un bug — un team con el mismo source+externalId
  // ya debería haber sido capturado por el mapping lookup).
  for (let i = 1; i < 99; i++) {
    candidate = `${prefix}${extPart}${i}`.slice(0, 8);
    if (!(await codeExists(db, candidate))) return candidate;
  }
  throw new Error(
    `resolveUniqueCode: no free code after 99 tries for ${source}/${team.externalId}`,
  );
}

async function codeExists(db: Database, code: string): Promise<boolean> {
  const rows = await db.select({ id: teams.id }).from(teams).where(eq(teams.code, code)).limit(1);
  return rows.length > 0;
}

function deriveCodeFromName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-zA-Z]+/g, " ")
    .trim()
    .toUpperCase();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1].slice(0, 2)}`.padEnd(3, "X").slice(0, 3);
  }
  return cleaned.replace(/\s+/g, "").slice(0, 3).padEnd(3, "X");
}
