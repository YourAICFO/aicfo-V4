import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent } from '../components/ui/Card';

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const cashflow = data?.cashflow;
  const avgCashInflow = cashflow?.avgCashInflow ?? null;
  const avgCashOutflow = cashflow?.avgCashOutflow ?? null;
  const netCashFlow = cashflow?.netCashFlow ?? null;
  const netPositive = netCashFlow != null && netCashFlow >= 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Cashflow Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Based on Cash & Bank movement (last 6 months)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="subtle" className={netPositive ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <Wallet className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Net cash flow</p>
              <p className={`text-2xl font-semibold ${netPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(netCashFlow)}
              </p>
              {netCashFlow != null && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${netPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                  {netPositive ? 'In surplus' : 'Deficit'}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg cash inflow</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(avgCashInflow)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <TrendingDown className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg cash outflow</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(avgCashOutflow)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="default">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Monthly Cashflow (Cash & Bank movement)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyCashflow || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => formatMonth(label)} contentStyle={{ background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '12px', color: '#f8fafc' }} labelStyle={{ color: '#cbd5f5' }} />
                <Legend />
                <Bar dataKey="inflow" name="Inflow" fill="#10b981" />
                <Bar dataKey="outflow" name="Outflow" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card variant="default">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Net Cashflow (Cash & Bank movement)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyCashflow || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => formatMonth(label)} contentStyle={{ background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '12px', color: '#f8fafc' }} labelStyle={{ color: '#cbd5f5' }} />
                <Area type="monotone" dataKey="net" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card variant="default">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Cash Balance History</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.cashHistory || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN')} contentStyle={{ background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '12px', color: '#f8fafc' }} labelStyle={{ color: '#cbd5f5' }} />
                <Area type="monotone" dataKey="amount" stroke="#64748b" fill="#64748b" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
