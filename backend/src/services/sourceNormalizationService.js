const { Op, Sequelize } = require('sequelize');
const {
  SourceLedger,
  SourceMappingRule,
  AccountingTermMapping,
  AccountHeadDictionary,
  sequelize
} = require('../models');

const VALID_NORMALIZED_TYPES = new Set(['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY']);

const toNormalizedType = (value) => {
  if (!value) return null;
  const upper = String(value).trim().toUpperCase();
  if (VALID_NORMALIZED_TYPES.has(upper)) return upper;
  return null;
};

const keywordFallback = async (ledgerName = '') => {
  const source = String(ledgerName || '').trim().toLowerCase();
  if (!source) return null;
  const dictionaryRows = await AccountHeadDictionary.findAll({ raw: true });
  let best = null;
  for (const row of dictionaryRows) {
    const pattern = String(row.match_pattern || row.matchPattern || '').trim().toLowerCase();
    if (!pattern) continue;
    if (!source.includes(pattern) && !pattern.includes(source)) continue;
    const score = pattern.length;
    if (!best || score > best.score) {
      best = { row, score };
    }
  }
  if (!best) return null;
  const canonicalType = String(best.row.canonical_type || best.row.canonicalType || '').toLowerCase();
  const normalizedType = canonicalType === 'revenue'
    ? 'REVENUE'
    : canonicalType === 'expense'
      ? 'EXPENSE'
      : canonicalType === 'liability' || canonicalType === 'creditor'
        ? 'LIABILITY'
        : 'ASSET';
  const normalizedBucket = String(best.row.canonical_subtype || best.row.canonicalSubtype || best.row.canonical_type || best.row.canonicalType || 'unknown');
  return {
    normalizedType,
    normalizedBucket,
    mappingRuleType: 'keyword_fallback',
    confidenceScore: 0.6,
    sourceRuleId: null
  };
};

const resolveByRules = async ({ sourceSystem, ledgerName, groupName, accountType, category }) => {
  const source = String(sourceSystem || '').trim().toLowerCase();
  const rules = await SourceMappingRule.findAll({
    where: {
      sourceSystem: { [Op.in]: [source, 'global'] },
      isActive: true
    },
    raw: true,
    order: [['priority', 'ASC']]
  });

  const fields = {
    ledger_name: String(ledgerName || '').toLowerCase(),
    group_name: String(groupName || '').toLowerCase(),
    account_type: String(accountType || '').toLowerCase(),
    category: String(category || '').toLowerCase()
  };

  let best = null;
  for (const rule of rules) {
    const matchField = String(rule.match_field || rule.matchField || '').toLowerCase();
    const matchValue = String(rule.match_value || rule.matchValue || '').toLowerCase();
    if (!matchField || !matchValue) continue;
    const candidate = fields[matchField];
    if (!candidate) continue;
    if (!(candidate === matchValue || candidate.includes(matchValue))) continue;
    const priority = Number(rule.priority || 100);
    const strength = matchValue.length;
    if (!best || priority < best.priority || (priority === best.priority && strength > best.strength)) {
      best = { rule, priority, strength };
    }
  }
  if (!best) return null;
  const normalizedType = toNormalizedType(best.rule.normalized_type || best.rule.normalizedType);
  if (!normalizedType) return null;
  return {
    normalizedType,
    normalizedBucket: String(best.rule.normalized_bucket || best.rule.normalizedBucket || 'unknown'),
    mappingRuleType: 'system_rule',
    confidenceScore: 1.0,
    sourceRuleId: best.rule.id
  };
};

const normalizeSourceLedger = async ({ sourceSystem, ledgerName, groupName, accountType, category }) => {
  const ruleMatch = await resolveByRules({ sourceSystem, ledgerName, groupName, accountType, category });
  if (ruleMatch) return ruleMatch;
  const fallback = await keywordFallback(ledgerName || category || groupName);
  if (fallback) return fallback;
  return {
    normalizedType: 'ASSET',
    normalizedBucket: 'unknown',
    mappingRuleType: 'keyword_fallback',
    confidenceScore: 0.1,
    sourceRuleId: null
  };
};

const upsertAccountingTermMapping = async ({
  sourceSystem,
  sourceTerm,
  normalizedType,
  normalizedBucket,
  mappingRuleType,
  confidenceScore,
  sourceRuleId
}, transaction = null) => {
  const where = { sourceSystem: String(sourceSystem || '').toLowerCase(), sourceTerm };
  const existing = await AccountingTermMapping.findOne({ where, transaction });
  const payload = {
    sourceSystem: where.sourceSystem,
    sourceTerm,
    normalizedTerm: normalizedBucket,
    normalizedType,
    mappingRuleType: mappingRuleType || 'system_rule',
    confidenceScore: Number(confidenceScore || 1.0),
    sourceRuleId: sourceRuleId || null
  };
  if (existing) {
    await existing.update(payload, { transaction });
    return existing;
  }
  return AccountingTermMapping.create(payload, { transaction });
};

