/**
 * Monthly Financial Intelligence Report (Phase 1.8).
 * Builds structured report from existing services; no new financial logic.
 */

const fs = require('fs');
const path = require('path');
const { Company } = require('../models');
const plPackService = require('./plPackService');
const runwayService = require('./runwayService');
const debtorCreditorService = require('./debtorCreditorService');
const alertsService = require('./alertsService');

const fmt = (v) => (v != null && Number.isFinite(v) ? v : '—');

/**
 * Build structured monthly report JSON for company and month.
 * @param {string} companyId
 * @param {string} monthKey - YYYY-MM
 * @returns {Promise<{
 *   company: object,
 *   month: string,
 *   generatedAt: string,
 *   executiveSummary: array,
 *   performance: { current, previous, variances, ytd: object },
 *   drivers: object,
 *   workingCapital: object,
 *   liquidity: object,
 *   runway: object,
 *   alerts: array,
 *   aiNarrative?: string
 * }>}
 */
async function buildMonthlyReport(companyId, monthKey) {
  const [company, pack, runway, debtorsSummary, alerts, remarks] = await Promise.all([
    Company.findByPk(companyId, { attributes: ['id', 'name', 'industry', 'currency'], raw: true }),
    plPackService.getPlPackWithDrivers(companyId, monthKey).catch(() => null),
    runwayService.getRunway(companyId).catch(() => null),
    debtorCreditorService.getDebtorsSummary(companyId).catch(() => null),
    alertsService.getAlerts(companyId).catch(() => []),
    plPackService.getRemarks(companyId, monthKey).catch(() => ({ aiDraftText: null }))
  ]);

  const performance = pack
    ? {
        current: pack.current,
        previous: pack.previous,
        variances: pack.variances,
        ytd: {
          ...pack.ytd,
          ytdLastFy: pack.ytdLastFy,
          ytdVarianceAmount: pack.ytdVarianceAmount,
          ytdVariancePct: pack.ytdVariancePct
        }
      }
    : { current: null, previous: null, variances: null, ytd: null };

  const workingCapital = pack?.workingCapital
    ? {
        inventoryTotal: pack.workingCapital.inventoryTotal,
        inventoryDelta: pack.workingCapital.inventoryDelta,
        inventoryDays: fmt(pack.workingCapital.inventoryDays),
        cashConversionCycle: fmt(pack.workingCapital.cashConversionCycle),
        cashGapExInventory: pack.workingCapital.cashGapExInventory != null && Number.isFinite(pack.workingCapital.cashGapExInventory)
          ? pack.workingCapital.cashGapExInventory
          : '—'
      }
    : null;

  const liquidity = runway
    ? {
        currentCashBankClosing: runway.currentCashBankClosing ?? runway.cashBase,
        runwayMonths: runway.runwayMonths,
        status: runway.status,
        statusLabel: runway.statusLabel
      }
    : null;

  const runwaySection = runway
    ? {
        runwayMonths: runway.runwayMonths,
        status: runway.status,
        statusLabel: runway.statusLabel,
        avgNetCashChange6M: runway.avgNetCashChange6M
      }
    : null;

  return {
    company: company || { id: companyId, name: 'Unknown', industry: null, currency: 'INR' },
    month: monthKey,
    generatedAt: new Date().toISOString(),
    executiveSummary: pack?.executiveSummary ?? [],
    performance: performance,
    drivers: pack?.drivers ?? null,
    workingCapital,
    liquidity,
    runway: runwaySection,
    alerts: Array.isArray(alerts) ? alerts : [],
    ...(remarks?.aiDraftText ? { aiNarrative: remarks.aiDraftText } : {})
  };
}

/** Escape JSON for safe embedding inside HTML script (avoid </script> and XSS). */
function escapeJsonForHtml(jsonString) {
  return jsonString
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/</g, '\\u003c');
}

/**
 * Generate PDF buffer from report using Puppeteer.
 * @param {object} report - buildMonthlyReport() result
 * @returns {Promise<Buffer>}
 */
async function renderMonthlyReportPdf(report) {
  const puppeteer = require('puppeteer');
  const templatePath = path.join(__dirname, '../../templates/monthlyReport.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  const json = escapeJsonForHtml(JSON.stringify(report));
  html = html.replace('__REPORT_JSON__', json);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16px', right: '16px', bottom: '16px', left: '16px' }
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

module.exports = {
  buildMonthlyReport,
  renderMonthlyReportPdf
};
