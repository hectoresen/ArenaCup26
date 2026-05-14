import type { ProviderMatch } from "../types";

/**
 * Estados que el enum `match_status` admite en BD. Espejado a mano del
 * `pgEnum` para mantener este módulo independiente del cliente Drizzle
 * y testeable sin tocar la conexión.
 */
export type DbMatchStatus =
  | "scheduled-tbd"
  | "scheduled"
  | "prediction-locked"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

/**
 * Snapshot de la fila actual en `matches`. Solo los campos que el
 * pipeline lee/compara para reconciliar.
 */
export type CurrentMatchRow = {
  id: string;
  status: DbMatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreExtra: number | null;
  awayScoreExtra: number | null;
  penaltyWinnerTeamId: string | null;
  kickoffAt: Date;
};

/**
 * Patch a aplicar sobre una fila existente. Solo incluye columnas que
 * cambian (todas opcionales). El orquestador hace UPDATE solo si al
 * menos una key está presente.
 */
export type MatchUpdatePatch = {
  status?: DbMatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  homeScoreExtra?: number | null;
  awayScoreExtra?: number | null;
  penaltyWinnerTeamId?: string | null;
  kickoffAt?: Date;
};

/**
 * Fila completa a insertar para un match nuevo. Todas las columnas
 * obligatorias del schema deben estar resueltas.
 */
export type MatchInsertRow = {
  stage: ProviderMatch["stage"] & string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
  status: DbMatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreExtra: number | null;
  awayScoreExtra: number | null;
  penaltyWinnerTeamId: string | null;
};

export type ReconcileSkipReason = "team_not_mapped" | "stage_unresolved" | "self_match";

export type ReconcileResult =
  | {
      kind: "insert";
      row: MatchInsertRow;
      externalId: string;
    }
  | {
      kind: "update";
      matchId: string;
      patch: MatchUpdatePatch;
    }
  | {
      kind: "noop";
      matchId: string;
    }
  | {
      kind: "skip";
      externalId: string;
      reason: ReconcileSkipReason;
      detail?: string;
    };

/**
 * Map (externalId → uuid) para un único `source`. Lo construye
 * `loadTeamMap` leyendo `team_external_ids`.
 */
export type TeamExternalMap = ReadonlyMap<string, string>;

/**
 * Map (externalId → matchId) — usado por el orquestador para decidir
 * insert vs update vía un único lookup.
 */
export type MatchExternalMap = ReadonlyMap<string, string>;

export type SyncReport = {
  source: string;
  inserted: number;
  updated: number;
  noop: number;
  skipped: number;
  errors: Array<{ externalId: string; reason: string; detail?: string }>;
};

/**
 * Interfaz mínima que el orquestador necesita de la capa de
 * persistencia. Se mockea trivialmente en tests sin levantar Postgres.
 */
export type MatchRepo = {
  loadTeamMap: (source: string) => Promise<TeamExternalMap>;
  loadMatchMap: (source: string) => Promise<MatchExternalMap>;
  loadMatchById: (matchId: string) => Promise<CurrentMatchRow | null>;
  insertMatch: (row: MatchInsertRow, externalId: string, source: string) => Promise<string>;
  updateMatch: (matchId: string, patch: MatchUpdatePatch) => Promise<void>;
};
