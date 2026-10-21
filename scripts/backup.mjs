// Respaldo de las dos bases (radar y n8n) con pg_dump en formato custom.
// Los archivos quedan en backups/ (montado en el contenedor, excluido de git).
// Uso: npm run db:backup
import { execFileSync } from 'node:child_process';

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

for (const dbVar of ['RADAR_DB_NAME', 'POSTGRES_DB']) {
  const script = `pg_dump -U "$POSTGRES_USER" -d "$${dbVar}" -Fc -f "/backups/$${dbVar}-${stamp}.dump" && echo "/backups/$${dbVar}-${stamp}.dump"`;
  const out = execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c', script], {
    encoding: 'utf8',
  });
  console.log(`respaldo creado: .${out.trim()}`);
}
