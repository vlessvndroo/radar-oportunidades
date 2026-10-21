# 0003 — Base de datos, persistencia y migraciones

- **Estado:** aceptada
- **Fecha:** 2026-10-20
- **Fase:** 0

## Decisión

- **Un contenedor Postgres 17, dos bases:** `n8n` (datos internos de n8n) y `radar` (las tablas del proyecto). Se separan para poder respaldar o reiniciar una sin tocar la otra. La base `radar` la crea `db/init/01-create-radar-db.sh` la primera vez que arranca el volumen.
- **Postgres 17 y no 16:** n8n 2.44.4 avisa que Postgres 16 "está fuera del rango soportado" y que solo recibe soporte de compatibilidad.
- **Persistencia en volúmenes con nombre** (`radar_pgdata`, `radar_n8n_data`) en lugar de montar carpetas de Windows, que en Postgres dan problemas de permisos y rendimiento. Los datos sobreviven a `docker compose down`; solo `docker compose down -v` los borra.
- **Migraciones en SQL plano** (`db/migrations/NNN_nombre.sql`) aplicadas por el servicio `migrate` en cada `docker compose up`. Cada una corre una sola vez, dentro de una transacción, y queda anotada en `schema_migrations`. Las migraciones aplicadas no se editan: los cambios van en una migración nueva.
- **Seeds como upserts** (`db/seed/*.sql`) que se recargan en cada `up`. La configuración de fuentes y perfiles en git es la fuente de verdad: para ajustar pesos se edita el seed. Única excepción: `profiles.channel_target` no se pisa si ya se completó a mano.
- **Respaldo:** `npm run db:backup` hace `pg_dump` de las dos bases a `backups/` (excluido de git); `npm run db:restore -- <archivo>` las restaura.

## Alternativas descartadas

- **Una herramienta de migraciones** (node-pg-migrate, Flyway, etc.): agrega dependencias para algo que hoy son pocas migraciones lineales. Se puede adoptar más adelante sin reescribir el SQL.
- **Una sola base compartida con n8n:** mezclaría nuestras tablas con las más de 50 de n8n y complicaría los respaldos.

## Consecuencias

- `docker compose up` deja todo listo desde un repositorio limpio, sin pasos manuales en la base.
- `N8N_ENCRYPTION_KEY` (en `.env`) es crítica: sin ella no se pueden descifrar las credenciales guardadas en la base `n8n`.
- El puerto de Postgres en el host es configurable (`POSTGRES_PORT`), porque en la máquina de Alessandro el 5432 ya está ocupado por otro Postgres.
