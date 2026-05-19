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
      // 1) ¿Ya existe el mapping (externalId, source)? Reusar su teamId.
      const existingMapping = await db
        .select({ teamId: teamExternalIds.teamId })
        .from(teamExternalIds)
        .where(
          and(
            eq(teamExternalIds.source, source),
            eq(teamExternalIds.externalId, team.externalId),
          ),
        )
        .limit(1);
      if (existingMapping[0]) {
        return existingMapping[0].teamId;
      }

      // 2) Si no, generar un código único. Si el provider trae uno, lo
      //    intentamos primero; si colisiona o no es válido, derivamos
      //    del nombre con sufijo defensivo basado en el externalId.
      const code = await resolveUniqueCode(db, team);

      // 3) Insertar el team (upsert por code).
      await db
        .insert(teams)
        .values({ code, name: team.name, flag: team.flag })
        .onConflictDoUpdate({
          target: teams.code,
          set: { name: team.name, flag: team.flag },
        });
      const teamRow = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.code, code))
        .limit(1);
      const teamId = teamRow[0]?.id;
      if (!teamId) {
        throw new Error(`upsertTeamFromProvider: team row not found after insert (code=${code})`);
      }

      // 4) Crear la entry en team_external_ids.
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
async function resolveUniqueCode(db: Database, team: ProviderTeamUpsert): Promise<string> {
  const provided = (team.code ?? "").toUpperCase();
  if (provided.length === 3 && !(await codeExists(db, provided))) {
    return provided;
  }

  const derived = deriveCodeFromName(team.name);
  if (!(await codeExists(db, derived))) {
    return derived;
  }

  // Colisión: probar variantes con el último dígito del externalId.
  for (const suffix of team.externalId.split("").reverse()) {
    const variant = (derived.slice(0, 2) + suffix).toUpperCase();
    if (variant.length === 3 && !(await codeExists(db, variant))) {
      return variant;
    }
  }
  // Último recurso: hash trivial del externalId.
  return `X${team.externalId.slice(-2).padStart(2, "0").toUpperCase()}`.slice(0, 3);
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
