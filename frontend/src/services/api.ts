import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useUpgradeModalStore } from '../store/upgradeModalStore';
import { getApiBaseUrl } from '../lib/env';

const API_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  const companyId = useAuthStore.getState().selectedCompanyId;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (companyId) {
    config.headers['X-Company-Id'] = companyId;
  }
  
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    if (error.response?.status === 403) {
      const data = error.response?.data as { code?: string; error?: string } | undefined;
      const isPlanError =
        data?.code === 'PLAN_LIMIT_COMPANIES' ||
        data?.code === 'USAGE_LIMIT' ||
        (typeof data?.error === 'string' && /upgrade/i.test(data.error));
      if (isPlanError) {
        useUpgradeModalStore.getState().openModal(data?.error || 'Upgrade to continue.');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: Partial<{ firstName: string; lastName: string; phone: string }>) =>
    api.put('/auth/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Company API
export const companyApi = {
  getAll: (includeDeleted?: boolean) => api.get('/companies', { params: { includeDeleted } }),
  getById: (id: string) => api.get(`/companies/${id}`),
  create: (data: { name: string; industry?: string; currency?: string }) =>
    api.post('/companies', data),
  createDemo: () => api.post<{ success: boolean; data: { id: string; name: string } }>('/companies/demo'),
  update: (id: string, data: Partial<{ name: string; industry: string }>) =>
    api.put(`/companies/${id}`, data),
  delete: (id: string) => api.delete(`/companies/${id}`),
};

// Dashboard API
export const dashboardApi = {
  getOverview: () => api.get('/dashboard/overview'),
  getRevenue: (period?: string) => api.get('/dashboard/revenue', { params: { period } }),
  getExpenses: (period?: string) => api.get('/dashboard/expenses', { params: { period } }),
  getCashflow: (period?: string) => api.get('/dashboard/cashflow', { params: { period } }),
};

// Sync Status API
export const syncApi = {
  getStatus: () => api.get('/sync/status'),
  getValidation: (month: string) => api.get('/sync/validation', { params: { month } }),
};

// Transaction API
export const transactionApi = {
  getAll: (params?: { type?: string; limit?: number; offset?: number }) =>
    api.get('/transactions', { params }),
  getCategories: () => api.get('/transactions/categories/list'),
};

// Cash Balance API
export const cashBalanceApi = {
  getAll: () => api.get('/cash-balance'),
  getLatest: () => api.get('/cash-balance/latest'),
};

// AI API
export const aiApi = {
  getInsights: () => api.get('/ai/insights'),
  markRead: (id: string) => api.post(`/ai/insights/${id}/read`),
  dismiss: (id: string) => api.post(`/ai/insights/${id}/dismiss`),
  listThreads: () => api.get('/ai/threads'),
  createThread: (title?: string) => api.post('/ai/threads', title ? { title } : {}),
  getThread: (threadId: string) => api.get(`/ai/threads/${threadId}`),
  chat: (message: string, threadId?: string) => api.post('/ai/chat', threadId ? { message, threadId } : { message }),
};

// Integration API
export const integrationApi = {
  getAll: () => api.get('/integrations'),
  connectTally: (data: { serverUrl: string; companyName: string }) =>
    api.post('/integrations/tally', data),
  connectZoho: (data: { organizationId: string; accessToken: string }) =>
    api.post('/integrations/zoho', data),
  connectQuickBooks: (data: { realmId: string; accessToken: string }) =>
    api.post('/integrations/quickbooks', data),
  disconnect: (id: string) => api.post(`/integrations/${id}/disconnect`),
  sync: (id: string) => api.post(`/integrations/${id}/sync`),
};

// Subscription API
export const subscriptionApi = {
  getStatus: () => api.get('/subscription/status'),
};

export const billingApi = {
  getStatus: () => api.get('/billing/status'),
  subscribe: (planCode: string) => api.post('/billing/subscribe', { planCode }),
  getInvoices: () => api.get('/billing/invoices'),
  getInvoice: (id: string) => api.get(`/billing/invoices/${id}`),
};

export const settingsApi = {
  getNotificationSettings: () => api.get('/settings/notifications'),
  updateNotificationSettings: (payload: {
    enabled_weekly: boolean;
    weekly_day_of_week: number | null;
    weekly_time_hhmm: string;
    enabled_monthly: boolean;
    monthly_day_of_month: number | null;
    monthly_time_hhmm: string;
    timezone: string;
  }) => api.post('/settings/notifications', payload),
};

// Finance API
export const financeApi = {
  getDebtorsSummary: () => api.get('/finance/debtors/summary'),
  getDebtorsTop: () => api.get('/finance/debtors/top'),
  getDebtorsTrends: () => api.get('/finance/debtors/trends'),
  getCreditorsSummary: () => api.get('/finance/creditors/summary'),
  getCreditorsTop: () => api.get('/finance/creditors/top'),
  getCreditorsTrends: () => api.get('/finance/creditors/trends'),
  getWorkingCapital: () => api.get('/finance/working-capital'),
  getPlMonths: () => api.get<{ success: boolean; data: { months: string[]; latest: string | null } }>('/finance/pl-months'),
  getPlPack: (month: string) => api.get('/finance/pl-pack', { params: { month } }),
  getPlRemarks: (month: string) => api.get('/finance/pl-remarks', { params: { month } }),
  savePlRemarks: (month: string, text: string) => api.post('/finance/pl-remarks', { month, text }),
  generatePlAiExplanation: (month: string, forceRegenerate?: boolean) =>
    api.post('/finance/pl-ai-explanation', { month, forceRegenerate: !!forceRegenerate }),
  getMonthlyReportPdf: (month: string) =>
    api.get('/finance/monthly-report', { params: { month }, responseType: 'blob' }),
  getDataHealth: () =>
    api.get<{
      success: boolean;
      data: DataHealthResponse;
    }>('/finance/data-health'),
  getAlerts: () => api.get<{ success: boolean; data: FinanceAlert[] }>('/finance/alerts'),
  snoozeAlert: (ruleKey: string, days: 7 | 30) =>
    api.post<{ success: boolean; data: FinanceAlert[] }>('/finance/alerts/snooze', { ruleKey, days }),
  dismissAlert: (ruleKey: string) =>
    api.post<{ success: boolean; data: FinanceAlert[] }>('/finance/alerts/dismiss', { ruleKey }),
  clearAlert: (ruleKey: string) =>
    api.post<{ success: boolean; data: FinanceAlert[] }>('/finance/alerts/clear', { ruleKey }),
};

export interface FinanceAlert {
  id: string;
  ruleKey: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  message: string;
  link: string;
  isSnoozed?: boolean;
  snoozedUntil?: string | null;
  isDismissed?: boolean;
}

export interface DataHealthImpactMessage {
  key: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  owner: 'user' | 'system';
  link?: string;
}

export interface DataHealthResponse {
  classifiedPct: number;
  totalLedgers: number;
  classifiedLedgers: number;
  unclassifiedLedgers: number;
  topUnclassifiedLedgers: { name: string; balance: number | null; lastMonth: string | null; count: number | null }[];
  cogsMappingStatus: { isAvailable: boolean; reason: string | null };
  inventoryMappingStatus: {
    inventoryTotal: number;
    inventoryLedgersCount: number;
    warning: string | null;
  };
  debtorsMappingStatus: { total: number; agingAvailable: boolean };
  creditorsMappingStatus: { total: number; agingAvailable: boolean };
  lastSync: {
    last_sync_at: string | null;
    last_sync_status: string | null;
    last_sync_error: string | null;
  };
  availableMonthsCount: number;
  latestMonth: string | null;
  dataReadyForInsights: boolean;
  impactMessages?: DataHealthImpactMessage[];
  suggestedNextSteps?: string[];
}

// Debtors/Creditors (ledger-based)
export const debtorsApi = {
  getSummary: () => api.get('/debtors/summary'),
};

export const creditorsApi = {
  getSummary: () => api.get('/creditors/summary'),
};

// Admin API
export const adminApi = {
  getMetricsSummary: () => api.get('/admin/metrics/summary'),
  getUsageSummary: () => api.get('/admin/usage/summary'),
  getAIQuestions: () => api.get('/admin/ai/questions'),
  getCompaniesActivity: () => api.get('/admin/companies/activity'),
  getSystemMetrics: () => api.get('/admin/metrics/system'),
  getBusinessMetrics: () => api.get('/admin/metrics/business'),
  getUsageMetrics: () => api.get('/admin/metrics/usage'),
  getAIMetrics: (days = 30) => api.get('/admin/metrics/ai', { params: { days } }),
  getConnectorMetrics: (days = 30) => api.get('/admin/metrics/connector', { params: { days } }),
  getAccountingMetrics: () => api.get('/admin/metrics/accounting'),
  getRiskMetrics: () => api.get('/admin/metrics/risk'),
};

// Connector API
export const connectorApi = {
  getStatus: (companyId: string) => api.get('/connector/status', { params: { companyId } }),
  getStatusV1: (companyId: string) =>
    api.get<{
      success: boolean;
      data: ConnectorStatusV1Data;
    }>('/connector/status/v1', {
      params: { companyId },
      headers: {
        'X-Company-Id': companyId,
      },
    }),
  unlink: (companyId: string, linkId: string) =>
    api.post<{ success: boolean; data: { id: string; isActive: false } }>('/connector/unlink', {
      companyId,
      linkId,
    }),
};

export interface ConnectorLinkV1 {
  id: string;
  linkId: string;
  companyId: string;
  tallyCompanyId: string;
  tallyCompanyName: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

export interface ConnectorStatusV1Data {
  companyId: string;
  snapshotLatestMonthKey?: string | null;
  snapshotLedgersCount?: number | null;
  ledgerBalancesStoredCount?: number | null;
  links: ConnectorLinkV1[];
  connector: {
    deviceId: string | null;
    deviceName: string | null;
    authMode: 'device_token' | 'legacy_connector_token' | null;
    lastSeenAt: string | null;
    isOnline: boolean;
    onlineThresholdSeconds: number;
  };
  sync: {
    lastRunId: string | null;
    lastRunStatus: string | null;
    lastRunStartedAt: string | null;
    lastRunCompletedAt: string | null;
    lastEventAt: string | null;
    lastError: string | null;
  };
  dataReadiness: {
    status: string;
    lastValidatedAt: string | null;
    latestMonthKey: string | null;
  };
}
