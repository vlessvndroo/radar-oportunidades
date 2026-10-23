// Utilidades compartidas por filtros y puntuación: búsqueda de palabras
// completas, salario por hora en USD y años de experiencia exigidos.
import { simplify } from './text.js';

const HOURS_PER = { hour: 1, month: 160, year: 2080 };

// Texto simplificado de los campos pedidos de una oferta.
export function fieldText(opportunity, fields = ['title', 'tags', 'description']) {
  return fields
    .map((field) => {
      const value = opportunity[field];
      return Array.isArray(value) ? value.join(' ') : value ?? '';
    })
    .map(simplify)
    .join(' ');
}

// Primera palabra clave que aparece como palabra (o frase) completa.
// "node.js" se compara como "node js"; "jr" no coincide dentro de "jrnal".
export function findKeyword(text, keywords) {
  const padded = ` ${text} `;
  for (const keyword of keywords ?? []) {
    const key = simplify(keyword);
    if (key && padded.includes(` ${key} `)) return keyword;
  }
  return null;
}

// Salario máximo publicado convertido a USD por hora, o null si no hay
// salario, la moneda no es USD, el período es desconocido o el monto es
// imposible (menos de 1 o más de 500 USD/h: dato mal cargado en la fuente).
export function hourlyUsd(opportunity) {
  const amount = Number(opportunity.salary_max ?? opportunity.salary_min);
  const hours = HOURS_PER[opportunity.period];
  if (!Number.isFinite(amount) || amount <= 0 || !hours) return null;
  if (opportunity.currency && opportunity.currency !== 'USD') return null;
  const hourly = Math.round((amount / hours) * 100) / 100;
  return hourly >= 1 && hourly <= 500 ? hourly : null;
}

// Quita del texto frases que no deben contar ("semi senior" no es "senior").
export function withoutPhrases(text, phrases) {
  let rest = ` ${text} `;
  for (const phrase of phrases ?? []) {
    const key = simplify(phrase);
    if (key) rest = rest.split(` ${key} `).join(' ');
  }
  return rest.trim();
}

// Mayor cantidad de años de experiencia que pide la descripción
// ("5+ years", "at least 7 years", "más de 5 años"); null si no pide.
// Solo cuenta si cerca aparece "experience"/"experiencia", para no confundir
// "fundada hace 10 años" con un requisito.
export function requiredYears(text) {
  const plain = simplify(text);
  const pattern = /\b(\d{1,2})\s*(?:plus\s+)?(?:or more\s+|o mas\s+)?(?:years?|yrs?|anos)\b/g;
  const context = /experience|experiencia|exp\b/;
  let max = null;
  for (const match of plain.matchAll(pattern)) {
    const years = Number(match[1]);
    const around = plain.slice(Math.max(0, match.index - 40), match.index + match[0].length + 50);
    if (years >= 1 && years <= 20 && context.test(around) && !/\bago\b|\bhace\b/.test(around)) {
      max = Math.max(max ?? 0, years);
    }
  }
  return max;
}
