-- 002: funciones que usa el workflow main-daily para que sus nodos Postgres
-- queden en una sola línea y la lógica de idempotencia viva en la base.

-- Inserta ofertas normalizadas (arreglo JSON con el esquema de lib/normalize).
-- - Repetidas dentro del lote (misma oferta en dos fuentes) se combinan.
-- - Si el fingerprint ya existe, solo se suman las fuentes nuevas a source_ids.
-- Devuelve una fila por oferta del lote, con is_new = true si se insertó ahora.
CREATE FUNCTION upsert_opportunities(items jsonb)
RETURNS TABLE (id bigint, fingerprint text, is_new boolean)
LANGUAGE sql
AS $$
  WITH input AS (
    SELECT *
    FROM jsonb_to_recordset(items) AS x (
      fingerprint text, title text, company text, url text, location text, remote boolean,
      contract_type text, salary_min numeric, salary_max numeric, currency text, period text,
      description text, tags text[], published_at timestamptz, source_ids text[], raw jsonb
    )
  ),
  sources_by_fingerprint AS (
    SELECT i.fingerprint, array_agg(DISTINCT s ORDER BY s) AS source_ids
    FROM input i, unnest(i.source_ids) AS s
    GROUP BY i.fingerprint
  ),
  merged AS (
    SELECT DISTINCT ON (i.fingerprint) i.*, s.source_ids AS all_sources
    FROM input i
    JOIN sources_by_fingerprint s USING (fingerprint)
    ORDER BY i.fingerprint, i.published_at ASC NULLS LAST
  )
  INSERT INTO opportunities AS o (
    fingerprint, title, company, url, location, remote, contract_type, salary_min, salary_max,
    currency, period, description, tags, published_at, source_ids, raw
  )
  SELECT fingerprint, title, company, url, location, remote, contract_type, salary_min, salary_max,
         currency, period, description, coalesce(tags, '{}'), published_at, all_sources, raw
  FROM merged
  ON CONFLICT (fingerprint) DO UPDATE
    SET source_ids = ARRAY(SELECT DISTINCT s FROM unnest(o.source_ids || EXCLUDED.source_ids) AS s ORDER BY s)
  RETURNING o.id, o.fingerprint, (xmax = 0) AS is_new;
$$;

-- Abre una ejecución en la bitácora y devuelve su id.
CREATE FUNCTION start_run()
RETURNS bigint
LANGUAGE sql
AS $$
  INSERT INTO runs DEFAULT VALUES RETURNING id;
$$;

-- Cierra una ejecución. stats esperado:
--   {"sources": {"<id>": {"fetched": n, "normalized": n, "error": null | "..."}},
--    "new": n, "existing": n}
-- Estado: failed si hay error general; partial si falló alguna fuente; si no, success.
CREATE FUNCTION finish_run(run_id bigint, run_stats jsonb, run_error text DEFAULT NULL)
RETURNS runs
LANGUAGE sql
AS $$
  UPDATE runs
  SET finished_at = now(),
      stats = coalesce(run_stats, '{}'),
      error = run_error,
      status = CASE
        WHEN run_error IS NOT NULL THEN 'failed'
        WHEN EXISTS (
          SELECT 1 FROM jsonb_each(coalesce(run_stats -> 'sources', '{}')) AS s
          WHERE s.value ->> 'error' IS NOT NULL
        ) THEN 'partial'
        ELSE 'success'
      END
  WHERE id = run_id
  RETURNING *;
$$;
