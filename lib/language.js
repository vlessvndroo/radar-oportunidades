// Detección de idioma por palabras frecuentes. Suficiente para distinguir
// ofertas en inglés, español, portugués, alemán y francés; devuelve
// 'unknown' cuando el texto es corto o no hay un idioma claramente dominante.
import { simplify } from './text.js';

const STOPWORDS = {
  en: ['the', 'and', 'with', 'you', 'for', 'our', 'are', 'will', 'your', 'this', 'that', 'experience', 'team', 'work', 'have'],
  es: ['el', 'la', 'los', 'las', 'del', 'con', 'para', 'por', 'una', 'que', 'experiencia', 'equipo', 'trabajo', 'conocimientos', 'buscamos'],
  pt: ['voce', 'nao', 'uma', 'com', 'para', 'experiencia', 'equipe', 'trabalho', 'nosso', 'sao', 'vaga', 'conhecimento', 'das', 'dos', 'em'],
  de: ['und', 'der', 'die', 'das', 'mit', 'fur', 'wir', 'sie', 'ist', 'erfahrung', 'ein', 'eine', 'auf', 'zu', 'ihre'],
  fr: ['les', 'des', 'une', 'avec', 'pour', 'vous', 'nous', 'est', 'dans', 'experience', 'equipe', 'sur', 'aux', 'vos', 'votre'],
};

const MIN_HITS = 5;

export function detectLanguage(text) {
  const words = simplify(text).split(' ');
  if (words.length < 15) return 'unknown';

  const counts = {};
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list);
    counts[lang] = words.reduce((n, word) => n + (set.has(word) ? 1 : 0), 0);
  }
  const [best, second] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (best[1] < MIN_HITS || best[1] < second[1] * 1.5) return 'unknown';
  return best[0];
}
