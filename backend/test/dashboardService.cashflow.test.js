const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeCashflowFromSeries,
  MIN_MONTHS_FOR_CASHFLOW_AVG
} = require('../src/services/dashboardService');

test('computeCashflowFromSeries: netChange positive contributes to inflow only', () => {
  const series = [
    { month: '2024-01', opening: 100, closing: 150, netChange: 50 },
    { month: '2024-02', opening: 150, closing: 200, netChange: 50 },
    { month: '2024-03', opening: 200, closing: 250, netChange: 50 }
  ];
  const r = computeCashflowFromSeries(series);
  assert.equal(r.months.length, 3);
  r.months.forEach((m) => {
    assert.equal(m.inflow, 50);
    assert.equal(m.outflow, 0);
  });
  assert.equal(r.avgCashInflow, 50);
  assert.equal(r.avgCashOutflow, 0);
  assert.equal(r.netCashFlow, 50);
});

test('computeCashflowFromSeries: netChange negative contributes to outflow only', () => {
  const series = [
    { month: '2024-01', opening: 200, closing: 150, netChange: -50 },
    { month: '2024-02', opening: 150, closing: 100, netChange: -50 },
    { month: '2024-03', opening: 100, closing: 50, netChange: -50 }
  ];
  const r = computeCashflowFromSeries(series);
  r.months.forEach((m) => {
    assert.equal(m.inflow, 0);
    assert.equal(m.outflow, 50);
  });
  assert.equal(r.avgCashInflow, 0);
  assert.equal(r.avgCashOutflow, 50);
  assert.equal(r.netCashFlow, -50);
});

test('computeCashflowFromSeries: netCashFlow equals average netChange', () => {
  const series = [
    { month: '2024-01', opening: 100, closing: 120, netChange: 20 },
    { month: '2024-02', opening: 120, closing: 90, netChange: -30 },
    { month: '2024-03', opening: 90, closing: 110, netChange: 20 },
    { month: '2024-04', opening: 110, closing: 100, netChange: -10 }
  ];
  const r = computeCashflowFromSeries(series);
  const avgNetChange = (20 - 30 + 20 - 10) / 4;
  assert.equal(r.netCashFlow, avgNetChange);
});

test('computeCashflowFromSeries: fewer than 3 months returns nulls', () => {
  const series = [
    { month: '2024-01', opening: 100, closing: 150, netChange: 50 },
    { month: '2024-02', opening: 150, closing: 200, netChange: 50 }
  ];
  const r = computeCashflowFromSeries(series);
  assert.equal(r.months.length, 2);
  assert.equal(r.avgCashInflow, null);
  assert.equal(r.avgCashOutflow, null);
  assert.equal(r.netCashFlow, null);
});

test('computeCashflowFromSeries: exactly 3 months returns numeric averages', () => {
  const series = [
    { month: '2024-01', opening: 0, closing: 100, netChange: 100 },
    { month: '2024-02', opening: 100, closing: 50, netChange: -50 },
    { month: '2024-03', opening: 50, closing: 80, netChange: 30 }
  ];
  const r = computeCashflowFromSeries(series);
  assert.equal(r.months.length, 3);
  assert.equal(r.avgCashInflow, (100 + 0 + 30) / 3);
  assert.equal(r.avgCashOutflow, (0 + 50 + 0) / 3);
  assert.equal(r.netCashFlow, (100 - 50 + 30) / 3);
});

test('MIN_MONTHS_FOR_CASHFLOW_AVG is 3', () => {
  assert.equal(MIN_MONTHS_FOR_CASHFLOW_AVG, 3);
});
