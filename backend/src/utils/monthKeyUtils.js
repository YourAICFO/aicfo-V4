const normalizeMonth = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 7);
  }
  if (typeof value === 'number') {
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString().slice(0, 7);
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 7);
  }
  return null;
};

const getMonthKeyOffset = (monthKey, deltaMonths) => {
  if (!monthKey) return null;
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1 + deltaMonths, 1);
  return normalizeMonth(d);
};

const listMonthKeysBetween = (startKey, endKey) => {
  const keys = [];
  if (!startKey || !endKey) return keys;
  let cursor = startKey;
  while (cursor && cursor <= endKey) {
    keys.push(cursor);
    cursor = getMonthKeyOffset(cursor, 1);
  }
  return keys;
};

const getCurrentMonthKey = () => normalizeMonth(new Date());

module.exports = {
  normalizeMonth,
  listMonthKeysBetween,
  getCurrentMonthKey,
  getMonthKeyOffset
};
