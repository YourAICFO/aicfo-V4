/**
 * Formal interface for accounting source adapters (multi-source architecture).
 * Implementations: Tally (tallyCoaAdapter), future: Zoho, QBO, Xero, API ingestion.
 * Downstream services (snapshot, metrics, runway, alerts, pl-pack) MUST consume only
 * normalized tables and never reference raw source schema or adapter-specific fields.
 *
 * @typedef {Object} NormalizedGroup
 * @property {string} name
 * @property {string|null} parent
 * @property {string} [guid]
 * @property {string} [type]
 *
 * @typedef {Object} NormalizedLedger
 * @property {string} guid
 * @property {string} name
 * @property {string|null} parent
 * @property {string} [groupName]
 * @property {string} [type]
 *
 * @typedef {Object} BalanceItem
 * @property {string} ledgerGuid
 * @property {number} balance
 *
 * @typedef {Object} NormalizedBalances
 * @property {{ monthKey: string, asOfDate?: string, items: BalanceItem[] }} [current]
 * @property {{ monthKey: string, items: BalanceItem[] }[]} [closedMonths]
 *
 * @typedef {Object} NormalizedChartOfAccounts
 * @property {NormalizedGroup[]} groups
 * @property {NormalizedLedger[]} ledgers
 * @property {NormalizedBalances} [balances]
 *
 * @typedef {Object} NormalizedPartyBalance
 * @property {string} name
 * @property {number} balance
 *
 * @typedef {Object} SourceMetadata
 * @property {string} [sourceId]
 * @property {string} [sourceName]
 * @property {string} [asOfDate]
 * @property {string} [generatedAt]
 *
 * @interface AccountingSourceAdapter
 */
/**
 * Normalize raw source chart of accounts (and optionally current balances) into the unified shape.
 * @name AccountingSourceAdapter#normalizeChartOfAccounts
 * @function
 * @param {Object} rawPayload - Source-specific payload (e.g. Tally Groups/Ledgers, Zoho COA).
 * @param {string} [companyId] - Company context for stable GUIDs if needed.
 * @returns {{ chartOfAccounts: NormalizedChartOfAccounts, asOfDate?: string }|null}
 */
/**
 * Normalize raw monthly balance snapshot into unified balance items by month.
 * May be merged into chartOfAccounts.balances by the adapter (e.g. Tally) or implemented separately.
 * @name AccountingSourceAdapter#normalizeMonthlyBalances
 * @function
 * @param {Object} rawPayload - Source-specific balance payload.
 * @param {string} [companyId]
 * @returns {{ current?: { monthKey: string, asOfDate?: string, items: BalanceItem[] }, closedMonths?: { monthKey: string, items: BalanceItem[] }[] }|null}
 */
/**
 * Normalize party (debtor/creditor) balances from source.
 * @name AccountingSourceAdapter#normalizePartyBalances
 * @function
 * @param {Object} rawPayload - Source-specific party/AR/AP payload.
 * @param {string} [companyId]
 * @returns {{ debtors?: NormalizedPartyBalance[], creditors?: NormalizedPartyBalance[] }|null}
 */
/**
 * Normalize aging (e.g. debtors/creditors by bucket: current, 30, 60, 90+).
 * @name AccountingSourceAdapter#normalizeAging
 * @function
 * @param {Object} rawPayload - Source-specific aging report payload.
 * @param {string} [companyId]
 * @returns {{ debtorsAging?: Array<{ name: string, current?: number, bucket30?: number, bucket60?: number, bucket90?: number }>, creditorsAging?: Array }|null}
 */
/**
 * Extract source metadata from raw payload (source id, name, as-of date).
 * @name AccountingSourceAdapter#getSourceMetadata
 * @function
 * @param {Object} rawPayload
 * @returns {SourceMetadata}
 */

module.exports = {};
