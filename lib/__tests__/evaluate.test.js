import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHardFilters, scoreOpportunity, evaluateOpportunity, evaluateAll,
  detectLanguage, findKeyword, hourlyUsd, requiredYears,
} from '../index.js';

const NOW = Date.parse('2026-10-22T12:00:00Z');

const HARD_FILTERS = {
  remote_only: true,
  location: {
    accept_regions: ['latam', 'latin america', 'americas', 'venezuela'],
    accept_region_hints: ['latam'],
    accept_global: ['anywhere in the world', 'anywhere', 'worldwide'],
    generic_remote: ['remote', 'remoto'],
    deny: ['us only', 'north america only'],
    unknown: 'pass_flagged',
  },
  contract_types: { allow: ['full_time', 'part_time', 'contract'] },
  min_hourly_usd: 10,
  unknown_salary: 'pass_flagged',
  languages: ['es', 'en'],
};

const SCORING = {
  clamp: [0, 100],
  cv_tracks: [
    { id: 'automation', rule: 'automation' },
    { id: 'fullstack', rule: 'fullstack' },
  ],
  rules: [
    { id: 'automation', label: 'automatización', weight: 30, match: { keywords: [{ fields: ['title'], any: ['automation', 'n8n'] }] } },
    { id: 'fullstack', label: 'rol full-stack', weight: 30, match: { keywords: [{ fields: ['title'], any: ['full stack'] }] } },
    { id: 'stack', label: 'stack', weight: 20, match: { keywords: [{ fields: ['title', 'tags', 'description'], any: ['node.js', 'python'] }] } },
    { id: 'junior', label: 'junior', weight: 15, match: { keywords: [{ fields: ['title'], any: ['junior', 'jr'] }], raw: { seniority: ['junior', 'semi_senior'] } } },
    { id: 'pay', label: 'pago', weight: 10, match: { min_hourly_usd: 12 } },
    { id: 'recent', label: 'reciente', weight: 10, match: { max_age_days: 3 } },
    { id: 'senior', label: 'senior', weight: -25, match: { keywords: [{ fields: ['title'], any: ['senior'] }], raw: { seniority: ['senior'] }, min_years: 5 } },
  ],
};

const PROFILE = { id: 1, hard_filters: HARD_FILTERS, scoring_rules: SCORING };

const ENGLISH = 'We are looking for a developer to join our team. You will work with the product team and have experience with APIs and our customers.';
const offer = (overrides = {}) => ({
  id: 10,
  title: 'Automation Developer',
  company: 'Acme',
  location: 'LATAM',
  remote: true,
  contract_type: 'full_time',
  salary_min: null,
  salary_max: null,
  currency: null,
  period: null,
  description: ENGLISH,
  tags: [],
  published_at: '2026-10-21T12:00:00Z',
  raw: {},
  region_hints: [],
  ...overrides,
});

// --- utilidades -----------------------------------------------------------

test('findKeyword busca palabras completas y frases', () => {
  assert.equal(findKeyword('senior node js developer', ['node.js']), 'node.js');
  assert.equal(findKeyword('nodes and jrnal', ['node', 'jr']), null);
  assert.equal(findKeyword('lead generation specialist', ['tech lead']), null);
});

test('hourlyUsd convierte a USD por hora y descarta otras monedas', () => {
  assert.equal(hourlyUsd({ salary_max: 1600, period: 'month', currency: 'USD' }), 10);
  assert.equal(hourlyUsd({ salary_max: 41600, period: 'year', currency: 'USD' }), 20);
  assert.equal(hourlyUsd({ salary_min: 15, period: 'hour', currency: 'USD' }), 15);
  assert.equal(hourlyUsd({ salary_max: 3000, period: 'month', currency: 'EUR' }), null);
  assert.equal(hourlyUsd({ salary_max: null, period: null }), null);
});

test('requiredYears lee años de experiencia exigidos y no fechas de la empresa', () => {
  assert.equal(requiredYears('You have 5+ years of experience with Node.js'), 5);
  assert.equal(requiredYears('Experiencia mínima de 3 años en integraciones; deseable 7 años de experiencia'), 7);
  assert.equal(requiredYears('Founded 12 years ago, we value experience'), null);
  assert.equal(requiredYears('Work 40 hours a week'), null);
});

