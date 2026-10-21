import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, normalizeCompany, normalizeTitle, canonicalUrl } from '../fingerprint.js';

test('la misma oferta en dos fuentes da el mismo fingerprint aunque cambie la URL', () => {
  const remotive = { company: 'Lemon.io', title: 'Senior React Full-stack Developer', url: 'https://remotive.com/remote-jobs/x-1' };
  const remoteok = { company: 'Lemon.io', title: 'Senior React Full stack Developer', url: 'https://remoteok.com/remote-jobs/y-2' };
  assert.equal(fingerprint(remotive), fingerprint(remoteok));
});

test('ignora sufijos legales, acentos, notas entre paréntesis y la palabra remote', () => {
  const a = { company: 'Acme, Inc.', title: 'Automation Engineer (Remote, LATAM)', url: 'https://a.com/1' };
  const b = { company: 'ACME', title: 'Automation Engineer - Remote', url: 'https://b.com/2' };
  assert.equal(fingerprint(a), fingerprint(b));
  assert.equal(normalizeCompany('Compañía Ágil S.A.'), 'compania agil');
  assert.equal(normalizeTitle('Ingeniero de Automatización [Remoto]'), 'ingeniero de automatizacion');
});

test('puestos distintos de la misma empresa dan fingerprints distintos', () => {
  const backend = { company: 'Acme', title: 'Backend Developer', url: 'https://a.com/1' };
  const frontend = { company: 'Acme', title: 'Frontend Developer', url: 'https://a.com/1' };
  assert.notEqual(fingerprint(backend), fingerprint(frontend));
});

test('sin empresa usa la URL canónica', () => {
  const a = { company: null, title: 'Developer', url: 'https://Example.com/jobs/1/?utm_source=x#top' };
  const b = { company: '', title: 'Developer', url: 'https://example.com/jobs/1' };
  const c = { company: null, title: 'Developer', url: 'https://example.com/jobs/2' };
  assert.equal(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a), fingerprint(c));
});

test('canonicalUrl quita query, fragmento y barra final', () => {
  assert.equal(canonicalUrl('https://RemoteOK.com/remote-jobs/abc/?ref=1#x'), 'https://remoteok.com/remote-jobs/abc');
  assert.equal(canonicalUrl('no es una url'), 'no es una url');
});

test('el fingerprint es un hex de 32 caracteres', () => {
  assert.match(fingerprint({ company: 'Acme', title: 'Dev', url: 'https://a.com' }), /^[0-9a-f]{32}$/);
});
