import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent } from '../components/ui/Card';

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
  const navigate = useNavigate();
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Revenue</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Revenue breakdown and category trend. For monthly totals and P&L see Review.</p>
        </div>
        <button type="button" onClick={() => navigate('/pl-pack')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          See full monthly performance →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="subtle" className={growthRate >= 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              {growthRate >= 0 ? <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <TrendingDown className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Growth Rate</p>
              <p className={`text-2xl font-semibold ${growthRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {(data?.summary.growthRate || 0) >= 0 ? '+' : ''}{data?.summary.growthRate.toFixed(1)}%
              </p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${growthRate >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                {growthLabel}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <Target className="w-5 h-5 text-slate-600 dark:text-slate-300" />
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue breakdown — Trailing 3 Closed Months</h2>
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
          </CardContent>
        </Card>

        <Card variant="default">
          <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Revenue by Category (3 Closed Months)</h2>
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
    </div>
  );
}
