import { useState, useEffect } from 'react';
import { Filter, Wallet, TrendingUp, TrendingDown, Plug } from 'lucide-react';
import { integrationApi, transactionApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';

interface Transaction {
  id: string;
  date: string;
  type: 'OPENING_BALANCE' | 'REVENUE' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  source: string;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '' });
  const [integrations, setIntegrations] = useState<any[]>([]);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadTransactions();
    loadIntegrations();
  }, [filter, selectedCompanyId]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter.type) params.type = filter.type;

      const response = await transactionApi.getAll(params);
      setTransactions(response.data.data.transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadIntegrations = async () => {
    try {
      const response = await integrationApi.getAll();
      setIntegrations(response.data.data || []);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAmountColor = (type: string) => {
    if (type === 'REVENUE' || type === 'OPENING_BALANCE') {
      return 'text-green-600';
    }
    return 'text-red-600';
  };

  const getAmountPrefix = (type: string) => {
    if (type === 'REVENUE' || type === 'OPENING_BALANCE') {
      return '+';
    }
    return '-';
  };

  const revenueTotal = transactions
    .filter(t => t.type === 'REVENUE')
    .reduce((sum, t) => sum + t.amount, 0);
  const expenseTotal = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);
  const openingTotal = transactions
    .filter(t => t.type === 'OPENING_BALANCE')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentCashTotal = openingTotal + revenueTotal - expenseTotal;

  const getMonthKey = (dateStr: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const monthTotals = transactions.reduce(
    (acc, t) => {
      const key = getMonthKey(t.date);
      if (!key) return acc;
      if (!acc[key]) acc[key] = { revenue: 0, expense: 0 };
      const amount = Number(t.amount || 0);
      if (!Number.isFinite(amount)) return acc;
      if (t.type === 'REVENUE') acc[key].revenue += amount;
      if (t.type === 'EXPENSE') acc[key].expense += amount;
      return acc;
    },
    {} as Record<string, { revenue: number; expense: number }>
  );

  const sortedMonths = Object.keys(monthTotals).sort();
  const latestMonthKey = sortedMonths[sortedMonths.length - 1];
  const prevMonthKey = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;
  const latestRevenue = latestMonthKey ? monthTotals[latestMonthKey].revenue : 0;
  const latestExpense = latestMonthKey ? monthTotals[latestMonthKey].expense : 0;
  const prevRevenue = prevMonthKey ? monthTotals[prevMonthKey].revenue : 0;
  const prevExpense = prevMonthKey ? monthTotals[prevMonthKey].expense : 0;

  const revenueUp = latestRevenue >= prevRevenue;
  const expenseDown = latestExpense <= prevExpense;
  const revenueTrendClass = revenueUp ? 'from-white to-emerald-50' : 'from-white to-rose-50';
  const revenueIconClass = revenueUp ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600';
  const revenueBadgeClass = revenueUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';

  const expenseTrendClass = expenseDown ? 'from-white to-emerald-50' : 'from-white to-rose-50';
  const expenseIconClass = expenseDown ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600';
  const expenseBadgeClass = expenseDown ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
  const hasConnectedIntegrations = integrations.some((i) => i.status === 'CONNECTED');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600">Manage your financial transactions</p>
        </div>

        <div className="text-sm text-gray-500">
          Transactions sync automatically from your accounting software
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="card border-transparent bg-gradient-to-br from-white to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Cash / Bank Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(currentCashTotal)}</p>
            </div>
          </div>
        </div>
        <div className={`card border-transparent bg-gradient-to-br ${revenueTrendClass}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${revenueIconClass}`}>
              {revenueUp ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Month Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(latestRevenue)}</p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${revenueBadgeClass}`}>
            {revenueUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {revenueUp ? 'Up vs last month' : 'Down vs last month'}
          </div>
        </div>
        <div className={`card border-transparent bg-gradient-to-br ${expenseTrendClass}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${expenseIconClass}`}>
              {expenseDown ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Month Expenses</p>
              <p className="text-2xl font-bold">{formatCurrency(latestExpense)}</p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${expenseBadgeClass}`}>
            {expenseDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {expenseDown ? 'Down vs last month' : 'Up vs last month'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="border-none bg-transparent focus:ring-0"
          >
            <option value="">All Types</option>
            <option value="OPENING_BALANCE">Current Cash / Bank Balance</option>
            <option value="REVENUE">Revenue</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {!hasConnectedIntegrations && transactions.length === 0 ? (
        <div className="card text-center py-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <Plug className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Connect your accounting software</h2>
          <p className="text-gray-600 mb-6">
            Transactions will appear here as soon as you connect and sync your integration.
          </p>
          <Link to="/integrations" className="btn-primary inline-flex items-center gap-2">
            Connect Integrations
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
              </tr>
            </thead>

            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    No transactions found for this period.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {new Date(transaction.date).toLocaleDateString('en-IN')}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700">
                        {transaction.type.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4">{transaction.category}</td>
                    <td className="py-3 px-4">{transaction.description || '-'}</td>

                    <td className={`py-3 px-4 text-right font-medium ${getAmountColor(transaction.type)}`}>
                      {getAmountPrefix(transaction.type)}
                      {formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
