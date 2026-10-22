// Descarga una respuesta real de cada fuente habilitada (una consulta por
// fuente) y deja:
//   .cache/sources/<id>.<ext>             respuesta completa (excluida de git)
//   lib/__tests__/fixtures/<id>.<ext>     muestra recortada para las pruebas
// Las fuentes se leen de la tabla sources (no se escriben en el código).
// Uso: npm run fixtures            (usa la caché si ya existe)
//      npm run fixtures -- --fresh (fuerza una descarga nueva)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SAMPLE_SIZE = 6;
const MAX_DESCRIPTION = 1500;
const fresh = process.argv.includes('--fresh');

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
const userAgent = env.SOURCE_USER_AGENT;
if (!userAgent) throw new Error('Falta SOURCE_USER_AGENT en .env');

const rows = execFileSync(
  'docker',
  ['compose', 'exec', '-T', 'postgres', 'sh', '-c',
    'psql -U "$POSTGRES_USER" -d "$RADAR_DB_NAME" -tA -F "|" -c "SELECT id, type, url FROM sources WHERE enabled ORDER BY id"'],
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean).map((line) => {
  const [id, type, url] = line.split('|');
  return { id, type, url };
});

mkdirSync('.cache/sources', { recursive: true });
mkdirSync('lib/__tests__/fixtures', { recursive: true });

for (const source of rows) {
  const ext = source.type === 'rss' ? 'xml' : 'json';
  const cachePath = join('.cache/sources', `${source.id}.${ext}`);

  let body;
  if (!fresh && existsSync(cachePath)) {
    body = readFileSync(cachePath, 'utf8');
    console.log(`${source.id}: usando caché (${cachePath})`);
  } else {
    const res = await fetch(source.url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) {
      console.error(`${source.id}: HTTP ${res.status}, se omite`);
      continue;
    }
    body = await res.text();
    writeFileSync(cachePath, body);
    console.log(`${source.id}: descargado (${body.length} bytes)`);
  }

  const sample = ext === 'json' ? sampleJson(body) : sampleRss(body);
  writeFileSync(join('lib/__tests__/fixtures', `${source.id}.${ext}`), sample);
}

// Recorta descripciones largas para que las muestras sean livianas.
function trimDescription(text) {
  return typeof text === 'string' && text.length > MAX_DESCRIPTION
    ? `${text.slice(0, MAX_DESCRIPTION)}…`
    : text;
}

// Recorta todos los textos largos, a cualquier profundidad (Get on Board
// anida la descripción en "attributes" y la empresa expandida).
function trimDeep(value) {
  if (typeof value === 'string') return trimDescription(value);
  if (Array.isArray(value)) return value.map(trimDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trimDeep(v)]));
  }
  return value;
}

// Conserva la forma original: un arreglo (con el aviso legal de Remote OK al
// inicio) o un objeto con la lista en "jobs" (Remotive) o "data" (Get on Board).
function sampleJson(body) {
  const data = JSON.parse(body);
  if (Array.isArray(data)) {
    const [head, ...rest] = data;
    const items = 'legal' in head ? rest : data;
    const sample = items.slice(0, SAMPLE_SIZE).map(trimDeep);
    return `${JSON.stringify('legal' in head ? [head, ...sample] : sample, null, 2)}\n`;
  }
  const key = Object.keys(data).find((k) => Array.isArray(data[k]));
  const sample = data[key].slice(0, SAMPLE_SIZE).map(trimDeep);
  return `${JSON.stringify({ ...data, [key]: sample }, null, 2)}\n`;
}

function sampleRss(body) {
  const items = body.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const head = body.slice(0, body.indexOf('<item>'));
  const trimmed = items.slice(0, SAMPLE_SIZE).map((item) =>
    item.replace(/<description>([\s\S]*?)<\/description>/, (_, d) => `<description>${trimDescription(d)}</description>`),
  );
  return `${head}${trimmed.join('\n')}\n</channel>\n</rss>\n`;
}
