// Parser de la API pública de Remote OK (GET /api).
// El primer elemento del arreglo es el aviso legal y se descarta.
// Los salarios publicados son anuales en USD; 0 significa "no publicado".
import { fixMojibake, htmlToText } from '../text.js';

export function parseRemoteOk(body) {
  const data = typeof body === 'string' ? JSON.parse(body) : body;
  if (!Array.isArray(data)) throw new Error('Respuesta de Remote OK no es un arreglo');

  return data
    .filter((job) => job && job.id && !('legal' in job))
    .map((job) => {
      const { description, ...raw } = job;
      return {
        title: fixMojibake(job.position),
        company: fixMojibake(job.company),
        url: job.url,
        location: fixMojibake(job.location),
        remote: true,
        contract_type: null,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        currency: 'USD',
        period: 'year',
        description: htmlToText(fixMojibake(description)),
        tags: (job.tags ?? []).map(fixMojibake),
        published_at: job.date ?? (job.epoch ? job.epoch * 1000 : null),
        raw,
      };
    });
}
