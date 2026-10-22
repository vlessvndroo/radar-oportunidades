// Parser de la API pública de Get on Board (GET /api/v0/search/jobs).
// Formato JSON:API: cada oferta trae "attributes" y relaciones en { data }.
// Con expand[] las relaciones vienen completas; sin él solo traen el id, así
// que modalidad y nivel tienen un mapa de respaldo (GET /modalities, /seniorities).
// Los salarios publicados son mensuales en USD.
import { htmlToText } from '../text.js';

const MODALITIES = { 1: 'full_time', 2: 'part_time', 3: 'freelance', 4: 'internship' };
const SENIORITIES = { 1: 'no_experience', 2: 'junior', 3: 'semi_senior', 4: 'senior', 5: 'expert' };

function related(relation) {
  return relation?.data ?? null;
}

function localeKey(relation, fallback) {
  const data = related(relation);
  if (!data) return null;
  return data.attributes?.locale_key ?? fallback[data.id] ?? null;
}

function companyName(attributes) {
  const data = related(attributes.company);
  if (data?.attributes?.name) return data.attributes.name;
  if (attributes.company?.name) return attributes.company.name;
  // Sin expand solo hay un slug ("fully-automated"): mejor que nada para deduplicar.
  return data?.id ? String(data.id).replace(/-/g, ' ') : null;
}

// Junta las secciones de la oferta que describen el puesto.
function fullDescription(a) {
  const sections = [
    [a.description_headline, a.description],
    [a.functions_headline, a.functions],
    [a.desirable_headline, a.desirable],
  ];
  return sections
    .filter(([, body]) => body)
    .map(([headline, body]) => `${headline ? `<h3>${headline}</h3>` : ''}${body}`)
    .join('');
}

export function parseGetOnBoard(body) {
  const data = typeof body === 'string' ? JSON.parse(body) : body;
  if (!Array.isArray(data?.data)) throw new Error('Respuesta de Get on Board sin lista "data"');

  return data.data.map((job) => {
    const a = job.attributes ?? {};
    const tagNames = (related(a.tags) ?? []).map((tag) => tag.attributes?.name).filter(Boolean);
    const seniority = localeKey(a.seniority, SENIORITIES);
    const modality = localeKey(a.modality, MODALITIES);

    return {
      title: a.title,
      company: companyName(a),
      url: job.links?.public_url ?? `https://www.getonbrd.com/jobs/${job.id}`,
      location: [...(a.countries ?? []), a.remote_zone].filter(Boolean).join(', '),
      remote: a.remote_modality ? a.remote_modality === 'fully_remote' : a.remote ?? null,
      contract_type: modality,
      salary_min: a.min_salary,
      salary_max: a.max_salary,
      currency: 'USD',
      period: 'month',
      description: htmlToText(fullDescription(a)),
      tags: [...tagNames, a.category_name].filter(Boolean),
      published_at: a.published_at ? a.published_at * 1000 : null,
      raw: {
        id: job.id,
        remote_modality: a.remote_modality ?? null,
        remote_zone: a.remote_zone ?? null,
        countries: a.countries ?? [],
        seniority,
        modality,
        category_name: a.category_name ?? null,
        lang: a.lang ?? null,
        applications_count: a.applications_count ?? null,
      },
    };
  });
}
