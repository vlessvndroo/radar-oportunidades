// Utilidades de texto compartidas por los parsers de fuentes.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  bull: '•', middot: '·', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£',
};

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

// HTML a texto plano conservando saltos de párrafo y viñetas.
// Algunas fuentes envían el HTML escapado ("&lt;p&gt;"): se desescapa primero.
export function htmlToText(html) {
  if (!html) return '';
  const markup = /&lt;\/?[a-z]/i.test(html) ? decodeEntities(html) : html;
  return decodeEntities(
    markup
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/(p|div|ul|ol|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/<[a-z/!][^>]*$/i, ''), // etiqueta cortada al final
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Remote OK entrega algunos textos codificados dos veces ("MÃ©xico").
// Si el texto tiene ese patrón y cabe en latin1, se vuelve a decodificar
// como UTF-8; si el resultado no es UTF-8 válido, se deja como estaba.
const MOJIBAKE = /[ÃÂ][\u0080-¿]|[ØÙ][\u0080-¿]/;
const utf8 = new TextDecoder('utf-8', { fatal: true });

export function fixMojibake(text) {
  if (typeof text !== 'string' || !MOJIBAKE.test(text)) return text;
  const bytes = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code > 0xff) return text;
    bytes.push(code);
  }
  try {
    return utf8.decode(Uint8Array.from(bytes));
  } catch {
    return text;
  }
}

// Quita banderas emoji (pares de "regional indicators").
export function stripFlags(text) {
  return text.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '');
}

// Texto corto de una sola línea, o null si queda vacío.
export function cleanLine(text) {
  if (text == null) return null;
  const line = decodeEntities(String(text)).replace(/\s+/g, ' ').trim();
  return line || null;
}

// Minúsculas sin acentos ni signos: base para comparar textos.
export function simplify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
