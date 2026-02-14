import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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
};

// Company API
export const companyApi = {
  getAll: () => api.get('/companies'),
  getById: (id: string) => api.get(`/companies/${id}`),
  create: (data: { name: string; industry?: string; currency?: string }) =>
    api.post('/companies', data),
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
  chat: (message: string) => api.post('/ai/chat', { message }),
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

// Finance API
export const financeApi = {
  getDebtorsSummary: () => api.get('/finance/debtors/summary'),
  getDebtorsTop: () => api.get('/finance/debtors/top'),
  getDebtorsTrends: () => api.get('/finance/debtors/trends'),
  getCreditorsSummary: () => api.get('/finance/creditors/summary'),
  getCreditorsTop: () => api.get('/finance/creditors/top'),
  getCreditorsTrends: () => api.get('/finance/creditors/trends'),
};

// Debtors/Creditors (ledger-based)
export const debtorsApi = {
  getSummary: () => api.get('/debtors/summary'),
};

export const creditorsApi = {
  getSummary: () => api.get('/creditors/summary'),
};

// Admin API
export const adminApi = {
  getUsageSummary: () => api.get('/admin/usage/summary'),
  getAIQuestions: () => api.get('/admin/ai/questions'),
  getCompaniesActivity: () => api.get('/admin/companies/activity'),
  getSystemMetrics: () => api.get('/admin/metrics/system'),
  getBusinessMetrics: () => api.get('/admin/metrics/business'),
  getUsageMetrics: () => api.get('/admin/metrics/usage'),
  getAIMetrics: () => api.get('/admin/metrics/ai'),
  getAccountingMetrics: () => api.get('/admin/metrics/accounting'),
  getRiskMetrics: () => api.get('/admin/metrics/risk'),
};

// Download API
export const downloadApi = {
  getInfo: () => api.get('/download/info'),
  getCheck: () => api.get('/download/check'),
};
