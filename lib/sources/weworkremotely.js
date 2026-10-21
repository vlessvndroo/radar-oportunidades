// Parser del RSS público de We Work Remotely.
// El título trae la empresa ("Empresa: Puesto"); la restricción de ubicación
// viene repartida entre <region>, <country> y <state>.
import { decodeEntities, htmlToText, stripFlags } from '../text.js';

function tagValue(item, name) {
  const match = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!match) return '';
  return match[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim();
}

function splitSkills(skills) {
  return decodeEntities(skills)
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

export function parseWeWorkRemotely(body) {
  if (typeof body !== 'string' || !body.includes('<rss')) {
    throw new Error('Respuesta de We Work Remotely no es un RSS');
  }
  const items = body.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items.map((item) => {
    const fullTitle = decodeEntities(tagValue(item, 'title'));
    const separator = fullTitle.indexOf(': ');
    const company = separator > 0 ? fullTitle.slice(0, separator) : null;
    const title = separator > 0 ? fullTitle.slice(separator + 2) : fullTitle;

    const region = decodeEntities(tagValue(item, 'region'));
    const country = stripFlags(decodeEntities(tagValue(item, 'country'))).replace(/\s+/g, ' ').trim();
    const state = decodeEntities(tagValue(item, 'state'));
    const category = decodeEntities(tagValue(item, 'category'));
    const url = tagValue(item, 'link') || tagValue(item, 'guid');

    return {
      title,
      company,
      url,
      location: [region, country, state].filter(Boolean).join(' — '),
      remote: true,
      contract_type: tagValue(item, 'type'),
      description: htmlToText(decodeEntities(tagValue(item, 'description'))),
      tags: [...splitSkills(tagValue(item, 'skills')), category].filter(Boolean),
      published_at: tagValue(item, 'pubDate'),
      raw: {
        title: fullTitle,
        region,
        country,
        state,
        category,
        type: tagValue(item, 'type'),
        pubDate: tagValue(item, 'pubDate'),
        expires_at: tagValue(item, 'expires_at'),
        link: url,
      },
    };
  });
}
