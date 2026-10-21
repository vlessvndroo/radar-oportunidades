import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('lib se puede cargar con require, como lo hacen los Code nodes de n8n', () => {
  const lib = require('../index.js');
  assert.equal(typeof lib.LIB_VERSION, 'string');
});
