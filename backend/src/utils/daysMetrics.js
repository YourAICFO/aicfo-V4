/**
 * Deterministic DSO/DPO/DIO/CCC from totals and denominators. Returns null when denominator missing/0 or result non-finite.
 * Used by computeCfoMetrics; unit-tested for safe behavior.
 */

/**
 * @param {number} balance - e.g. debtor or creditor total
 * @param {number|null} monthlyDenom - e.g. monthly revenue (for DSO) or monthly COGS (for DPO)
 * @param {number} daysInPeriod - e.g. 30 for monthly
 * @returns {number|null} days or null
 */
function daysFromBalance(balance, monthlyDenom, daysInPeriod = 30) {
  if (monthlyDenom == null || !Number.isFinite(monthlyDenom) || monthlyDenom <= 0) return null;
  const b = Number(balance);
  if (!Number.isFinite(b)) return null;
  const d = (b / monthlyDenom) * daysInPeriod;
  return Number.isFinite(d) ? d : null;
}

/**
 * DSO = (debtors / monthly revenue) * 30
 */
function dso(debtorTotal, monthlyRevenueAvg, daysInPeriod = 30) {
  return daysFromBalance(debtorTotal, monthlyRevenueAvg, daysInPeriod);
}

/**
 * DPO = (creditors / monthly COGS) * 30
 */
function dpo(creditorTotal, monthlyCogs, daysInPeriod = 30) {
  return daysFromBalance(creditorTotal, monthlyCogs, daysInPeriod);
}

/**
 * DIO = (average inventory / monthly COGS) * 30
 */
function dio(averageInventory, monthlyCogs, daysInPeriod = 30) {
  return daysFromBalance(averageInventory, monthlyCogs, daysInPeriod);
}

/**
 * CCC = DSO + DIO - DPO. Returns null unless all three components are finite.
 * No fallback: do not use DSO - DPO as CCC when DIO is missing.
 */
function ccc(dsoDays, dpoDays, dioDays) {
  const ds = dsoDays != null && Number.isFinite(dsoDays) ? dsoDays : null;
  const dp = dpoDays != null && Number.isFinite(dpoDays) ? dpoDays : null;
  const di = dioDays != null && Number.isFinite(dioDays) ? dioDays : null;
  if (ds != null && dp != null && di != null) {
    const val = ds + di - dp;
    return Number.isFinite(val) ? val : null;
  }
  return null;
}

/**
 * Cash gap excluding inventory (DSO - DPO). Use when DIO is missing and CCC cannot be computed.
 * Returns null unless both DSO and DPO are finite.
 */
function cashGapExInventory(dsoDays, dpoDays) {
  const ds = dsoDays != null && Number.isFinite(dsoDays) ? dsoDays : null;
  const dp = dpoDays != null && Number.isFinite(dpoDays) ? dpoDays : null;
  if (ds != null && dp != null) {
    const val = ds - dp;
    return Number.isFinite(val) ? val : null;
  }
  return null;
}

module.exports = {
  daysFromBalance,
  dso,
  dpo,
  dio,
  ccc,
  cashGapExInventory
};
