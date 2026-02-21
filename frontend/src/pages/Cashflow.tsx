import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface CashflowData {
  cashflow: {
    months: Array<{
      month: string;
      opening: number;
      closing: number;
      netChange: number;
      inflow: number;
      outflow: number;
    }>;
    avgCashInflow: number | null;
    avgCashOutflow: number | null;
    netCashFlow: number | null;
  };
  monthlyCashflow: Array<{
    month: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
  cashHistory: Array<{
    date: string;
    amount: number;
  }>;
}

export default function Cashflow() {
  const [data, setData] = useState<CashflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getCashflow('6m');
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to load cashflow data:', error);
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

  const months = data?.monthlyCashflow || [];
  const cashflow = data?.cashflow;
  const avgCashInflow = cashflow?.avgCashInflow ?? null;
  const avgCashOutflow = cashflow?.avgCashOutflow ?? null;
  const netCashFlow = cashflow?.netCashFlow ?? null;
  const netPositive = netCashFlow != null && netCashFlow >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cashflow Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Based on Cash & Bank movement (last 6 months)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`card border-transparent bg-gradient-to-br ${netPositive ? 'from-white to-emerald-50 dark:from-gray-800 dark:to-emerald-900/20' : 'from-white to-rose-50 dark:from-gray-800 dark:to-rose-900/20'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${netPositive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
              <Wallet className={`w-6 h-6 ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Net cash flow</p>
              <p className={`text-2xl font-bold ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(netCashFlow)}
              </p>
            </div>
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-emerald-50 dark:from-gray-800 dark:to-emerald-900/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg cash inflow</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(avgCashInflow)}
              </p>
            </div>
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-rose-50 dark:from-gray-800 dark:to-rose-900/20">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-rose-100 dark:bg-rose-900/30">
              <TrendingDown className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg cash outflow</p>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                {formatCurrency(avgCashOutflow)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Cashflow */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Monthly Cashflow (Cash & Bank movement)</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyCashflow || []}>
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
              <Legend />
              <Bar dataKey="inflow" name="Inflow" fill="#10b981" />
              <Bar dataKey="outflow" name="Outflow" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net Cashflow */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Net Cashflow (Cash & Bank movement)</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.monthlyCashflow || []}>
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
              <Area
                type="monotone"
                dataKey="net"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Balance History */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Cash Balance History</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.cashHistory || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN')}
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                }}
                labelStyle={{ color: '#cbd5f5' }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
