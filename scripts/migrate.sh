#!/bin/sh
# Aplica en orden las migraciones de db/migrations que aún no corrieron y
# luego recarga db/seed. Ambas cosas se pueden repetir sin efectos dobles:
# - cada migración corre una sola vez (queda anotada en schema_migrations);
# - los seeds son upserts, así que la configuración en git es la fuente de verdad.
# Corre dentro del servicio "migrate" de docker-compose (variables PG* ya puestas).
set -eu

PSQL="psql -v ON_ERROR_STOP=1 -q"

$PSQL -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

for file in /db/migrations/*.sql; do
  [ -e "$file" ] || continue
  version=$(basename "$file" .sql)
  applied=$($PSQL -tA -c "SELECT 1 FROM schema_migrations WHERE version = '$version';")
  if [ "$applied" = "1" ]; then
    echo "migración $version: ya aplicada"
    continue
  fi
  echo "migración $version: aplicando"
  # La migración y su registro van en la misma transacción.
  { cat "$file"; echo; echo "INSERT INTO schema_migrations (version) VALUES ('$version');"; } \
    | $PSQL --single-transaction
done

for file in /db/seed/*.sql; do
  [ -e "$file" ] || continue
  echo "seed $(basename "$file"): cargando"
  $PSQL --single-transaction -f "$file"
done

echo "base de datos al día"
