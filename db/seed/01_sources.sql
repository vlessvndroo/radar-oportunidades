-- Fuentes de la v1. Términos verificados en la fase 0: ver
-- docs/decisions/0002-fuentes-v1.md. Las tres exigen enlazar a la oferta
-- original y mencionar la fuente en el resumen.

INSERT INTO sources (id, name, type, url, enabled, opportunity_type, terms_url, notes) VALUES
  ('remotive', 'Remotive', 'api',
   'https://remotive.com/api/remote-jobs',
   true, 'job',
   'https://github.com/remotive-com/remote-jobs-api',
   'Máx. 4 consultas/día; ofertas con 24 h de retraso; no reenviar a sitios de terceros.'),
  ('remoteok', 'Remote OK', 'api',
   'https://remoteok.com/api',
   true, 'job',
   'https://remoteok.com/api',
   'El primer elemento del JSON es el aviso legal; enlace "follow" a la oferta y sin usar el logo.'),
  ('weworkremotely', 'We Work Remotely', 'rss',
   'https://weworkremotely.com/remote-jobs.rss',
   true, 'job',
   'https://weworkremotely.com/remote-job-rss-feed',
   'Feed general (una consulta por ejecución); uso libre con atribución.')
ON CONFLICT (id) DO UPDATE SET
  name             = EXCLUDED.name,
  type             = EXCLUDED.type,
  url              = EXCLUDED.url,
  enabled          = EXCLUDED.enabled,
  opportunity_type = EXCLUDED.opportunity_type,
  terms_url        = EXCLUDED.terms_url,
  notes            = EXCLUDED.notes,
  updated_at       = now();
