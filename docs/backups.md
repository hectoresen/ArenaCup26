# Backups de la base de datos

Cómo se hacen, dónde se guardan, cómo se restauran.

## TL;DR

- **Cadencia normal**: `db-backup.yml` cada noche a 03:00 UTC.
- **Cadencia Mundial**: `db-backup-tournament.yml` cada 6h durante
  11 jun → 19 jul 2026 (date-guarded en el propio workflow).
- **Storage**: GitHub Actions Artifacts (no Backblaze ni S3). Plan
  Free de GitHub cubre todo. Retención **90 días**.
- **Restore**: `gh run download` + `zcat | psql`. Procedimiento en
  detalle abajo.
- **Único secret requerido**: `DATABASE_URL` en GitHub Secrets — el
  `DATABASE_PUBLIC_URL` del service Postgres de Railway, NO el
  internal.

## Por qué GitHub Artifacts y no Backblaze/S3

El workflow original usaba Backblaze B2 (S3-compatible). Requería 5
secrets adicionales (`BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`,
`BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`, `BACKUP_S3_REGION`)
y una cuenta externa. Descubrimos el 2026-05-21 que ninguno de esos
secrets se había configurado nunca — **el workflow llevaba 5 noches
fallando silenciosamente** y no había backups remotos. Sin posibilidad
de restore si la BD se corrompía.

Migración a Artifacts:
- ✅ Cero infra externa nueva.
- ✅ Cero cuentas extra.
- ✅ 0 € (cabe en plan GitHub Free: 500 MB artifacts + 90 días).
- ✅ Un solo secret a configurar: `DATABASE_URL`.
- ⚠ Retención fija a 90 días (no extensible en Free).

Para nuestra cadencia (1 dump/día + 4 dumps/día durante Mundial,
~50-500 KB cada uno), 90 días son más que suficientes — y siempre
puedes descargar/archivar dumps antiguos antes de que expiren si
quieres histórico más largo.

## Configuración en GitHub

Secret único:

```bash
# Desde local con Railway CLI + gh autenticado:
PG_URL=$(railway variables --service Postgres --kv | grep DATABASE_PUBLIC_URL= | cut -d= -f2-)
echo "$PG_URL" | gh secret set DATABASE_URL
```

⚠ Importante: usar el **PUBLIC** URL (`*.proxy.rlwy.net` o similar),
no el internal (`postgres.railway.internal`). GitHub Actions corre
fuera de Railway y el internal no resuelve.

## Cadencias

| Workflow                        | Cron              | Cuándo aplica                                  |
|---------------------------------|-------------------|------------------------------------------------|
| `db-backup.yml`                 | `0 3 * * *`       | Siempre — backup diario                        |
| `db-backup-tournament.yml`      | `0 */6 * * *`     | Solo entre 2026-06-11 y 2026-07-19 (date guard) |

Durante el Mundial coexisten ambos: el diario sigue, el tournament
añade 4 dumps adicionales cada 24h. Eso te da granularidad de 6h
durante los 38 días del torneo (~152 dumps extra).

## Cómo restaurar

### Desde el último backup nocturno

```bash
# 1. Listar runs recientes del workflow
gh run list --workflow=db-backup.yml --limit 5

# 2. Identificar el run-id que quieres restaurar (success más reciente)
RUN_ID=<numero>

# 3. Descargar el artifact
gh run download "$RUN_ID" --name wmundial-backup --dir ./restore

# 4. Verificar integridad
gzip -t ./restore/wmundial-*.sql.gz && echo OK

# 5. Restaurar (CUIDADO: sobreescribe la BD destino)
PG_URL=$(railway variables --service Postgres --kv | grep DATABASE_PUBLIC_URL= | cut -d= -f2-)
zcat ./restore/wmundial-*.sql.gz | psql "$PG_URL"
```

### Desde un backup tournament

Mismo procedimiento, cambiando el workflow:

```bash
gh run list --workflow=db-backup-tournament.yml --limit 5
gh run download <run-id> --name wmundial-tournament-backup --dir ./restore
zcat ./restore/wmundial-*.sql.gz | psql "$PG_URL"
```

### Antes de restaurar en producción

⚠ El dump usa `pg_dump --no-owner --no-acl`. Eso significa que NO
borra los datos existentes — los nuevos INSERT pueden fallar por
constraints UNIQUE o duplicate keys.

**Procedimiento seguro**:

1. Hacer un dump del estado actual antes (por si necesitas volver atrás):
   ```bash
   pg_dump "$PG_URL" --no-owner --no-acl | gzip > /tmp/pre-restore-$(date +%s).sql.gz
   ```
2. Hacer un dry-run leyendo los `\restrict` y comprobar que el dump
   se ve sano:
   ```bash
   zcat ./restore/wmundial-*.sql.gz | head -100
   ```
3. Para reemplazar contenido completo (no merge), usar `--clean
   --if-exists` en pg_dump del backup o ejecutar `TRUNCATE` explícito
   en orden inverso de FKs antes del restore.

Para el caso "rollback de un reset que hicimos mal", el dump trae
todo desde cero y debería poder aplicarse sobre BD vacía. Si la BD
todavía tiene datos parciales, hacer primero un TRUNCATE de las
tablas afectadas.

## Verificación

Tras cada run scheduled:

```bash
gh run view <run-id> --log | grep -E "Dump size|Gzip integrity|verified"
```

Salida sana:
```
Dump size: 428K
✓ Gzip integrity OK
✓ Backup verified
```

Si ves `pg_dump: error: aborting because of server version mismatch`:
- Railway subió la versión de Postgres. Actualizar el workflow para
  instalar `postgresql-client-NN` (NN = nueva mayor). Hoy es v18.

Si ves `❌ DATABASE_URL secret missing`:
- El secret se borró o no se ha configurado. Re-aplicar con el comando
  del paso "Configuración en GitHub".

## Cleanup post-Mundial

Tras el final del torneo (19 jul 2026), el date guard del workflow
`db-backup-tournament.yml` lo deja inactivo automáticamente — no
hay que tocar nada. Los artifacts ya generados expiran solos a los
90 días.

Si quieres conservar algunos dumps del Mundial fuera de los 90 días
(histórico para análisis), descárgalos y guárdalos en cualquier
storage que prefieras (Google Drive, externo USB, lo que sea) antes
de que GitHub los borre.
