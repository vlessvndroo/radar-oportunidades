// Importa los workflows de workflows/*.json a n8n conservando sus ids (los
// conectores se llaman por id desde sources.connector_workflow_id) y publica
// los sub-workflows, que en n8n 2.x deben estar publicados para poder llamarse.
// Después de importar hay que elegir la credencial "Radar DB" en los nodos
// Postgres si n8n no la encuentra (las credenciales no se versionan).
// Uso: npm run workflows:import
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTAINER_DIR = '/tmp/radar-import';
const compose = (...args) => execFileSync('docker', ['compose', ...args], { encoding: 'utf8' });

const files = readdirSync('workflows').filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.log('No hay workflows en workflows/.');
  process.exit(0);
}

compose('exec', '-T', 'n8n', 'sh', '-c', `rm -rf ${CONTAINER_DIR} && mkdir -p ${CONTAINER_DIR}`);
for (const file of files) compose('cp', join('workflows', file), `n8n:${CONTAINER_DIR}/${file}`);
compose('exec', '-T', 'n8n', 'n8n', 'import:workflow', '--separate', `--input=${CONTAINER_DIR}`);
compose('exec', '-T', '-u', 'root', 'n8n', 'rm', '-rf', CONTAINER_DIR);
console.log(`importados: ${files.join(', ')}`);

const subWorkflows = files
  .map((file) => JSON.parse(readFileSync(join('workflows', file), 'utf8')))
  .filter((wf) => wf.nodes.some((node) => node.type === 'n8n-nodes-base.executeWorkflowTrigger'));
for (const wf of subWorkflows) {
  compose('exec', '-T', 'n8n', 'n8n', 'publish:workflow', `--id=${wf.id}`);
  console.log(`publicado: ${wf.name}`);
}

compose('restart', 'n8n');
console.log('n8n reiniciado para aplicar las publicaciones.');
