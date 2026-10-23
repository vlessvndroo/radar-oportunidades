// Evalúa las ofertas guardadas con lib/evaluate.js fuera de n8n, para ajustar
// filtros y pesos rápido. Por defecto no escribe nada en la base.
//   npm run evaluate               resumen de la evaluación de todas las ofertas
//   npm run evaluate -- --review   además escribe .cache/review/revision.csv (separado por ";" para Excel en español)
//   npm run evaluate -- --save     además guarda el resultado en matches
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { evaluateAll } from '../lib/index.js';

const args = new Set(process.argv.slice(2));

function psql(sql) {
  return execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$RADAR_DB_NAME" -tA -v ON_ERROR_STOP=1`],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

const rows = JSON.parse(psql("SELECT coalesce(json_agg(t), '[]') FROM pending_evaluations(true) t;"));
const results = evaluateAll(rows);
const byId = new Map(rows.map(({ opportunity }) => [opportunity.id, opportunity]));

const passed = results.filter((r) => r.passed_filters).sort((a, b) => b.score - a.score);
const rejected = results.filter((r) => !r.passed_filters);

const tally = (list, key) => {
  const counts = {};
  for (const item of list) for (const value of [key(item)].flat()) counts[value] = (counts[value] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

console.log(`\nEvaluadas: ${results.length} · pasan: ${passed.length} · descartadas: ${rejected.length}\n`);
console.log('Motivos de descarte:');
for (const [reason, n] of tally(rejected, (r) => r.reject_reason.replace(/\(.*\)|\d+(\.\d+)?/g, '…'))) {
  console.log(`  ${String(n).padStart(4)}  ${reason}`);
}
console.log('\nAvisos en las que pasan:');
for (const [flag, n] of tally(passed, (r) => (r.flags.length ? r.flags : ['(ninguno)']))) {
  console.log(`  ${String(n).padStart(4)}  ${flag}`);
}
console.log('\nPuntajes de las que pasan:');
for (const [from, to] of [[80, 100], [60, 79], [40, 59], [20, 39], [0, 19]]) {
  const n = passed.filter((r) => r.score >= from && r.score <= to).length;
  console.log(`  ${String(from).padStart(3)}–${String(to).padEnd(3)} ${'█'.repeat(n)} ${n}`);
}
console.log('\nLas 15 mejores:');
for (const r of passed.slice(0, 15)) {
  const o = byId.get(r.opportunity_id);
  console.log(`  ${String(r.score).padStart(3)}  ${o.title} — ${o.company ?? '?'} [${o.source_ids.join(',')}]`);
  console.log(`       ${r.rationale}${r.flags.length ? ` · ${r.flags.join(', ')}` : ''}`);
}

if (args.has('--review')) {
  // Muestra para revisión manual: las 15 mejores, 7 del medio y 3 descartadas.
  const middle = passed.slice(15).filter((_, i, list) => i % Math.max(1, Math.floor(list.length / 7)) === 0).slice(0, 7);
  const sample = [
    ...passed.slice(0, 15).map((r) => ['top', r]),
    ...middle.map((r) => ['medio', r]),
    ...rejected.filter((_, i) => i % Math.max(1, Math.floor(rejected.length / 3)) === 0).slice(0, 3).map((r) => ['descartada', r]),
  ];
  const csv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [['n', 'grupo', 'puntaje', 'titulo', 'empresa', 'fuente', 'ubicacion', 'motivo', 'avisos', 'url', 'te_interesa (si/no/quizas)', 'comentario']];
  sample.forEach(([group, r], i) => {
    const o = byId.get(r.opportunity_id);
    lines.push([i + 1, group, r.score ?? '', o.title, o.company, o.source_ids.join(','), o.location,
      r.rationale ?? r.reject_reason, r.flags.join('; '), o.url, '', '']);
  });
  mkdirSync('.cache/review', { recursive: true });
  writeFileSync('.cache/review/revision.csv', `﻿${lines.map((l) => l.map(csv).join(';')).join('\r\n')}\r\n`);
  console.log(`\nRevisión: .cache/review/revision.csv (${sample.length} ofertas)`);
}

if (args.has('--save')) {
  const saved = psql(`SELECT * FROM save_matches($json$${JSON.stringify(results)}$json$::jsonb);`);
  console.log(`\nGuardado en matches (evaluadas|pasan|descartadas): ${saved}`);
}
