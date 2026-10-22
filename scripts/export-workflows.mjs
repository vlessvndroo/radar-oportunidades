// Exporta todos los workflows de n8n a workflows/<nombre>.json para versionarlos.
// Quita los datos fijados (pinData), que pueden contener respuestas reales de
// las fuentes, y las marcas de tiempo, que solo ensucian los diffs.
// Las credenciales no se exportan: los nodos solo guardan su id y nombre.
// Uso: npm run workflows:export
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONTAINER_DIR = '/tmp/radar-export';
const VOLATILE_KEYS = ['pinData', 'createdAt', 'updatedAt', 'shared', 'triggerCount', 'activeVersion', 'versionCounter'];

const compose = (...args) => execFileSync('docker', ['compose', ...args], { encoding: 'utf8' });

// n8n sale con error cuando no hay workflows; ese caso no es un fallo.
const output = compose('exec', '-T', 'n8n', 'sh', '-c',
  `rm -rf ${CONTAINER_DIR} && mkdir -p ${CONTAINER_DIR} && (n8n export:workflow --all --separate --output=${CONTAINER_DIR}/ 2>&1 || true)`);
if (/No workflows found/i.test(output)) {
  console.log('No hay workflows en n8n para exportar.');
  process.exit(0);
}
if (/Error exporting/i.test(output)) throw new Error(output);

const localDir = mkdtempSync(join(tmpdir(), 'radar-export-'));
try {
  compose('cp', `n8n:${CONTAINER_DIR}/.`, localDir);
  compose('exec', '-T', 'n8n', 'rm', '-rf', CONTAINER_DIR);

  const files = readdirSync(localDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No hay workflows para exportar.');
  }
  for (const file of files) {
    const workflow = JSON.parse(readFileSync(join(localDir, file), 'utf8'));
    for (const key of VOLATILE_KEYS) delete workflow[key];
    const name = workflow.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    writeFileSync(join('workflows', `${name}.json`), `${JSON.stringify(workflow, null, 2)}\n`);
    console.log(`workflows/${name}.json  (id ${workflow.id})`);
  }
} finally {
  rmSync(localDir, { recursive: true, force: true });
}
