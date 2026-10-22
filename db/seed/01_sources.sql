-- Fuentes de la v1. Términos verificados en la fase 0: ver
-- docs/decisions/0002-fuentes-v1.md. Las tres exigen enlazar a la oferta
-- original y mencionar la fuente en el resumen.
-- connector_workflow_id es el id del workflow conector en n8n. Mientras sea
-- NULL aquí, el seed no pisa el valor que se haya puesto a mano.

INSERT INTO sources (id, name, type, url, enabled, opportunity_type, terms_url, notes) VALUES
  ('remotive', 'Remotive', 'api',
   'https://remotive.com/api/remote-jobs',
   true, 'job',
   'https://github.com/remotive-com/remote-jobs-api',
   'API pública: solo las 10 ofertas más recientes, con 24 h de retraso; máx. 4 consultas/día; no reenviar a terceros.'),
  ('remoteok', 'Remote OK', 'api',
   'https://remoteok.com/api',
   true, 'job',
   'https://remoteok.com/api',
   'El primer elemento del JSON es el aviso legal; enlace "follow" a la oferta y sin usar el logo.'),
  ('weworkremotely', 'We Work Remotely', 'rss',
   'https://weworkremotely.com/remote-jobs.rss',
   true, 'job',
   'https://weworkremotely.com/remote-job-rss-feed',
   'Feed general (una consulta por ejecución); uso libre con atribución.'),
  ('getonboard', 'Get on Board', 'api',
   'https://www.getonbrd.com/api/v0/search/jobs?remote=true&per_page=120&lang=en&expand%5B%5D=company&expand%5B%5D=tags&expand%5B%5D=seniority&expand%5B%5D=modality',
   true, 'job',
   'https://www.getonbrd.com/api-doc.html',
   'API pública abierta y sin autenticación; bolsa de Latinoamérica. Salarios mensuales en USD. Una página de 120 ofertas 100 % remotas por ejecución.')
ON CONFLICT (id) DO UPDATE SET
  name             = EXCLUDED.name,
  type             = EXCLUDED.type,
  url              = EXCLUDED.url,
  enabled          = EXCLUDED.enabled,
  opportunity_type = EXCLUDED.opportunity_type,
  terms_url        = EXCLUDED.terms_url,
  notes            = EXCLUDED.notes,
  connector_workflow_id = COALESCE(EXCLUDED.connector_workflow_id, sources.connector_workflow_id),
  updated_at       = now();

-- Ids de los workflows conectores en n8n (estables: se conservan al exportar
-- e importar los workflows con scripts/export-workflows y import-workflows).
UPDATE sources AS s
SET connector_workflow_id = c.workflow_id
FROM (VALUES
  ('remotive', 'QmJeaSLYsa36A7Gj'),
  ('remoteok', 'KuISAae0S7S12bfq'),
  ('weworkremotely', '1OEDQf29tlLnJmJc'),
  ('getonboard', 'zB0hs2T2FDtc84WG')
) AS c (source_id, workflow_id)
WHERE s.id = c.source_id;
