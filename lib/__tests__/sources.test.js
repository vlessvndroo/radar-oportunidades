// Pruebas de los parsers contra respuestas reales guardadas (npm run fixtures)
// y contra entradas mínimas escritas a mano para los casos borde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRemotive, parseRemoteOk, parseWeWorkRemotely, normalizeAll } from '../index.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

function assertValidOpportunities(list, sourceId) {
  assert.ok(list.length > 0, 'debe haber al menos una oferta');
  for (const o of list) {
    assert.ok(o.title, 'título');
    assert.match(o.url, /^https:\/\//);
    assert.match(o.fingerprint, /^[0-9a-f]{32}$/);
    assert.deepEqual(o.source_ids, [sourceId]);
    assert.ok(o.published_at === null || !Number.isNaN(Date.parse(o.published_at)));
    assert.ok(!/<[a-z]+[\s>]/i.test(o.description ?? ''), 'la descripción no debe tener HTML');
  }
}

test('Remotive: la muestra real se normaliza completa', () => {
  const candidates = parseRemotive(fixture('remotive.json'));
  const list = normalizeAll(candidates, 'remotive');
  assertValidOpportunities(list, 'remotive');
  assert.equal(list.length, candidates.length);
});

test('Remotive: fecha sin zona horaria se toma como UTC y el salario se interpreta', () => {
  const body = { jobs: [{
    id: 1, url: 'https://remotive.com/remote-jobs/x-1', title: 'Dev', company_name: 'Acme',
    job_type: 'full_time', publication_date: '2026-10-17T16:04:29', candidate_required_location: 'LATAM',
    salary: '$50-$75 /hour', description: '<p>Hola</p>', tags: ['react'], category: 'Software Development',
  }] };
  const [o] = normalizeAll(parseRemotive(body), 'remotive');
  assert.equal(o.published_at, '2026-10-17T16:04:29.000Z');
  assert.deepEqual([o.salary_min, o.salary_max, o.period, o.currency], [50, 75, 'hour', 'USD']);
  assert.deepEqual(o.tags, ['react', 'software development']);
  assert.equal(o.raw.description, undefined);
});

test('Remotive: rechaza una respuesta sin lista de ofertas', () => {
  assert.throws(() => parseRemotive('{"error":"x"}'), /jobs/);
});

test('Remote OK: descarta el aviso legal y normaliza la muestra real', () => {
  const data = JSON.parse(fixture('remoteok.json'));
  const list = normalizeAll(parseRemoteOk(data), 'remoteok');
  assertValidOpportunities(list, 'remoteok');
  assert.equal(list.length, data.length - 1);
});

test('Remote OK: repara la codificación y trata salario 0 como desconocido', () => {
  const body = JSON.stringify([
    { legal: 'aviso' },
    { id: '1', position: 'Dev', company: 'Acme', location: 'Ciudad de MÃ©xico', url: 'https://remoteOK.com/remote-jobs/1',
      salary_min: 0, salary_max: 0, tags: ['dev'], description: '<p>x</p>', date: '2026-10-19T16:00:04+00:00' },
  ]);
  const [o] = normalizeAll(parseRemoteOk(body), 'remoteok');
  assert.equal(o.location, 'Ciudad de México');
  assert.equal(o.url, 'https://remoteok.com/remote-jobs/1');
  assert.equal(o.salary_min, null);
  assert.equal(o.contract_type, null);
});

test('We Work Remotely: separa empresa y puesto y normaliza la muestra real', () => {
  const list = normalizeAll(parseWeWorkRemotely(fixture('weworkremotely.xml')), 'weworkremotely');
  assertValidOpportunities(list, 'weworkremotely');
  for (const o of list) assert.ok(o.company, 'cada oferta de WWR trae empresa en el título');
});

test('We Work Remotely: arma la ubicación, el tipo y las habilidades', () => {
  const xml = `<rss><channel><item>
    <title>Acme &amp; Co: Automation Engineer</title>
    <region>Anywhere in the World</region>
    <country>🇻🇪 Venezuela (Bolivarian Republic of), and 🇨🇴 Colombia</country>
    <state></state>
    <skills>Python, API, and n8n</skills>
    <category>Back-End Programming</category>
    <type>Full-Time</type>
    <description>&lt;p&gt;Hola &amp;amp; chao&lt;/p&gt;</description>
    <pubDate>Tue, 20 Oct 2026 18:10:55 +0000</pubDate>
    <link>https://weworkremotely.com/remote-jobs/acme-automation-engineer</link>
  </item></channel></rss>`;
  const [o] = normalizeAll(parseWeWorkRemotely(xml), 'weworkremotely');
  assert.equal(o.company, 'Acme & Co');
  assert.equal(o.title, 'Automation Engineer');
  assert.equal(o.location, 'Anywhere in the World — Venezuela (Bolivarian Republic of), and Colombia');
  assert.equal(o.contract_type, 'full_time');
  assert.deepEqual(o.tags, ['python', 'api', 'n8n', 'back-end programming']);
  assert.equal(o.description, 'Hola & chao');
});

test('We Work Remotely: rechaza una respuesta que no es RSS', () => {
  assert.throws(() => parseWeWorkRemotely('<html>403</html>'), /RSS/);
});