const upsertSourceLedgersFromChartOfAccounts = async (companyId, sourceSystem, chartOfAccounts) => {
  if (!chartOfAccounts || !Array.isArray(chartOfAccounts.ledgers)) return { count: 0 };
  const groups = Array.isArray(chartOfAccounts.groups) ? chartOfAccounts.groups : [];
  const parentByGroup = new Map();
  for (const g of groups) {
    const name = g.name || g.group_name || g.groupName;
    if (!name) continue;
    parentByGroup.set(String(name), g.parent || g.parent_group || g.parentGroup || null);
  }

  let count = 0;
  for (const ledger of chartOfAccounts.ledgers) {
    const name = ledger.name || ledger.ledger_name || ledger.ledgerName;
    if (!name) continue;
    const groupName = ledger.group || ledger.group_name || ledger.groupName || null;
    const parentGroup = groupName ? parentByGroup.get(String(groupName)) || null : null;
    const path = [parentGroup, groupName].filter(Boolean).join(' > ') || null;
    await SourceLedger.upsert({
      companyId,
      sourceSystem: String(sourceSystem || 'unknown').toLowerCase(),
      sourceLedgerId: ledger.guid || ledger.id || ledger.ledgerGuid || null,
      sourceLedgerName: name,
      sourceGroupName: groupName,
      sourceParentGroup: parentGroup,
      sourceGroupPath: path,
      rawPayload: ledger
    });

    const normalized = await normalizeSourceLedger({
      sourceSystem,
      ledgerName: name,
      groupName,
      accountType: ledger.account_type || ledger.accountType || null,
      category: ledger.category || null
    });
    await upsertAccountingTermMapping({
      sourceSystem,
      sourceTerm: name,
      normalizedType: normalized.normalizedType,
      normalizedBucket: normalized.normalizedBucket,
      mappingRuleType: normalized.mappingRuleType,
      confidenceScore: normalized.confidenceScore,
      sourceRuleId: normalized.sourceRuleId
    });
    count += 1;
  }
  return { count };
};

const upsertSourceLedgersFromTransactions = async (companyId, sourceSystem, transactions = []) => {
  let count = 0;
  for (const tx of transactions) {
    const metadata = tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
    const ledgerName = metadata.ledger_name || metadata.account_name || tx.category || tx.subcategory || null;
    if (!ledgerName) continue;
    const groupName = metadata.group_name || metadata.group || tx.type || null;
    await SourceLedger.upsert({
      companyId,
      sourceSystem: String(sourceSystem || 'unknown').toLowerCase(),
      sourceLedgerId: metadata.ledger_id || metadata.account_id || tx.externalId || null,
      sourceLedgerName: ledgerName,
      sourceGroupName: groupName,
      sourceParentGroup: metadata.parent_group || null,
      sourceGroupPath: metadata.group_path || null,
      rawPayload: tx
    });

    const normalized = await normalizeSourceLedger({
      sourceSystem,
      ledgerName,
      groupName,
      accountType: metadata.account_type || null,
      category: tx.category || null
    });
    await upsertAccountingTermMapping({
      sourceSystem,
      sourceTerm: ledgerName,
      normalizedType: normalized.normalizedType,
      normalizedBucket: normalized.normalizedBucket,
      mappingRuleType: normalized.mappingRuleType,
      confidenceScore: normalized.confidenceScore,
      sourceRuleId: normalized.sourceRuleId
    });
    count += 1;
  }
  return { count };
};

const getCoverage = async (companyId) => {
  const totals = await sequelize.query(
    `SELECT COUNT(*)::int AS total
     FROM source_ledgers
     WHERE company_id = :companyId`,
    { replacements: { companyId }, type: Sequelize.QueryTypes.SELECT }
  );
  const mapped = await sequelize.query(
    `SELECT COUNT(*)::int AS mapped
     FROM source_ledgers s
     WHERE s.company_id = :companyId
       AND EXISTS (
         SELECT 1
         FROM accounting_term_mapping m
         WHERE lower(m.source_system) = lower(s.source_system)
           AND m.source_term = s.source_ledger_name
       )`,
    { replacements: { companyId }, type: Sequelize.QueryTypes.SELECT }
  );
  const total = Number(totals[0]?.total || 0);
  const mappedCount = Number(mapped[0]?.mapped || 0);
  const unmapped = Math.max(total - mappedCount, 0);
  const coveragePct = total > 0 ? Number(((mappedCount / total) * 100).toFixed(2)) : 0;
  return { totalLedgers: total, mappedLedgers: mappedCount, unmappedLedgers: unmapped, coveragePct };
};

const createRule = async (payload) => {
  return SourceMappingRule.create({
    sourceSystem: String(payload.sourceSystem || '').toLowerCase(),
    matchField: String(payload.matchField || '').toLowerCase(),
    matchValue: String(payload.matchValue || '').toLowerCase(),
    normalizedType: String(payload.normalizedType || '').toUpperCase(),
    normalizedBucket: String(payload.normalizedBucket || '').toLowerCase(),
    priority: Number(payload.priority ?? 100),
    isActive: payload.isActive !== false
  });
};

module.exports = {
  normalizeSourceLedger,
  upsertAccountingTermMapping,
  upsertSourceLedgersFromChartOfAccounts,
  upsertSourceLedgersFromTransactions,
  getCoverage,
  createRule
};
