// Puntuación de encaje por reglas (0–100) con su justificación.
// La configuración viene de profiles.scoring_rules. Cada regla suma su peso
// una sola vez si se cumple cualquiera de sus condiciones ("match"):
//   keywords:       [{ fields: ['title', 'tags'], any: ['n8n', ...], except: ['semi senior'] }]
//                   (except: frases que se ignoran antes de buscar)
//   raw:            { seniority: ['junior', 'semi_senior'] }  (dato estructurado de la fuente)
//   min_years:      5        (la descripción exige 5 años o más)
//   min_hourly_usd: 12       (el pago publicado llega a 12 USD/h)
//   max_age_days:   3        (publicada hace 3 días o menos)
import { fieldText, findKeyword, hourlyUsd, requiredYears, withoutPhrases } from './matching.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Devuelve el motivo del acierto (por ejemplo "n8n" o "senior") o null.
function ruleHit(opportunity, match = {}, now) {
  for (const group of match.keywords ?? []) {
    const found = findKeyword(withoutPhrases(fieldText(opportunity, group.fields), group.except), group.any);
    if (found) return found;
  }
  for (const [key, values] of Object.entries(match.raw ?? {})) {
    const value = opportunity.raw?.[key];
    if (value != null && values.includes(value)) return String(value).replace(/_/g, ' ');
  }
  if (match.min_years != null) {
    const years = requiredYears(opportunity.description);
    if (years != null && years >= match.min_years) return `${years}+ años`;
  }
  if (match.min_hourly_usd != null) {
    const hourly = hourlyUsd(opportunity);
    if (hourly != null && hourly >= match.min_hourly_usd) return `${hourly} USD/h`;
  }
  if (match.max_age_days != null && opportunity.published_at) {
    const age = (now - new Date(opportunity.published_at).getTime()) / DAY_MS;
    if (age >= 0 && age <= match.max_age_days) return `hace ${Math.floor(age)} d`;
  }
  return null;
}

function formatWeight(weight) {
  return weight >= 0 ? `+${weight}` : `−${Math.abs(weight)}`;
}

export function scoreOpportunity(opportunity, scoring = {}, { now = Date.now() } = {}) {
  const hits = [];
  for (const rule of scoring.rules ?? []) {
    const reason = ruleHit(opportunity, rule.match, now);
    if (reason) hits.push({ rule, reason });
  }

  const [min, max] = scoring.clamp ?? [0, 100];
  const total = hits.reduce((sum, { rule }) => sum + rule.weight, 0);
  const score = Math.min(max, Math.max(min, total));

  const rationale = hits
    .sort((a, b) => b.rule.weight - a.rule.weight)
    .map(({ rule, reason }) => `${formatWeight(rule.weight)} ${rule.label} (${reason})`)
    .join(', ');

  const matchedIds = new Set(hits.map(({ rule }) => rule.id));
  const track = (scoring.cv_tracks ?? []).find((t) => matchedIds.has(t.rule));

  return {
    score,
    rationale: rationale || 'sin señales',
    cv_track: track?.id ?? null,
    matched_rules: [...matchedIds],
  };
}
