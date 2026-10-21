import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, htmlToText, fixMojibake, stripFlags, cleanLine, simplify } from '../text.js';

test('decodeEntities resuelve entidades con nombre, decimales y hexadecimales', () => {
  assert.equal(decodeEntities('a &amp; b &lt;p&gt; &#39;x&#39; &#x2014; &nbsp;'), "a & b <p> 'x' —  ");
  assert.equal(decodeEntities('&desconocida;'), '&desconocida;');
});

test('htmlToText conserva párrafos y viñetas y quita etiquetas', () => {
  const html = '<p>Hola&nbsp;mundo</p><ul><li>Uno</li><li>Dos</li></ul><script>x()</script><p>Fin<br>línea</p>';
  assert.equal(htmlToText(html), 'Hola mundo\n\n• Uno\n• Dos\nFin\nlínea');
  assert.equal(htmlToText(null), '');
});

test('htmlToText desescapa HTML que viene escapado y quita etiquetas cortadas', () => {
  assert.equal(htmlToText('&lt;p&gt;Hola &amp;amp; chao&lt;/p&gt;'), 'Hola & chao');
  assert.equal(htmlToText('<p>Texto</p><li class="li'), 'Texto');
});

test('fixMojibake repara texto codificado dos veces', () => {
  assert.equal(fixMojibake('Ciudad de MÃ©xico'), 'Ciudad de México');
  assert.equal(fixMojibake('SÃ£o Paulo'), 'São Paulo');
});

test('fixMojibake no toca texto correcto ni texto que no cabe en latin1', () => {
  assert.equal(fixMojibake('Ciudad de México'), 'Ciudad de México');
  assert.equal(fixMojibake('MÃ©xico — 東京'), 'MÃ©xico — 東京');
  assert.equal(fixMojibake(null), null);
});

test('stripFlags quita banderas emoji', () => {
  assert.equal(stripFlags('🇻🇪 Venezuela y 🇨🇴 Colombia'), ' Venezuela y  Colombia');
});

test('cleanLine compacta espacios y devuelve null si queda vacío', () => {
  assert.equal(cleanLine('  Dev\n  &amp; Ops  '), 'Dev & Ops');
  assert.equal(cleanLine('   '), null);
  assert.equal(cleanLine(undefined), null);
});

test('simplify quita acentos, mayúsculas y signos', () => {
  assert.equal(simplify('Ingeniería Full-Stack (Sr.)'), 'ingenieria full stack sr');
});
