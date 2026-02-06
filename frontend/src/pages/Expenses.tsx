import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
  const [data, setData] = useState<ExpenseData | null>(null);
  const [period, setPeriod] = useState('6m');
  const [loading, setLoading] = useState(true);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [period, selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getExpenses(period);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Dashboard</h1>
          <p className="text-gray-600">Monitor and analyze your expenses</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input w-32"
        >
          <option value="1m">Last Month</option>
          <option value="3m">Last 3 Months</option>
          <option value="6m">Last 6 Months</option>
          <option value="12m">Last Year</option>
        </select>
      </div>

      {/* Summary */}
      <div className="card">
        <p className="text-sm text-gray-600">Total Expenses</p>
        <p className="text-3xl font-bold mt-2">{formatCurrency(data?.summary.totalExpenses || 0)}</p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Monthly Expense Trend</h2>
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
                />
                <Bar dataKey="amount" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Expenses by Category</h2>
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
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
