import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, BadgeDollarSign, Target } from 'lucide-react';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface RevenueData {
  summary: {
    totalRevenue: number;
    growthRate: number;
    period: string;
  };
  monthlyTrend: Array<{ month: string; amount: number }>;
  byCategory: Array<{ category: string; amount: number }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Revenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getRevenue('3m');
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to load revenue data:', error);
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
  const growthRate = data?.summary.growthRate || 0;
  const growthLabel = growthRate >= 0 ? `Up ${growthRate.toFixed(1)}%` : `Down ${Math.abs(growthRate).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Dashboard</h1>
          <p className="text-gray-600">Track your revenue trends and sources</p>
        </div>
        <div className="text-sm text-gray-500">Latest closed month</div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card border-transparent bg-gradient-to-br from-white to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100">
              <BadgeDollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Closed Month Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(data?.summary.totalRevenue || 0)}</p>
            </div>
          </div>
        </div>
        <div className={`card border-transparent bg-gradient-to-br ${growthRate >= 0 ? 'from-white to-emerald-50' : 'from-white to-rose-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${growthRate >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              {growthRate >= 0 ? (
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-rose-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Growth Rate</p>
              <p className={`text-2xl font-bold ${(data?.summary.growthRate || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(data?.summary.growthRate || 0) >= 0 ? '+' : ''}{data?.summary.growthRate.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${growthRate >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {growthRate >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {growthLabel}
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-slate-100">
              <Target className="w-6 h-6 text-slate-600" />
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
          <h2 className="text-lg font-semibold mb-4">Trailing 3 Closed Months</h2>
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
                <Bar dataKey="amount" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Revenue by Category (3 Closed Months)</h2>
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
    </div>
  );
}
