// Identidad de una oferta para deduplicar dentro de una fuente y entre fuentes.
// Ver docs/decisions/0004-fingerprint.md.
import { createHash } from 'node:crypto';
import { simplify } from './text.js';

const LEGAL_SUFFIXES = new Set([
  'inc', 'llc', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company', 'gmbh', 'ag',
  'sa', 'sas', 'srl', 'sl', 'bv', 'oy', 'ab', 'plc', 'pty', 'pte', 'sarl', 'spa',
]);

export function normalizeCompany(company) {
  const words = simplify(company).split(' ').filter(Boolean);
  // "S.A." queda como "s a": se unen las letras sueltas finales antes de comparar.
  while (words.length > 2 && words.at(-1).length === 1 && words.at(-2).length === 1) {
    words.push(words.splice(-2).join(''));
  }
  while (words.length > 1 && LEGAL_SUFFIXES.has(words.at(-1))) words.pop();
  return words.join(' ');
}

// Quita lo que varía entre fuentes para el mismo puesto: notas entre
// paréntesis o corchetes ("(Remote)", "[LATAM]") y la palabra remote/remoto.
export function normalizeTitle(title) {
  const withoutNotes = String(title ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  return simplify(withoutNotes)
    .split(' ')
    .filter((word) => word && word !== 'remote' && word !== 'remoto')
    .join(' ');
}

// URL sin query ni fragmento, host en minúsculas y sin barra final.
export function canonicalUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}`;
  } catch {
    return String(url ?? '').trim();
  }
}

export function fingerprint({ company, title, url }) {
  const companyKey = normalizeCompany(company);
  const titleKey = normalizeTitle(title);
  const key = companyKey && titleKey ? `ct:${companyKey}|${titleKey}` : `url:${canonicalUrl(url)}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}
