import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface ExpenseData {
  summary: {
    totalExpenses: number;
    period: string;
  };
  monthlyTrend: Array<{ month: string; amount: number }>;
  byCategory: Array<{ category: string; amount: number }>;
  topExpenses: Array<{
    category: string;
    description: string;
    amount: number;
    date: string;
  }>;
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

export default function Expenses() {
  const navigate = useNavigate();
  const [data, setData] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getExpenses('3m');
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to load expense data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr);
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const topCategory = (data?.byCategory || [])[0];
  const avgMonthly = data?.monthlyTrend?.length
    ? data.monthlyTrend.reduce((sum, item) => sum + item.amount, 0) / data.monthlyTrend.length
    : 0;
  const latest = data?.monthlyTrend?.length ? data.monthlyTrend[data.monthlyTrend.length - 1] : null;
  const previous = data?.monthlyTrend?.length && data.monthlyTrend.length > 1
    ? data.monthlyTrend[data.monthlyTrend.length - 2]
    : null;
  const expenseDelta = latest && previous ? latest.amount - previous.amount : 0;
  const expenseTrend = previous
    ? expenseDelta >= 0
      ? `Up ${((expenseDelta / previous.amount) * 100).toFixed(1)}%`
      : `Down ${Math.abs((expenseDelta / previous.amount) * 100).toFixed(1)}%`
    : 'No trend';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600">Expense breakdown and category trend. For monthly totals and P&L see Review.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/pl-pack')}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          See full monthly performance →
        </button>
      </div>

      {/* Summary: avg spend + top category only (no month total hero — owned by P&L Pack) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card border-transparent bg-gradient-to-br from-white to-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-100">
              <TrendingDown className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Monthly Spend</p>
              <p className="text-2xl font-bold">{formatCurrency(avgMonthly)}</p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${expenseDelta >= 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {expenseTrend}
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-slate-100">
              <AlertTriangle className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Top Category</p>
              <p className="text-lg font-semibold">{topCategory?.category || '—'}</p>
              <p className="text-sm text-gray-500">{formatCurrency(topCategory?.amount || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Expense breakdown — Trailing 3 Closed Months</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => formatMonth(label)}
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                  }}
                  labelStyle={{ color: '#cbd5f5' }}
                />
                <Bar dataKey="amount" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Expenses by Category (3 Closed Months)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.byCategory || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                  nameKey="category"
                >
                  {(data?.byCategory || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                  }}
                  labelStyle={{ color: '#cbd5f5' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Expenses */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Top Expenses</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Description</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data?.topExpenses.map((expense, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm">{expense.category}</span>
                  </td>
                  <td className="py-3 px-4">{expense.description}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(expense.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
