-- 004: soporte para la evaluación (fase 2).

-- Avisos que no descartan ("pago desconocido", "ubicación ambigua") y qué CV
-- conviene enviar según la regla que coincidió.
ALTER TABLE matches
  ADD COLUMN flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN cv_track text;

-- Pista de región de una fuente: en Get on Board (bolsa de Latinoamérica)
-- "Remote" significa abierto a LATAM; en otras fuentes no se sabe.
ALTER TABLE sources ADD COLUMN region_hint text;

-- Pares perfil × oferta por evaluar, como JSON listo para lib/evaluate.js.
-- Sin argumentos: solo ofertas que ese perfil aún no evaluó.
-- Con reevaluate = true: todas (para ajustar pesos y recalcular).
CREATE FUNCTION pending_evaluations(reevaluate boolean DEFAULT false)
RETURNS TABLE (profile jsonb, opportunity jsonb)
LANGUAGE sql
STABLE
AS $$
  SELECT
    jsonb_build_object(
      'id', p.id, 'name', p.name,
      'hard_filters', p.hard_filters, 'scoring_rules', p.scoring_rules
    ) AS profile,
    to_jsonb(o) - 'raw' || jsonb_build_object(
      'raw', o.raw,
      'region_hints', coalesce((
        SELECT jsonb_agg(DISTINCT s.region_hint)
        FROM sources s
        WHERE s.id = ANY (o.source_ids) AND s.region_hint IS NOT NULL
      ), '[]'::jsonb)
    ) AS opportunity
  FROM profiles p
  CROSS JOIN opportunities o
  WHERE p.enabled
    AND (reevaluate OR NOT EXISTS (
      SELECT 1 FROM matches m WHERE m.profile_id = p.id AND m.opportunity_id = o.id
    ))
  ORDER BY p.id, o.id;
$$;

-- Guarda resultados de lib/evaluate.js. Si el par ya existía (reevaluación),
-- actualiza la evaluación pero conserva status y notified_at.
CREATE FUNCTION save_matches(items jsonb)
RETURNS TABLE (evaluated int, passed int, rejected int)
LANGUAGE sql
AS $$
  WITH input AS (
    SELECT *
    FROM jsonb_to_recordset(items) AS x (
      opportunity_id bigint, profile_id integer, passed_filters boolean, reject_reason text,
      score smallint, rationale text, flags text[], cv_track text
    )
  ),
  saved AS (
    INSERT INTO matches AS m (
      opportunity_id, profile_id, passed_filters, reject_reason, score, rationale, flags, cv_track, evaluated_at
    )
    SELECT opportunity_id, profile_id, passed_filters, reject_reason, score, rationale,
           coalesce(flags, '{}'), cv_track, now()
    FROM input
    ON CONFLICT (opportunity_id, profile_id) DO UPDATE SET
      passed_filters = EXCLUDED.passed_filters,
      reject_reason  = EXCLUDED.reject_reason,
      score          = EXCLUDED.score,
      rationale      = EXCLUDED.rationale,
      flags          = EXCLUDED.flags,
      cv_track       = EXCLUDED.cv_track,
      evaluated_at   = now()
    RETURNING m.passed_filters
  )
  SELECT count(*)::int,
         count(*) FILTER (WHERE passed_filters)::int,
         count(*) FILTER (WHERE NOT passed_filters)::int
  FROM saved;
$$;
