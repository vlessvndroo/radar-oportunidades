// Restaura un respaldo creado con scripts/backup.mjs sobre su base de origen
// (el nombre del archivo empieza con el nombre de la base: radar-..., n8n-...).
// Reemplaza los datos actuales de esa base.
// Uso: npm run db:restore -- backups/radar-20261020-120000.dump
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Indica el archivo: npm run db:restore -- backups/<archivo>.dump');
  process.exit(1);
}

const name = basename(file);
const match = name.match(/^([a-z0-9_]+)-\d{8}-\d{6}\.dump$/);
if (!match) {
  console.error(`"${name}" no tiene el formato <base>-AAAAMMDD-HHMMSS.dump de scripts/backup.mjs.`);
  process.exit(1);
}
const db = match[1];

const script = `if [ "${db}" = "$POSTGRES_DB" ]; then echo "Restaurando la base de n8n: detén n8n antes (docker compose stop n8n)."; fi
pg_restore -U "$POSTGRES_USER" -d "${db}" --clean --if-exists --no-owner "/backups/${name}"`;
execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c', script], { stdio: 'inherit' });
console.log(`restaurado: ${name}`);
