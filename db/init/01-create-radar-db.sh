#!/bin/sh
# Lo ejecuta la imagen oficial de Postgres solo cuando el volumen está vacío.
# La base de n8n ya la crea POSTGRES_DB; aquí se crea la del radar.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE DATABASE "$RADAR_DB_NAME" OWNER "$POSTGRES_USER";
SQL
