import type { Database } from "@/server/db/client";
import { matchExternalIds, matches, teamExternalIds } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type {
  CurrentMatchRow,
  DbMatchStatus,
  MatchExternalMap,
  MatchInsertRow,
  MatchRepo,
  MatchUpdatePatch,
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
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
          homeScoreExtra: matches.homeScoreExtra,
          awayScoreExtra: matches.awayScoreExtra,
          penaltyWinnerTeamId: matches.penaltyWinnerTeamId,
          kickoffAt: matches.kickoffAt,
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      const result: CurrentMatchRow = {
        id: row.id,
        status: row.status as DbMatchStatus,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        homeScoreExtra: row.homeScoreExtra,
        awayScoreExtra: row.awayScoreExtra,
        penaltyWinnerTeamId: row.penaltyWinnerTeamId,
        kickoffAt: row.kickoffAt,
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
  };
}
