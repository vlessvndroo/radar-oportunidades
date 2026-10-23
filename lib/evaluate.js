// Evaluación de una oferta contra un perfil: filtros duros y, si pasa,
// puntuación. Devuelve una fila lista para la tabla matches.
import { applyHardFilters } from './filters.js';
import { scoreOpportunity } from './score.js';

export function evaluateOpportunity(opportunity, profile, { now = Date.now() } = {}) {
  const base = { opportunity_id: opportunity.id, profile_id: profile.id };
  const filters = applyHardFilters(opportunity, profile.hard_filters);

  if (!filters.passed) {
    return { ...base, passed_filters: false, reject_reason: filters.reject_reason, score: null, rationale: null, flags: [], cv_track: null };
  }

  const scored = scoreOpportunity(opportunity, profile.scoring_rules, { now });
  return {
    ...base,
    passed_filters: true,
    reject_reason: null,
    score: scored.score,
    rationale: scored.rationale,
    flags: filters.flags,
    cv_track: scored.cv_track,
  };
}

// rows: [{ profile, opportunity }], como los devuelve pending_evaluations().
export function evaluateAll(rows, options) {
  return rows.map(({ profile, opportunity }) => evaluateOpportunity(opportunity, profile, options));
}
