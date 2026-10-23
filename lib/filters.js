// Filtros duros: deciden si una oferta se descarta para un perfil.
// La configuración viene de profiles.hard_filters (ver db/seed/02_profiles.sql).
// Devuelve { passed, reject_reason, flags }: flags son avisos que no
// descartan ("pago desconocido", "ubicación ambigua").
import { detectLanguage } from './language.js';
import { findKeyword, hourlyUsd } from './matching.js';
import { simplify } from './text.js';

function removeKeywords(text, keywords) {
  let rest = ` ${text} `;
  for (const keyword of keywords ?? []) {
    const key = simplify(keyword);
    if (key) rest = rest.split(` ${key} `).join(' ');
  }
  return rest.trim();
}

function checkLocation(opportunity, cfg = {}, remoteOnly) {
  if (remoteOnly && opportunity.remote === false) return { reject: 'no es 100 % remota' };

  const text = simplify(opportunity.location);
  const denied = findKeyword(text, cfg.deny);
  if (denied) return { reject: `ubicación restringida (${denied})` };

  if (findKeyword(text, cfg.accept_regions)) return {};

  const hints = opportunity.region_hints ?? [];
  if (hints.some((hint) => (cfg.accept_region_hints ?? []).includes(hint))) return {};

  const genericWords = [...(cfg.accept_global ?? []), ...(cfg.generic_remote ?? [])];
  if (findKeyword(text, cfg.accept_global)) {
    // "Anywhere in the World — United States": global, pero con un lugar pegado.
    return removeKeywords(text, genericWords) ? { flag: 'ubicación ambigua' } : {};
  }

  if (!removeKeywords(text, cfg.generic_remote)) {
    return cfg.unknown === 'reject' ? { reject: 'ubicación no indicada' } : { flag: 'ubicación no indicada' };
  }

  return { reject: `ubicación fuera de LATAM (${opportunity.location})` };
}

function checkContract(opportunity, cfg = {}) {
  const type = opportunity.contract_type;
  if (!type || !cfg.allow) return {};
  return cfg.allow.includes(type) ? {} : { reject: `contrato ${type}` };
}

function checkPay(opportunity, filters) {
  const min = filters.min_hourly_usd;
  if (!min) return {};
  const hourly = hourlyUsd(opportunity);
  if (hourly == null) {
    return filters.unknown_salary === 'reject' ? { reject: 'pago desconocido' } : { flag: 'pago desconocido' };
  }
  return hourly < min ? { reject: `pago ${hourly} USD/h, menor a ${min}` } : {};
}

export function opportunityLanguage(opportunity) {
  const declared = opportunity.raw?.lang;
  if (['en', 'es', 'pt', 'de', 'fr'].includes(declared)) return declared;
  return detectLanguage(`${opportunity.title ?? ''} ${opportunity.description ?? ''}`);
}

function checkLanguage(opportunity, languages) {
  if (!languages?.length) return {};
  const lang = opportunityLanguage(opportunity);
  if (lang === 'unknown' || languages.includes(lang)) return {};
  return { reject: `idioma ${lang}` };
}

export function applyHardFilters(opportunity, filters = {}) {
  const checks = [
    checkLocation(opportunity, filters.location, filters.remote_only),
    checkContract(opportunity, filters.contract_types),
    checkPay(opportunity, filters),
    checkLanguage(opportunity, filters.languages),
  ];
  const rejected = checks.find((check) => check.reject);
  return {
    passed: !rejected,
    reject_reason: rejected?.reject ?? null,
    flags: rejected ? [] : checks.map((check) => check.flag).filter(Boolean),
  };
}
