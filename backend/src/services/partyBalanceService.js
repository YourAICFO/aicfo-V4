const { Sequelize } = require('sequelize');
const {
  MonthlyDebtorsSnapshot,
  MonthlyCreditorsSnapshot,
  PartyBalanceLatest
} = require('../models');
const { getLatestClosedMonthKey, listMonthKeysBetween } = require('./monthlySnapshotService');

const monthEndDate = (monthKey) => {
  if (!monthKey) return null;
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month, 0);
  return d.toISOString().slice(0, 10);
};

const upsertLatestFromSnapshot = async (companyId) => {
  try {
    const latestDebtorMonth = await MonthlyDebtorsSnapshot.findOne({
      where: { companyId },
      order: [['month', 'DESC']],
      raw: true
    });
    const latestCreditorMonth = await MonthlyCreditorsSnapshot.findOne({
      where: { companyId },
      order: [['month', 'DESC']],
      raw: true
    });

    const latestMonth = latestDebtorMonth?.month || latestCreditorMonth?.month || getLatestClosedMonthKey();
    if (!latestMonth) {
      return { asOfDate: null, totals: 0, top: [] };
    }

    const asOfDate = monthEndDate(latestMonth);

    const debtors = await MonthlyDebtorsSnapshot.findAll({
      where: { companyId, month: latestMonth },
      raw: true
    });
    const creditors = await MonthlyCreditorsSnapshot.findAll({
      where: { companyId, month: latestMonth },
      raw: true
    });

    if (debtors.length === 0 && creditors.length === 0) {
      return { asOfDate: null, totals: 0, top: [] };
    }

    await PartyBalanceLatest.destroy({
      where: { companyId, asOfDate }
    });

    const records = [];
    for (const d of debtors) {
      records.push({
        companyId,
        asOfDate,
        partyType: 'debtor',
        partyName: d.debtorName,
        balance: Number(d.outstandingAmount || 0),
        source: 'snapshot'
      });
    }

    for (const c of creditors) {
      records.push({
        companyId,
        asOfDate,
        partyType: 'creditor',
        partyName: c.creditorName,
        balance: Number(c.outstandingAmount || 0),
        source: 'snapshot'
      });
    }

    if (records.length > 0) {
      await PartyBalanceLatest.bulkCreate(records, { updateOnDuplicate: ['balance', 'updatedAt'] });
    }

    return { asOfDate, totals: records.length, top: records.slice(0, 10) };
  } catch (error) {
    console.warn('partyBalanceService.upsertLatestFromSnapshot failed:', error.message);
    return { asOfDate: null, totals: 0, top: [] };
  }
};

const getLatestAsOfDate = async (companyId, type) => {
  const row = await PartyBalanceLatest.findOne({
    where: { companyId, partyType: type },
    order: [['as_of_date', 'DESC']],
    raw: true
  });
  return row?.asOfDate || null;
};

const getSummary = async (companyId, type) => {
  const asOfDate = await getLatestAsOfDate(companyId, type);
  if (!asOfDate) {
    return { asOfDate: null, total: 0, top10: [], concentrationTop10Pct: 0, changeVsPrev: 0 };
  }

  const rows = await PartyBalanceLatest.findAll({
    where: { companyId, partyType: type, asOfDate },
    order: [['balance', 'DESC']],
    raw: true
  });
  const total = rows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
  const top10 = rows.slice(0, 10).map(r => ({ name: r.partyName, balance: Number(r.balance || 0) }));
  const top10Sum = top10.reduce((sum, r) => sum + r.balance, 0);
  const concentrationTop10Pct = total > 0 ? (top10Sum / total) * 100 : 0;

  const prev = await PartyBalanceLatest.findOne({
    where: { companyId, partyType: type, asOfDate: { [Sequelize.Op.lt]: asOfDate } },
    order: [['as_of_date', 'DESC']],
    raw: true
  });
  let changeVsPrev = 0;
  if (prev?.asOfDate) {
    const prevRows = await PartyBalanceLatest.findAll({
      where: { companyId, partyType: type, asOfDate: prev.asOfDate },
      raw: true
    });
    const prevTotal = prevRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    changeVsPrev = prevTotal ? (total - prevTotal) / prevTotal : 0;
  }

  return { asOfDate, total, top10, concentrationTop10Pct, changeVsPrev };
};

const getList = async (companyId, type, limit = 50) => {
  const asOfDate = await getLatestAsOfDate(companyId, type);
  if (!asOfDate) return [];
  const rows = await PartyBalanceLatest.findAll({
    where: { companyId, partyType: type, asOfDate },
    order: [['balance', 'DESC']],
    limit,
    raw: true
  });
  return rows.map(r => ({ name: r.partyName, balance: Number(r.balance || 0) }));
};

module.exports = {
  upsertLatestFromSnapshot,
  getSummary,
  getList
};
