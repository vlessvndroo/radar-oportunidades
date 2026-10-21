import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSalaryText } from '../salary.js';

test('rango anual con k', () => {
  assert.deepEqual(parseSalaryText('$170k - $200k'), { min: 170000, max: 200000, currency: 'USD', period: 'year' });
});

test('coma decimal y coma de miles', () => {
  assert.deepEqual(parseSalaryText('$35,3k- $52k'), { min: 35300, max: 52000, currency: 'USD', period: 'year' });
  assert.deepEqual(parseSalaryText('$120,000 - $150,000'), { min: 120000, max: 150000, currency: 'USD', period: 'year' });
});

test('salario por hora', () => {
  assert.deepEqual(parseSalaryText('$50-$75 /hour'), { min: 50, max: 75, currency: 'USD', period: 'hour' });
  assert.deepEqual(parseSalaryText('USD 15 per hour'), { min: 15, max: 15, currency: 'USD', period: 'hour' });
});

test('salario mensual en otra moneda, con punto de miles', () => {
  assert.deepEqual(parseSalaryText('€3.000 - €4.000 per month'), { min: 3000, max: 4000, currency: 'EUR', period: 'month' });
  assert.deepEqual(parseSalaryText('2500 - 3000 EUR monthly'), { min: 2500, max: 3000, currency: 'EUR', period: 'month' });
});

test('texto con prefijo como OTE', () => {
  assert.deepEqual(parseSalaryText('OTE $25k - $35k'), { min: 25000, max: 35000, currency: 'USD', period: 'year' });
});

test('devuelve null cuando no se puede interpretar con confianza', () => {
  assert.equal(parseSalaryText('$1000 per task'), null);
  assert.equal(parseSalaryText('Competitive'), null);
  assert.equal(parseSalaryText('$900'), null); // sin período y monto bajo: ambiguo
  assert.equal(parseSalaryText(''), null);
  assert.equal(parseSalaryText(null), null);
});
