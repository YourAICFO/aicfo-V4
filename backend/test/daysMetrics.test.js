const test = require('node:test');
const assert = require('node:assert/strict');
const { daysFromBalance, dso, dpo, dio, ccc, cashGapExInventory } = require('../src/utils/daysMetrics');

test('daysFromBalance: returns null when denominator is 0', () => {
  assert.equal(daysFromBalance(100, 0), null);
  assert.equal(daysFromBalance(100, null), null);
  assert.equal(daysFromBalance(100, undefined), null);
});

test('daysFromBalance: returns null when denominator is negative', () => {
  assert.equal(daysFromBalance(100, -1), null);
});

test('daysFromBalance: returns number when denominator > 0', () => {
  assert.equal(daysFromBalance(100, 10, 30), 300);
  assert.equal(daysFromBalance(0, 10, 30), 0);
});

test('daysFromBalance: returns null when balance is non-finite', () => {
  assert.equal(daysFromBalance(NaN, 10), null);
  assert.equal(daysFromBalance(Infinity, 10), null);
});

test('DSO: null when revenue 0 or missing', () => {
  assert.equal(dso(1000, 0), null);
  assert.equal(dso(1000, null), null);
  assert.equal(dso(1000, undefined), null);
});

test('DSO: finite when revenue > 0', () => {
  assert.ok(Number.isFinite(dso(100, 10)));
  assert.equal(dso(100, 10, 30), 300);
});

test('DPO: null when COGS 0 or missing', () => {
  assert.equal(dpo(500, 0), null);
  assert.equal(dpo(500, null), null);
});

test('DPO: finite when COGS > 0', () => {
  assert.ok(Number.isFinite(dpo(150, 10)));
  assert.equal(dpo(150, 10, 30), 450);
});

test('DIO: null when COGS 0 or missing', () => {
  assert.equal(dio(200, 0), null);
  assert.equal(dio(200, null), null);
});

test('DIO: finite when COGS > 0', () => {
  assert.ok(Number.isFinite(dio(100, 10)));
  assert.equal(dio(100, 10, 30), 300);
});

test('CCC: null unless all three DSO, DIO, DPO finite', () => {
  assert.equal(ccc(null, 30, 20), null);
  assert.equal(ccc(40, null, 20), null);
  assert.equal(ccc(40, 30, null), null);
  assert.equal(ccc(40, 30, undefined), null);
  assert.equal(ccc(40, 30, 20), 30);
});

test('CCC: full formula when all finite', () => {
  assert.equal(ccc(40, 30, 20), 40 + 20 - 30);
});

test('CCC: null when DSO or DPO non-finite', () => {
  assert.equal(ccc(NaN, 30, 20), null);
  assert.equal(ccc(40, NaN, 20), null);
});

test('cashGapExInventory: null when DSO or DPO missing', () => {
  assert.equal(cashGapExInventory(null, 30), null);
  assert.equal(cashGapExInventory(40, null), null);
  assert.equal(cashGapExInventory(40, 30), 10);
});

test('cashGapExInventory: DSO - DPO when both finite', () => {
  assert.equal(cashGapExInventory(40, 30), 10);
  assert.equal(cashGapExInventory(30, 40), -10);
});

test('cashGapExInventory: null when non-finite', () => {
  assert.equal(cashGapExInventory(NaN, 30), null);
  assert.equal(cashGapExInventory(40, NaN), null);
});