test('detectLanguage distingue inglés, español y portugués', () => {
  assert.equal(detectLanguage(ENGLISH), 'en');
  assert.equal(detectLanguage('Buscamos un desarrollador para el equipo de producto, con experiencia en integraciones y conocimientos de APIs para trabajar con los clientes de la empresa.'), 'es');
  assert.equal(detectLanguage('Buscamos uma pessoa para a nossa equipe com experiência em integrações. Você vai trabalhar com o time de produto e com os clientes da empresa em projetos.'), 'pt');
  assert.equal(detectLanguage('Short text'), 'unknown');
});

// --- filtros duros ----------------------------------------------------------

// Con salario, para que el aviso "pago desconocido" no se mezcle en las pruebas de ubicación.
const PAID = { salary_max: 2000, period: "month", currency: "USD" };

test('ubicación: acepta regiones LATAM, globales y pistas de la fuente', () => {
  assert.equal(applyHardFilters(offer({ location: 'Remote - Americas' }), HARD_FILTERS).passed, true);
  assert.equal(applyHardFilters(offer({ location: 'Worldwide' }), HARD_FILTERS).passed, true);
  const hinted = applyHardFilters(offer({ ...PAID, location: 'Remote', region_hints: ['latam'] }), HARD_FILTERS);
  assert.deepEqual([hinted.passed, hinted.flags], [true, []]);
});

test('ubicación: global con un lugar pegado pasa marcada como ambigua', () => {
  const r = applyHardFilters(offer({ ...PAID, location: 'Anywhere in the World — United States of America' }), HARD_FILTERS);
  assert.deepEqual([r.passed, r.flags], [true, ['ubicación ambigua']]);
});

test('ubicación: vacía o solo "remote" pasa marcada como no indicada', () => {
  for (const location of [null, '', 'Remote', 'Remoto']) {
    const r = applyHardFilters(offer({ ...PAID, location }), HARD_FILTERS);
    assert.deepEqual([r.passed, r.flags], [true, ['ubicación no indicada']], String(location));
  }
});

test('ubicación: descarta restricciones, ciudades y listas de países sin Venezuela', () => {
  assert.match(applyHardFilters(offer({ location: 'North America Only' }), HARD_FILTERS).reject_reason, /restringida/);
  assert.match(applyHardFilters(offer({ location: 'Boston' }), HARD_FILTERS).reject_reason, /fuera de LATAM/);
  assert.match(applyHardFilters(offer({ location: 'Remote - US' }), HARD_FILTERS).reject_reason, /fuera de LATAM/);
  assert.match(applyHardFilters(offer({ location: 'Europe, USA, Mexico' }), HARD_FILTERS).reject_reason, /fuera de LATAM/);
  assert.match(applyHardFilters(offer({ remote: false }), HARD_FILTERS).reject_reason, /remota/);
});

test('contrato: descarta freelance y deja pasar el desconocido', () => {
  assert.equal(applyHardFilters(offer({ contract_type: 'freelance' }), HARD_FILTERS).reject_reason, 'contrato freelance');
  assert.equal(applyHardFilters(offer({ contract_type: null }), HARD_FILTERS).passed, true);
});

test('pago: descarta bajo el mínimo y marca el desconocido', () => {
  const low = applyHardFilters(offer({ salary_max: 700, period: 'month', currency: 'USD' }), HARD_FILTERS);
  assert.match(low.reject_reason, /pago 4\.38 USD\/h/);
  const ok = applyHardFilters(offer({ salary_max: 2000, period: 'month', currency: 'USD' }), HARD_FILTERS);
  assert.deepEqual([ok.passed, ok.flags], [true, []]);
  assert.deepEqual(applyHardFilters(offer(), HARD_FILTERS).flags, ['pago desconocido']);
});

test('pago: con low_pay = "flag" el pago bajo no descarta y muestra el monto', () => {
  const filters = { ...HARD_FILTERS, min_hourly_usd: 8, low_pay: 'flag' };
  const low = applyHardFilters(offer({ salary_max: 700, period: 'month', currency: 'USD' }), filters);
  assert.deepEqual([low.passed, low.flags], [true, ['pago bajo (4.38 USD/h ≈ 701 USD/mes)']]);
  const ok = applyHardFilters(offer({ salary_max: 1400, period: 'month', currency: 'USD' }), filters);
  assert.deepEqual([ok.passed, ok.flags], [true, []]);
});

