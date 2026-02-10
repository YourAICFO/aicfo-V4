const { AccountHeadDictionary } = require('../models');
const { logUsageEvent } = require('./adminUsageService');

const seenUnmapped = new Set();

const normalizeText = (value) =>
  (value || '')
    .toLowerCase()
    .trim()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ');

const normalizeAccountHead = async (rawName) => {
  const cleaned = normalizeText(rawName);
  if (!cleaned) {
    return { raw: rawName, canonicalType: 'unknown', canonicalSubtype: null };
  }

  const matches = await AccountHeadDictionary.findAll({
    order: [['priority', 'DESC']],
    raw: true
  });

  const found = matches.find((row) => cleaned.includes(row.matchPattern.toLowerCase()));
  if (found) {
    return {
      raw: rawName,
      canonicalType: found.canonicalType,
      canonicalSubtype: found.canonicalSubtype || null
    };
  }

  if (!seenUnmapped.has(cleaned)) {
    seenUnmapped.add(cleaned);
    logUsageEvent({
      companyId: null,
      userId: null,
      eventType: 'head_unmapped',
      eventName: 'account_head_unmapped',
      metadata: { raw: rawName }
    });
  }

  return { raw: rawName, canonicalType: 'unknown', canonicalSubtype: null };
};

module.exports = { normalizeAccountHead };
