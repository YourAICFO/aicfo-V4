const { sequelize } = require('../config/database');
const { User } = require('./User');
const { Company } = require('./Company');
const { Subscription } = require('./Subscription');
const { FinancialTransaction } = require('./FinancialTransaction');
const { CashBalance } = require('./CashBalance');
const { Integration } = require('./Integration');
const { AIInsight } = require('./AIInsight');
const { FinancialReport } = require('./FinancialReport');
const { Notification } = require('./Notification');
const { AccountingMonth } = require('./AccountingMonth');
const { MonthlyTrialBalanceSummary } = require('./MonthlyTrialBalanceSummary');
const { MonthlyRevenueBreakdown } = require('./MonthlyRevenueBreakdown');
const { MonthlyExpenseBreakdown } = require('./MonthlyExpenseBreakdown');
const { MonthlyDebtorsSnapshot } = require('./MonthlyDebtorsSnapshot');
const { MonthlyCreditorsSnapshot } = require('./MonthlyCreditorsSnapshot');
const { AccountingTermMapping } = require('./AccountingTermMapping');
const { MonthlyDebtor } = require('./MonthlyDebtor');
const { MonthlyCreditor } = require('./MonthlyCreditor');
const { AdminUsageEvent } = require('./AdminUsageEvent');
const { AdminAIQuestion } = require('./AdminAIQuestion');
const { CurrentCashBalance } = require('./CurrentCashBalance');
const { CurrentDebtor } = require('./CurrentDebtor');
const { CurrentCreditor } = require('./CurrentCreditor');
const { CurrentLoan } = require('./CurrentLoan');
const { CurrentLiquidityMetric } = require('./CurrentLiquidityMetric');
const { CFOAlert } = require('./CFOAlert');
const { CFOMetric } = require('./CFOMetric');
const { CFOQuestion } = require('./CFOQuestion');
const { CFOQuestionMetric } = require('./CFOQuestionMetric');
const { CFOQuestionRule } = require('./CFOQuestionRule');
const { CFOQuestionResult } = require('./CFOQuestionResult');
const { PartyBalanceLatest } = require('./PartyBalanceLatest');
const { AccountHeadDictionary } = require('./AccountHeadDictionary');
const { SourceLedger } = require('./SourceLedger');
const { SourceMappingRule } = require('./SourceMappingRule');
const { CFOLedgerClassification } = require('./CFOLedgerClassification');
const { LedgerMonthlyBalance } = require('./LedgerMonthlyBalance');
const { AppLog } = require('./AppLog');
const { AuditLog } = require('./AuditLog');
const { ConnectorClient } = require('./ConnectorClient');
const { IntegrationSyncRun } = require('./IntegrationSyncRun');
const { IntegrationSyncEvent } = require('./IntegrationSyncEvent');
const { IngestionLog } = require('./IngestionLog');

