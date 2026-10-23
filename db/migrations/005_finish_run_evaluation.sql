-- 005: finish_run también marca "partial" si falló la evaluación.
-- stats esperado ahora:
--   {"sources": {...}, "new": n, "existing": n,
--    "evaluation": {"evaluated": n, "passed": n, "rejected": n} | {"error": "..."}}
CREATE OR REPLACE FUNCTION finish_run(run_id bigint, run_stats jsonb, run_error text DEFAULT NULL)
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
        WHEN run_stats -> 'evaluation' ->> 'error' IS NOT NULL THEN 'partial'
        ELSE 'success'
      END
  WHERE id = run_id
  RETURNING *;
$$;
