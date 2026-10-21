// Lleva una oferta ya extraída por un parser de fuente al esquema de la
// tabla opportunities (sin id ni first_seen_at, que pone la base).
import { canonicalUrl, fingerprint } from './fingerprint.js';
import { cleanLine } from './text.js';

const CONTRACT_TYPES = {
  full_time: 'full_time', 'full-time': 'full_time', 'full time': 'full_time', fulltime: 'full_time',
  part_time: 'part_time', 'part-time': 'part_time', 'part time': 'part_time',
  contract: 'contract', contractor: 'contract',
  freelance: 'freelance',
  internship: 'internship', intern: 'internship',
};

export function normalizeContractType(value) {
  if (!value) return null;
  return CONTRACT_TYPES[String(value).trim().toLowerCase()] ?? 'other';
}

function normalizeTags(tags) {
  const seen = new Set();
  for (const tag of tags ?? []) {
    const clean = cleanLine(tag)?.toLowerCase();
    if (clean) seen.add(clean);
  }
  return [...seen];
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function normalizeOpportunity(candidate, sourceId) {
  if (!sourceId) throw new Error('normalizeOpportunity necesita el id de la fuente');

  const title = cleanLine(candidate.title);
  const url = candidate.url ? canonicalUrl(candidate.url) : null;
  if (!title || !url) return null;

  const company = cleanLine(candidate.company);
  let salaryMin = toAmount(candidate.salary_min);
  let salaryMax = toAmount(candidate.salary_max);
  if (salaryMin && !salaryMax) salaryMax = salaryMin;
  if (salaryMax && !salaryMin) salaryMin = salaryMax;
  if (salaryMin > salaryMax) [salaryMin, salaryMax] = [salaryMax, salaryMin];
  const hasSalary = salaryMin != null;

  return {
    fingerprint: fingerprint({ company, title, url }),
    title,
    company,
    url,
    location: cleanLine(candidate.location),
    remote: candidate.remote ?? null,
    contract_type: normalizeContractType(candidate.contract_type),
    salary_min: salaryMin,
    salary_max: salaryMax,
    currency: hasSalary ? candidate.currency ?? null : null,
    period: hasSalary ? candidate.period ?? null : null,
    description: candidate.description || null,
    tags: normalizeTags(candidate.tags),
    published_at: toIsoDate(candidate.published_at),
    source_ids: [sourceId],
    raw: candidate.raw ?? null,
  };
}

// Normaliza una lista y descarta inválidas y repetidas dentro de la misma fuente.
export function normalizeAll(candidates, sourceId) {
  const byFingerprint = new Map();
  for (const candidate of candidates) {
    const opportunity = normalizeOpportunity(candidate, sourceId);
    if (opportunity && !byFingerprint.has(opportunity.fingerprint)) {
      byFingerprint.set(opportunity.fingerprint, opportunity);
    }
  }
  return [...byFingerprint.values()];
}