// User - Company (One-to-Many)
User.hasMany(Company, { foreignKey: 'owner_id', as: 'companies' });
Company.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// Company - Subscription (One-to-One)
Company.hasOne(Subscription, { foreignKey: 'company_id', as: 'subscription' });
Subscription.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - FinancialTransaction (One-to-Many)
Company.hasMany(FinancialTransaction, { foreignKey: 'company_id', as: 'transactions' });
FinancialTransaction.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - CashBalance (One-to-Many)
Company.hasMany(CashBalance, { foreignKey: 'company_id', as: 'cashBalances' });
CashBalance.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - Integration (One-to-Many)
Company.hasMany(Integration, { foreignKey: 'company_id', as: 'integrations' });
Integration.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - AIInsight (One-to-Many)
Company.hasMany(AIInsight, { foreignKey: 'company_id', as: 'insights' });
AIInsight.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - FinancialReport (One-to-Many)
Company.hasMany(FinancialReport, { foreignKey: 'company_id', as: 'reports' });
FinancialReport.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - Notification (One-to-Many)
Company.hasMany(Notification, { foreignKey: 'company_id', as: 'notifications' });
Notification.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - AccountingMonth (One-to-Many)
Company.hasMany(AccountingMonth, { foreignKey: 'company_id', as: 'accountingMonths' });
AccountingMonth.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - MonthlyTrialBalanceSummary (One-to-Many)
Company.hasMany(MonthlyTrialBalanceSummary, { foreignKey: 'company_id', as: 'monthlySummaries' });
MonthlyTrialBalanceSummary.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - MonthlyRevenueBreakdown (One-to-Many)
Company.hasMany(MonthlyRevenueBreakdown, { foreignKey: 'company_id', as: 'monthlyRevenue' });
MonthlyRevenueBreakdown.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - MonthlyExpenseBreakdown (One-to-Many)
Company.hasMany(MonthlyExpenseBreakdown, { foreignKey: 'company_id', as: 'monthlyExpenses' });
MonthlyExpenseBreakdown.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - MonthlyDebtorsSnapshot (One-to-Many)
Company.hasMany(MonthlyDebtorsSnapshot, { foreignKey: 'company_id', as: 'monthlyDebtors' });
MonthlyDebtorsSnapshot.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Company - MonthlyCreditorsSnapshot (One-to-Many)
Company.hasMany(MonthlyCreditorsSnapshot, { foreignKey: 'company_id', as: 'monthlyCreditors' });
MonthlyCreditorsSnapshot.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(MonthlyDebtor, { foreignKey: 'company_id', as: 'monthlyDebtorsPhase2' });
MonthlyDebtor.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(MonthlyCreditor, { foreignKey: 'company_id', as: 'monthlyCreditorsPhase2' });
MonthlyCreditor.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(CurrentCashBalance, { foreignKey: 'company_id', as: 'currentCash' });
CurrentCashBalance.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(CurrentDebtor, { foreignKey: 'company_id', as: 'currentDebtors' });
CurrentDebtor.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(CurrentCreditor, { foreignKey: 'company_id', as: 'currentCreditors' });
CurrentCreditor.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(CurrentLoan, { foreignKey: 'company_id', as: 'currentLoans' });
CurrentLoan.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasOne(CurrentLiquidityMetric, { foreignKey: 'company_id', as: 'currentLiquidity' });
CurrentLiquidityMetric.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(CFOAlert, { foreignKey: 'company_id', as: 'alerts' });
CFOAlert.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Company.hasMany(CFOMetric, { foreignKey: 'company_id', as: 'cfoMetrics' });
CFOMetric.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Company.hasMany(PartyBalanceLatest, { foreignKey: 'company_id', as: 'partyBalancesLatest' });
PartyBalanceLatest.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// CFO Question Engine
CFOQuestion.hasMany(CFOQuestionMetric, { foreignKey: 'question_id', as: 'metrics' });
CFOQuestion.hasMany(CFOQuestionRule, { foreignKey: 'question_id', as: 'rules' });
CFOQuestion.hasMany(CFOQuestionResult, { foreignKey: 'question_id', as: 'results' });
CFOQuestionMetric.belongsTo(CFOQuestion, { foreignKey: 'question_id', as: 'question' });
CFOQuestionRule.belongsTo(CFOQuestion, { foreignKey: 'question_id', as: 'question' });
CFOQuestionResult.belongsTo(CFOQuestion, { foreignKey: 'question_id', as: 'question' });
Company.hasMany(CFOQuestionResult, { foreignKey: 'company_id', as: 'cfoQuestionResults' });

// Connector sync relationships
Company.hasMany(ConnectorClient, { foreignKey: 'company_id', as: 'connectorClients' });
ConnectorClient.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Company.hasMany(IntegrationSyncRun, { foreignKey: 'company_id', as: 'syncRuns' });
IntegrationSyncRun.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

ConnectorClient.hasMany(IntegrationSyncRun, { foreignKey: 'connector_client_id', as: 'syncRuns' });
IntegrationSyncRun.belongsTo(ConnectorClient, { foreignKey: 'connector_client_id', as: 'connectorClient' });

IntegrationSyncRun.hasMany(IntegrationSyncEvent, { foreignKey: 'run_id', as: 'events' });
IntegrationSyncEvent.belongsTo(IntegrationSyncRun, { foreignKey: 'run_id', as: 'syncRun' });

Company.hasMany(IngestionLog, { foreignKey: 'company_id', as: 'ingestionLogs' });
IngestionLog.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

module.exports = {
  sequelize,
  User,
  Company,
  Subscription,
  FinancialTransaction,
  CashBalance,
  Integration,
  AIInsight,
  FinancialReport,
  Notification,
  AccountingMonth,
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  MonthlyDebtorsSnapshot,
  MonthlyCreditorsSnapshot,
  AccountingTermMapping,
  MonthlyDebtor,
  MonthlyCreditor,
  AdminUsageEvent,
  AdminAIQuestion,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLoan,
  CurrentLiquidityMetric,
  CFOAlert,
  CFOMetric,
  AccountHeadDictionary,
  SourceLedger,
  SourceMappingRule,
  CFOLedgerClassification,
  LedgerMonthlyBalance,
  AppLog,
  AuditLog,
  CFOQuestion,
  CFOQuestionMetric,
  CFOQuestionRule,
  CFOQuestionResult,
  PartyBalanceLatest,
  ConnectorClient,
  IntegrationSyncRun,
  IntegrationSyncEvent,
  IngestionLog
};