test('idioma: usa el idioma declarado por la fuente y descarta los no permitidos', () => {
  assert.equal(applyHardFilters(offer({ raw: { lang: 'pt' } }), HARD_FILTERS).reject_reason, 'idioma pt');
  assert.equal(applyHardFilters(offer({ raw: { lang: 'es' }, description: ENGLISH }), HARD_FILTERS).passed, true);
});

// --- puntuación ----------------------------------------------------------------

test('suma las reglas que se cumplen y explica cada una', () => {
  const r = scoreOpportunity(offer({ title: 'Junior Automation Developer', tags: ['Node.js'], salary_max: 15, period: 'hour', currency: 'USD' }), SCORING, { now: NOW });
  assert.equal(r.score, 30 + 20 + 15 + 10 + 10);
  assert.equal(r.rationale, '+30 automatización (automation), +20 stack (node.js), +15 junior (junior), +10 pago (15 USD/h), +10 reciente (hace 1 d)');
  assert.equal(r.cv_track, 'automation');
});

test('resta por senior, usa el nivel estructurado y recorta entre 0 y 100', () => {
  const senior = scoreOpportunity(offer({ title: 'Data Analyst', published_at: null, description: 'You need 6+ years of experience.' }), SCORING, { now: NOW });
  assert.deepEqual([senior.score, senior.rationale], [0, '−25 senior (6+ años)']);

  const structured = scoreOpportunity(offer({ title: 'Full Stack Developer', raw: { seniority: 'semi_senior' }, published_at: null }), SCORING, { now: NOW });
  assert.equal(structured.score, 45);
  assert.equal(structured.cv_track, 'fullstack');

  const max = scoreOpportunity(offer({ title: 'Junior Full Stack Automation n8n', tags: ['python'], salary_max: 20, period: 'hour', currency: 'USD' }), SCORING, { now: NOW });
  assert.equal(max.score, 100);
});

test('except: "Semi Senior" no cuenta como senior', () => {
  const rules = { rules: [{ id: 'senior', label: 'senior', weight: -25, match: { keywords: [{ fields: ['title'], any: ['senior'], except: ['semi senior'] }] } }] };
  assert.equal(scoreOpportunity(offer({ title: 'Desarrollador Semi Senior', published_at: null }), rules, { now: NOW }).rationale, 'sin señales');
  assert.equal(scoreOpportunity(offer({ title: 'Senior Developer', published_at: null }), rules, { now: NOW }).rationale, '−25 senior (senior)');
});

test('hourlyUsd ignora montos imposibles', () => {
  assert.equal(hourlyUsd({ salary_max: 3, period: 'month', currency: 'USD' }), null);
  assert.equal(hourlyUsd({ salary_max: 5000, period: 'hour', currency: 'USD' }), null);
});

test('sin señales: puntaje 0 y sin CV sugerido', () => {
  const r = scoreOpportunity(offer({ title: 'Sales Manager', published_at: null }), SCORING, { now: NOW });
  assert.deepEqual([r.score, r.rationale, r.cv_track], [0, 'sin señales', null]);
});

// --- evaluación completa ------------------------------------------------------

test('evaluateOpportunity devuelve una fila de matches para aprobadas y descartadas', () => {
  const passed = evaluateOpportunity(offer(), PROFILE, { now: NOW });
  assert.deepEqual(Object.keys(passed).sort(), [
    'cv_track', 'flags', 'opportunity_id', 'passed_filters', 'profile_id', 'rationale', 'reject_reason', 'score',
  ]);
  assert.deepEqual([passed.opportunity_id, passed.profile_id, passed.passed_filters, passed.score], [10, 1, true, 40]);

  const rejected = evaluateOpportunity(offer({ contract_type: 'freelance' }), PROFILE, { now: NOW });
  assert.deepEqual([rejected.passed_filters, rejected.reject_reason, rejected.score, rejected.flags], [false, 'contrato freelance', null, []]);
});

test('evaluateAll procesa pares perfil × oferta', () => {
  const rows = [{ profile: PROFILE, opportunity: offer({ id: 1 }) }, { profile: PROFILE, opportunity: offer({ id: 2, location: 'Boston' }) }];
  assert.deepEqual(evaluateAll(rows, { now: NOW }).map((r) => r.passed_filters), [true, false]);
});
