import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface CashflowData {
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
      const response = await dashboardApi.getCashflow(period);
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to load cashflow data:', error);
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

  const months = data?.monthlyCashflow || [];
  const lastMonth = months.length ? months[months.length - 1] : null;
  const prevMonth = months.length > 1 ? months[months.length - 2] : null;
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonth = months.find((m) => (m.month || '').startsWith(currentMonthKey)) || lastMonth;

  const avgNetCashflow = (currentMonth?.inflow || 0) - (currentMonth?.outflow || 0);
  const prevAvgNetCashflow = prevMonth ? (prevMonth.inflow - prevMonth.outflow) : 0;
  const netDelta = avgNetCashflow - prevAvgNetCashflow;
  const netTrend = prevMonth
    ? netDelta >= 0
      ? `Up ${((netDelta / Math.abs(prevAvgNetCashflow || 1)) * 100).toFixed(1)}%`
      : `Down ${Math.abs((netDelta / Math.abs(prevAvgNetCashflow || 1)) * 100).toFixed(1)}%`
    : 'No trend';
  const netPositive = avgNetCashflow >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashflow Dashboard</h1>
          <p className="text-gray-600">Track your cash inflows and outflows</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`card border-transparent bg-gradient-to-br ${netPositive ? 'from-white to-emerald-50' : 'from-white to-rose-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${netPositive ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              <Wallet className={`w-6 h-6 ${netPositive ? 'text-emerald-600' : 'text-rose-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Net Cashflow</p>
              <p className={`text-2xl font-bold ${netPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(avgNetCashflow)}
              </p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${netDelta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {netDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {netTrend}
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Inflow</p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatCurrency(currentMonth?.inflow || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-rose-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Latest Outflow</p>
              <p className="text-2xl font-bold text-rose-700">
                {formatCurrency(currentMonth?.outflow || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Cashflow */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Monthly Cashflow</h2>
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
        <h2 className="text-lg font-semibold mb-4">Net Cashflow</h2>
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
