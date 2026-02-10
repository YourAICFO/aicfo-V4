const test = require('node:test');
const assert = require('node:assert/strict');
const { computeConcentration, computeRisk } = require('../src/services/debtorCreditorService');

test('computeConcentration returns top1 and top5 percentages', () => {
  const rows = [
    { balance: 50 },
    { balance: 30 },
    { balance: 20 },
    { balance: 10 },
    { balance: 5 }
  ];
  const concentration = computeConcentration(rows, 115);
  assert.ok(concentration.top1Pct > 0);
  assert.ok(concentration.top5Pct > 0);
});

test('computeRisk returns high for top1 > 30%', () => {
  const risk = computeRisk({ top1Pct: 35, top5Pct: 40 });
  assert.equal(risk.level, 'high');
});

test('computeRisk returns medium for top5 > 45%', () => {
  const risk = computeRisk({ top1Pct: 15, top5Pct: 50 });
  assert.equal(risk.level, 'medium');
});

test('computeRisk returns low when concentrations are small', () => {
  const risk = computeRisk({ top1Pct: 10, top5Pct: 30 });
  assert.equal(risk.level, 'low');
});
