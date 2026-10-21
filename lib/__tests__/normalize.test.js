import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpportunity, normalizeAll, normalizeContractType } from '../normalize.js';

const base = {
  title: '  Automation   Engineer ',
  company: 'Acme',
  url: 'https://example.com/jobs/1?utm=x',
  location: 'Worldwide',
  remote: true,
  contract_type: 'Full-Time',
  description: 'Texto',
  tags: ['N8N', 'n8n', ' Python ', ''],
  published_at: 'Tue, 20 Oct 2026 18:10:55 +0000',
  raw: { id: 1 },
};

test('produce el esquema de opportunities con valores limpios', () => {
  const o = normalizeOpportunity(base, 'weworkremotely');
  assert.equal(o.title, 'Automation Engineer');
  assert.equal(o.url, 'https://example.com/jobs/1');
  assert.equal(o.contract_type, 'full_time');
  assert.deepEqual(o.tags, ['n8n', 'python']);
  assert.equal(o.published_at, '2026-10-20T18:10:55.000Z');
  assert.deepEqual(o.source_ids, ['weworkremotely']);
  assert.match(o.fingerprint, /^[0-9a-f]{32}$/);
  assert.deepEqual(Object.keys(o).sort(), [
    'company', 'contract_type', 'currency', 'description', 'fingerprint', 'location', 'period',
    'published_at', 'raw', 'remote', 'salary_max', 'salary_min', 'source_ids', 'tags', 'title', 'url',
  ]);
});

test('salario: 0 es desconocido, completa el extremo faltante y ordena', () => {
  const none = normalizeOpportunity({ ...base, salary_min: 0, salary_max: 0, currency: 'USD', period: 'year' }, 's');
  assert.equal(none.salary_min, null);
  assert.equal(none.currency, null);
  assert.equal(none.period, null);

  const single = normalizeOpportunity({ ...base, salary_min: 50000, currency: 'USD', period: 'year' }, 's');
  assert.deepEqual([single.salary_min, single.salary_max], [50000, 50000]);

  const swapped = normalizeOpportunity({ ...base, salary_min: 90, salary_max: 60, currency: 'USD', period: 'hour' }, 's');
  assert.deepEqual([swapped.salary_min, swapped.salary_max, swapped.period], [60, 90, 'hour']);
});

test('descarta candidatos sin título o sin URL', () => {
  assert.equal(normalizeOpportunity({ ...base, title: '  ' }, 's'), null);
  assert.equal(normalizeOpportunity({ ...base, url: '' }, 's'), null);
});

test('exige el id de la fuente', () => {
  assert.throws(() => normalizeOpportunity(base), /id de la fuente/);
});

test('normalizeContractType mapea variantes y marca lo desconocido como other', () => {
  assert.equal(normalizeContractType('part-time'), 'part_time');
  assert.equal(normalizeContractType('Contract'), 'contract');
  assert.equal(normalizeContractType('freelance'), 'freelance');
  assert.equal(normalizeContractType('Temporary'), 'other');
  assert.equal(normalizeContractType(null), null);
});

test('normalizeAll quita inválidas y repetidas dentro de una fuente', () => {
  const list = normalizeAll([base, { ...base, url: 'https://example.com/otra' }, { ...base, title: '' }], 's');
  assert.equal(list.length, 1);
});
