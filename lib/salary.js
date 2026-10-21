// Interpreta salarios escritos a mano ("$50-$75 /hour", "$170k - $200k").
// Devuelve { min, max, currency, period } o null si no se puede interpretar
// con confianza (por ejemplo "per task" o texto sin números).

const CURRENCIES = [
  [/€|\beur\b/i, 'EUR'],
  [/£|\bgbp\b/i, 'GBP'],
  [/\bcad\b|c\$/i, 'CAD'],
  [/\baud\b|a\$/i, 'AUD'],
  [/\$|\busd\b/i, 'USD'],
];

const PERIODS = [
  [/\/\s*h(ou)?r\b|per\s+hour|hourly|\/\s*h\b|an hour|por hora/i, 'hour'],
  [/\/\s*mo(nth)?\b|per\s+month|monthly|mensual|por mes/i, 'month'],
  [/\/\s*y(ea)?r\b|per\s+year|yearly|annual|annum|anual|por a[nñ]o/i, 'year'],
];

const UNSUPPORTED = /per\s+(task|project|article|word|call|lesson)|por\s+(tarea|proyecto)|commission only/i;

export function parseSalaryText(text) {
  if (!text || typeof text !== 'string' || UNSUPPORTED.test(text)) return null;

  // "120,000" y "3.000" usan separador de miles; "35,3k" usa coma decimal.
  const amounts = [...text.matchAll(/(\d+(?:[.,]\d+)*)\s*(k)?/gi)]
    .map(([, number, k]) => {
      let value;
      if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(number)) value = Number(number.replace(/,/g, ''));
      else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(number)) value = Number(number.replace(/\./g, '').replace(',', '.'));
      else value = Number(number.replace(',', '.'));
      if (k) value *= 1000;
      return value;
    })
    .filter((value) => Number.isFinite(value) && value > 0);
  if (amounts.length === 0) return null;

  const min = Math.min(...amounts.slice(0, 2));
  const max = Math.max(...amounts.slice(0, 2));
  const currency = CURRENCIES.find(([re]) => re.test(text))?.[1] ?? null;
  let period = PERIODS.find(([re]) => re.test(text))?.[1] ?? null;

  // Sin período explícito: montos de cinco cifras o más son anuales.
  if (!period && max >= 10000) period = 'year';
  if (!period) return null;

  return { min, max, currency, period };
}
