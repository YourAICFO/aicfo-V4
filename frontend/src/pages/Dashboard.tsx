import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';
import { useSubscriptionStore } from '../store/subscriptionStore';

interface OverviewData {
  cashPosition: {
    currentBalance: number;
    bankBalance: number;
    currency: string;
  };
  runway: {
    months: number;
    status: 'GREEN' | 'AMBER' | 'RED';
    avgMonthlyInflow: number;
    avgMonthlyOutflow: number;
    netCashFlow: number;
  };
  insights: {
    unreadCount: number;
    recent: Array<{
      id: string;
      type: string;
      riskLevel: string;
      title: string;
      content: string;
    }>;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const { isTrial, trialEndsInDays } = useSubscriptionStore();

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getOverview();

      if (response?.data?.data) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load overview:', error);
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

  const getRiskColor = (status: string) => {
    switch (status) {
      case 'GREEN':
        return 'text-green-600 bg-green-50';
      case 'AMBER':
        return 'text-amber-600 bg-amber-50';
      case 'RED':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskIcon = (status: string) => {
    switch (status) {
      case 'GREEN':
        return <CheckCircle className="w-5 h-5" />;
      case 'AMBER':
        return <AlertCircle className="w-5 h-5" />;
      case 'RED':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getInsightIcon = (level: string) => {
    switch (level) {
      case 'GREEN':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'AMBER':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'RED':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getInsightBorder = (level: string) => {
    switch (level) {
      case 'GREEN':
        return 'border-l-green-500';
      case 'AMBER':
        return 'border-l-amber-500';
      case 'RED':
        return 'border-l-red-500';
      default:
        return 'border-l-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const inflow = data?.runway.avgMonthlyInflow || 0;
  const outflow = data?.runway.avgMonthlyOutflow || 0;
  const mixData = [
    { name: 'Inflow', value: inflow },
    { name: 'Outflow', value: outflow },
  ];
  const runwayStatusLabel = data?.runway.status || '—';

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CFO Overview</h1>
          <p className="text-gray-600">Your financial health at a glance</p>
        </div>

        <Link to="/create-company" className="btn-primary px-4 py-2">
          + Create Company
        </Link>
      </div>
      {isTrial && trialEndsInDays !== null && (
        <div className={`card ${trialEndsInDays <= 7 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${trialEndsInDays <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {trialEndsInDays <= 7 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Free trial: {trialEndsInDays} days remaining</p>
              <p className="text-xs text-gray-600">
                {trialEndsInDays <= 7 ? 'Your trial ends soon. Upgrade anytime to keep full access.' : 'Enjoy full access during your trial.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Cash */}
        <div className="card border-transparent bg-gradient-to-br from-white to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Cash</p>
              <p className="text-2xl font-bold">
                {formatCurrency((data?.cashPosition.currentBalance || 0) + (data?.cashPosition.bankBalance || 0))}
              </p>
            </div>
          </div>
        </div>

        {/* Runway */}
        <div className="card border-transparent bg-gradient-to-br from-white to-emerald-50">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${getRiskColor(data?.runway.status || '')}`}>
              {getRiskIcon(data?.runway.status || '')}
            </div>
            <div>
              <p className="text-sm text-gray-600">Cash Runway</p>
              <p className="text-2xl font-bold">
                {data?.runway.months ?? 0} months
              </p>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            {runwayStatusLabel} status
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${Math.min(((data?.runway.months || 0) / 12) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Inflow */}
        <div className="card border-transparent bg-gradient-to-br from-white to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Monthly Inflow</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data?.runway.avgMonthlyInflow || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Outflow */}
        <div className="card border-transparent bg-gradient-to-br from-white to-rose-50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Monthly Outflow</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data?.runway.avgMonthlyOutflow || 0)}
              </p>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Inflow vs Outflow Mix</h2>
              <p className="text-sm text-gray-600">Based on trailing 3 closed months</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-gray-400">Net Cash Flow</p>
              <p className={`text-lg font-semibold ${(data?.runway.netCashFlow || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(data?.runway.netCashFlow || 0)}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="h-56 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mixData}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
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
            <div className="space-y-3 md:w-1/2">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Inflow
                </div>
                <p className="font-semibold text-emerald-700">{formatCurrency(inflow)}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-rose-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-rose-700">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Outflow
                </div>
                <p className="font-semibold text-rose-700">{formatCurrency(outflow)}</p>
              </div>
            </div>
          </div>
        </div>

      {/* AI Insights */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Insights</h2>
            <p className="text-sm text-gray-600">Latest recommendations and risk alerts</p>
          </div>
          <Link to="/ai-insights" className="text-sm font-medium text-primary-700 hover:text-primary-800">
            View all
            {data?.insights.unreadCount ? (
              <span className="ml-2 inline-flex items-center justify-center text-xs font-semibold bg-primary-100 text-primary-700 rounded-full px-2 py-0.5">
                {data.insights.unreadCount} new
              </span>
            ) : null}
          </Link>
        </div>

        {(data?.insights.recent || []).length === 0 ? (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-6 text-center">
            No insights yet. Connect accounting software to unlock AI recommendations.
          </div>
        ) : (
          <div className="space-y-3">
            {data?.insights.recent.map((insight) => (
              <div
                key={insight.id}
                className={`border-l-4 ${getInsightBorder(insight.riskLevel)} bg-white rounded-lg px-4 py-3 shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  {getInsightIcon(insight.riskLevel)}
                  <div>
                    <h3 className="font-medium text-gray-900">{insight.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{insight.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

    </div>
  );
}
