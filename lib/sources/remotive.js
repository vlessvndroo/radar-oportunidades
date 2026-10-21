// Parser de la API pública de Remotive (GET /api/remote-jobs).
// Recibe el cuerpo como texto o ya parseado; devuelve candidatos para normalizeAll.
import { parseSalaryText } from '../salary.js';
import { htmlToText } from '../text.js';

export function parseRemotive(body) {
  const data = typeof body === 'string' ? JSON.parse(body) : body;
  if (!Array.isArray(data?.jobs)) throw new Error('Respuesta de Remotive sin lista "jobs"');

  return data.jobs.map((job) => {
    const salary = parseSalaryText(job.salary);
    // publication_date viene sin zona horaria; Remotive publica en UTC.
    const published = job.publication_date && !/[zZ]|[+-]\d\d:?\d\d$/.test(job.publication_date)
      ? `${job.publication_date}Z`
      : job.publication_date;
    const { description, ...raw } = job;

    return {
      title: job.title,
      company: job.company_name,
      url: job.url,
      location: job.candidate_required_location,
      remote: true,
      contract_type: job.job_type,
      salary_min: salary?.min,
      salary_max: salary?.max,
      currency: salary?.currency,
      period: salary?.period,
      description: htmlToText(description),
      tags: [...(job.tags ?? []), job.category].filter(Boolean),
      published_at: published,
      raw,
    };
  });
}
