import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent } from '../components/ui/Card';

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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Expense breakdown and category trend. For monthly totals and P&L see Review.</p>
        </div>
        <button type="button" onClick={() => navigate('/pl-pack')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          See full monthly performance →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="subtle" className={expenseDelta <= 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <TrendingDown className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Monthly Spend</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(avgMonthly)}</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${expenseDelta <= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                {expenseTrend}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <AlertTriangle className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Top Category</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{topCategory?.category || '—'}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(topCategory?.amount || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="default">
          <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Expense breakdown — Trailing 3 Closed Months</h2>
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
          </CardContent>
        </Card>

        <Card variant="default">
          <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Expenses by Category (3 Closed Months)</h2>
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
          </CardContent>
        </Card>
      </div>

      <Card variant="default">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Expenses</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Description</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data?.topExpenses.map((expense, index) => (
                  <tr key={index} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-sm text-gray-900 dark:text-gray-100">{expense.category}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{expense.description}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(expense.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
