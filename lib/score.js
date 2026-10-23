// Puntuación de encaje por reglas (0–100) con su justificación.
// La configuración viene de profiles.scoring_rules. Cada regla suma su peso
// una sola vez si se cumple cualquiera de sus condiciones ("match"):
//   keywords:       [{ fields: ['title', 'tags'], any: ['n8n', ...], except: ['semi senior'] }]
//                   (except: frases que se ignoran antes de buscar; un elemento de "any"
//                   puede ser una lista de sinónimos: ["node.js", "nodejs", "node"])
// Con "per_match": true la regla suma su peso por cada palabra distinta encontrada,
// hasta "max" (por ejemplo +8 por tecnología, hasta +24; con peso negativo, "max"
// es el mínimo).
// Con "requires_any": ["dev_role", ...] la regla solo cuenta si alguna de esas
// reglas se cumplió (por ejemplo, "junior" no suma en un puesto de ventas).
//   raw:            { seniority: ['junior', 'semi_senior'] }  (dato estructurado de la fuente)
//   min_years:      5        (la descripción exige 5 años o más)
//   min_hourly_usd: 12       (el pago publicado llega a 12 USD/h)
//   max_age_days:   3        (publicada hace 3 días o menos)
import { fieldText, findKeyword, hourlyUsd, requiredYears, withoutPhrases } from './matching.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Palabras distintas encontradas (un grupo de sinónimos cuenta una vez).
function keywordHits(opportunity, groups = []) {
  const hits = [];
  for (const group of groups) {
    const text = withoutPhrases(fieldText(opportunity, group.fields), group.except);
    for (const entry of group.any ?? []) {
      const found = findKeyword(text, [entry].flat());
      if (found && !hits.includes(found)) hits.push(found);
    }
  }
  return hits;
}

// Devuelve el motivo del acierto (por ejemplo "n8n" o "senior") o null.
function ruleHit(opportunity, match = {}, now) {
  const keywords = keywordHits(opportunity, match.keywords);
  if (keywords.length) return keywords[0];
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
  const candidates = [];
  for (const rule of scoring.rules ?? []) {
    if (rule.per_match) {
      const found = keywordHits(opportunity, rule.match?.keywords);
      const raw = rule.weight * found.length;
      const points = rule.max == null ? raw : rule.weight >= 0 ? Math.min(raw, rule.max) : Math.max(raw, rule.max);
      if (found.length) candidates.push({ rule, points, reason: found.join(', ') });
      continue;
    }
    const reason = ruleHit(opportunity, rule.match, now);
    if (reason) candidates.push({ rule, points: rule.weight, reason });
  }

  const independent = new Set(candidates.filter(({ rule }) => !rule.requires_any).map(({ rule }) => rule.id));
  const hits = candidates.filter(({ rule }) => !rule.requires_any || rule.requires_any.some((id) => independent.has(id)));

  const [min, max] = scoring.clamp ?? [0, 100];
  const total = hits.reduce((sum, { points }) => sum + points, 0);
  const score = Math.min(max, Math.max(min, total));

  const rationale = hits
    .sort((a, b) => b.points - a.points)
    .map(({ rule, points, reason }) => `${formatWeight(points)} ${rule.label} (${reason})`)
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
