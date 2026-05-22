/**
 * Listado de backups GH Actions. Consultamos el endpoint público
 * `/repos/{owner}/{repo}/actions/artifacts` que devuelve todos los
 * artifacts subidos por workflows. Filtramos los del workflow
 * `db-backup*` y los presentamos al admin con tamaño + fecha + link
 * de descarga.
 *
 * Requiere `GITHUB_TOKEN` con scope `actions:read` en Railway env
 * vars. Sin token, devolvemos `kind: "missing-token"` para que la
 * UI muestre el fallback con instrucciones en vez de pinchar.
 */

const GH_OWNER = "hectoresen";
const GH_REPO = "wmundial";

export type BackupArtifact = {
  id: number;
  name: string;
  sizeInBytes: number;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  /** URL a la página de la run; descarga directa requiere autenticación. */
  workflowRunUrl: string;
  /** Endpoint API que sirve el .zip si el caller autentica con PAT. */
  archiveDownloadUrl: string;
};

export type BackupListResult =
  | { kind: "missing-token"; message: string }
  | { kind: "error"; message: string; status: number }
  | { kind: "ok"; artifacts: BackupArtifact[] };

type GhArtifact = {
  id: number;
  name: string;
  size_in_bytes: number;
  created_at: string;
  expires_at: string;
  expired: boolean;
  archive_download_url: string;
  workflow_run?: { id: number };
};

export async function listBackupArtifacts(): Promise<BackupListResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      kind: "missing-token",
      message:
        "Falta `GITHUB_TOKEN` en Railway (PAT con scope `actions:read`). Mientras tanto, abre GitHub Actions y descarga los artifacts manualmente.",
    };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/artifacts?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return {
        kind: "error",
        message: `GitHub API respondió ${res.status}. Revisa que el token siga activo y con scope actions:read.`,
        status: res.status,
      };
    }

    const data = (await res.json()) as { artifacts: GhArtifact[] };

    const artifacts = (data.artifacts ?? [])
      .filter((a) => a.name.toLowerCase().startsWith("db-backup"))
      .slice(0, 30)
      .map<BackupArtifact>((a) => ({
        id: a.id,
        name: a.name,
        sizeInBytes: a.size_in_bytes,
        createdAt: a.created_at,
        expiresAt: a.expires_at,
        expired: a.expired,
        workflowRunUrl: a.workflow_run?.id
          ? `https://github.com/${GH_OWNER}/${GH_REPO}/actions/runs/${a.workflow_run.id}`
          : `https://github.com/${GH_OWNER}/${GH_REPO}/actions`,
        archiveDownloadUrl: a.archive_download_url,
      }));

    return { kind: "ok", artifacts };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
      status: 0,
    };
  }
}
