import type { MatchStage } from "@/server/scoring/types";

/**
 * Estado del partido tal y como lo reporta el provider externo.
 * Mapeado a partir del status nativo del provider para que el resto del
 * código no dependa de strings concretos de api-football, live-score-api,
 * etc.
 */
export type ProviderMatchStatus =
  /** Programado, aún no empezado. */
  | "scheduled"
  /** En juego (1ª parte, descanso, 2ª parte). */
  | "live"
  /** Prórroga en curso. */
  | "extra_time"
  /** Tanda de penaltis en curso. */
  | "penalty_shootout"
  /** Cerrado oficialmente. */
  | "finished"
  /** Pospuesto a nueva fecha. */
  | "postponed"
  /** Cancelado definitivamente. */
  | "cancelled"
  /** Abandonado / suspendido / decisión técnica. */
  | "abandoned"
  /** Suspendido temporalmente, en pausa. */
  | "interrupted"
  /** Status del provider que no sabemos mapear. */
  | "unknown";

export type ProviderTeam = {
  /** Identificador opaco del provider (e.g., 26 para Argentina en api-football). */
  externalId: string;
  /** Nombre del equipo según el provider. */
  name: string;
  /** Código FIFA si lo aporta el provider; null si no. */
  code: string | null;
  /** URL del logo / emoji bandera; null si no disponible. */
  logo: string | null;
};

/**
 * Snapshot de un partido devuelto por el provider, ya **normalizado** a
 * un shape estable independiente del proveedor concreto. El adapter
 * (`adapter.ts`) lo convierte luego a `MatchOutcome` para el scoring engine.
 */
export type ProviderMatch = {
  /** Identificador del fixture en el provider (e.g., 979139 para la final WC 2022 en api-football). */
  externalId: string;
  /** Nombre del provider (para tracing y debugging). */
  source: string;
  /** Identificador de la liga en el provider. */
  externalLeagueId: string | number;
  /** Temporada en el provider. */
  externalSeason: string | number;
  /** Etiqueta de ronda nativa del provider, sin parsear ("Final", "Group A - 1", etc.). */
  roundLabel: string | null;
  /** Stage del dominio (group, quarter, etc.) inferido de roundLabel. */
  stage: MatchStage | null;
  homeTeam: ProviderTeam;
  awayTeam: ProviderTeam;
  kickoffAt: Date;
  status: ProviderMatchStatus;
  /** Marcador al final del 90'. Null si el partido aún no ha terminado el tiempo regular. */
  scoreAt90: { home: number; away: number } | null;
  /** Marcador al final de la prórroga (cumulativo, incluye goles del 90'). Null si no fue a prórroga. */
  scoreAtExtra: { home: number; away: number } | null;
  /** Ganador por tanda de penaltis. Null si no hubo tanda. */
  penaltyWinner: "home" | "away" | null;
  /** Cuándo se obtuvo el snapshot. */
  fetchedAt: Date;
};

/**
 * Contrato que cualquier proveedor de match-data debe cumplir. Permite
 * intercambiar implementaciones (api-football, live-score-api, mock) sin
 * tocar el resto del sistema.
 */
export interface MatchDataProvider {
  /** Nombre legible del provider (para logs). */
  readonly name: string;
  /** Devuelve todos los fixtures de una liga + temporada. */
  getFixtures(opts: GetFixturesOptions): Promise<ProviderMatch[]>;
}

export type GetFixturesOptions = {
  leagueId: string | number;
  season: string | number;
};

/**
 * Errores tipados del provider. El caller puede inspeccionar `code` o
 * `httpStatus` para reaccionar (rate limit, plan limitado, etc.).
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly source: string,
    readonly code: ProviderErrorCode,
    readonly httpStatus?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type ProviderErrorCode =
  | "auth_failed"
  | "plan_limited"
  | "rate_limited"
  | "not_found"
  | "bad_request"
  | "network_error"
  | "parse_error"
  | "unknown";
