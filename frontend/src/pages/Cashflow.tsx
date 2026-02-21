import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../lib/format';
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
  const [loading, setLoading] = useState(true);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getCashflow('3m');
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
  const lastMonth = months.length ? months[months.length - 1] : null;
  const prevMonth = months.length > 1 ? months[months.length - 2] : null;

  const latestInflow = Number(lastMonth?.inflow || 0);
  const latestOutflow = Number(lastMonth?.outflow || 0);
  const prevInflow = Number(prevMonth?.inflow || 0);
  const prevOutflow = Number(prevMonth?.outflow || 0);

  const totalInflow = months.reduce((sum, m) => sum + Number(m.inflow || 0), 0);
  const totalOutflow = months.reduce((sum, m) => sum + Number(m.outflow || 0), 0);
  const avgInflow = months.length ? totalInflow / months.length : 0;
  const avgOutflow = months.length ? totalOutflow / months.length : 0;
  const avgNetCashflow = avgInflow - avgOutflow;
  const prevAvgNetCashflow = prevInflow - prevOutflow;
  const netDelta = avgNetCashflow - prevAvgNetCashflow;
  const netTrend = prevMonth
    ? netDelta >= 0
      ? `Up ${((netDelta / Math.abs(prevAvgNetCashflow || 1)) * 100).toFixed(1)}%`
      : `Down ${Math.abs((netDelta / Math.abs(prevAvgNetCashflow || 1)) * 100).toFixed(1)}%`
    : 'No trend';
  const netPositive = avgNetCashflow >= 0;

  const inflowDelta = latestInflow - prevInflow;
  const inflowTrend = prevMonth
    ? inflowDelta >= 0
      ? `Up ${((inflowDelta / Math.abs(prevInflow || 1)) * 100).toFixed(1)}%`
      : `Down ${Math.abs((inflowDelta / Math.abs(prevInflow || 1)) * 100).toFixed(1)}%`
    : 'No trend';
  const inflowUp = inflowDelta >= 0;

  const outflowDelta = latestOutflow - prevOutflow;
  const outflowTrend = prevMonth
    ? outflowDelta >= 0
      ? `Up ${((outflowDelta / Math.abs(prevOutflow || 1)) * 100).toFixed(1)}%`
      : `Down ${Math.abs((outflowDelta / Math.abs(prevOutflow || 1)) * 100).toFixed(1)}%`
    : 'No trend';
  const outflowDown = outflowDelta <= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashflow Dashboard</h1>
          <p className="text-gray-600">Track your cash inflows and outflows</p>
        </div>
        <div className="text-sm text-gray-500">Trailing 3 closed months</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`card border-transparent bg-gradient-to-br ${netPositive ? 'from-white to-emerald-50' : 'from-white to-rose-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${netPositive ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              <Wallet className={`w-6 h-6 ${netPositive ? 'text-emerald-600' : 'text-rose-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Net Cashflow (3 months)</p>
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
            <div className={`p-3 rounded-lg ${inflowUp ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              {inflowUp ? (
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-rose-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Revenue (3 months)</p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatCurrency(avgInflow)}
              </p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${inflowUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {inflowUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {inflowTrend}
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-rose-50">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${outflowDown ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              {outflowDown ? (
                <TrendingDown className="w-6 h-6 text-emerald-600" />
              ) : (
                <TrendingUp className="w-6 h-6 text-rose-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Expenses (3 months)</p>
              <p className="text-2xl font-bold text-rose-700">
                {formatCurrency(avgOutflow)}
              </p>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${outflowDown ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {outflowDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {outflowTrend}
          </div>
        </div>
      </div>

      {/* Monthly Cashflow */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Monthly Cashflow (3 Closed Months)</h2>
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
        <h2 className="text-lg font-semibold mb-4">Net Cashflow (3 Closed Months)</h2>
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
        <h2 className="text-lg font-semibold mb-4">Cash Balance History (3 Closed Months)</h2>
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
