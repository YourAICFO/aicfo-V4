import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { dashboardApi, syncApi } from '../../services/api';
import { formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import DashboardSkeleton from './DashboardSkeleton';

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

const ModernDashboard: React.FC = () => {
  const navigate = useNavigate();
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const { isTrial, trialEndsInDays } = useSubscriptionStore();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'processing' | 'ready' | 'failed'>('syncing');
  const [lastSyncCompletedAt, setLastSyncCompletedAt] = useState<string | null>(null);
  const [lastSnapshotMonth, setLastSnapshotMonth] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadSyncStatus();
  }, [selectedCompanyId]);

  const loadSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await syncApi.getStatus();
      const status = response?.data?.data?.status || 'syncing';
      setSyncStatus(status);
      setLastSyncCompletedAt(response?.data?.data?.last_sync_completed_at || null);
      setLastSnapshotMonth(response?.data?.data?.last_snapshot_month || null);
      setSyncError(response?.data?.data?.error_message || null);

      if (status === 'ready') {
        await loadData();
      } else {
        setData(null);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const response = await dashboardApi.getOverview();
      if (response?.data?.data) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load overview:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSyncStatus();
    setRefreshing(false);
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
    return <DashboardSkeleton />;
  }

  const inflow = data?.runway.avgMonthlyInflow || 0;
  const outflow = data?.runway.avgMonthlyOutflow || 0;
  const mixData = [
    { name: 'Inflow', value: inflow },
    { name: 'Outflow', value: outflow },
  ];
  const runwayStatusLabel = data?.runway.status || '—';

  return (
    <>
      <div className="space-y-6">

        {/* Header with refresh */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">CFO Overview</h1>
            <p className="text-gray-600 dark:text-gray-400">Your financial health at a glance</p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              leftIcon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Trial banner */}
        {isTrial && trialEndsInDays !== null && (
          <Card variant={trialEndsInDays <= 7 ? 'warning' : 'success'}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`rounded-full p-2 ${trialEndsInDays <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {trialEndsInDays <= 7 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Free trial: {trialEndsInDays} days remaining</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {trialEndsInDays <= 7 ? 'Your trial ends soon. Upgrade anytime to keep full access.' : 'Enjoy full access during your trial.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync status */}
        {syncStatus !== 'ready' && (
          <Card variant="warning">
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-6">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Data is syncing / processing.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last sync: {lastSyncCompletedAt ? new Date(lastSyncCompletedAt).toLocaleString() : '—'}
                  {lastSnapshotMonth ? ` · Latest closed month: ${lastSnapshotMonth}` : ''}
                </p>
                {syncStatus === 'failed' && syncError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{syncError}</p>
                )}
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Please refresh after a few minutes.</p>
              </div>
              <Button variant="primary" size="sm" onClick={handleRefresh}>
                Refresh Now
              </Button>
            </CardContent>
          </Card>
        )}

        {!data && syncStatus === 'ready' && (
          <Card variant="warning">
            <CardContent className="p-6">
              <p className="font-medium text-gray-900 dark:text-gray-100">No dashboard data available yet.</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Connect your accounting software and run a sync to populate metrics.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Cash Position */}
          <Card variant="gradient">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Cash</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency((data?.cashPosition.currentBalance || 0) + (data?.cashPosition.bankBalance || 0))}
                  </p>
                </div>
                <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/20">
                  <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Bank: </span>
                <span className="font-medium text-gray-900 dark:text-gray-100 ml-1">
                  {formatCurrency(data?.cashPosition.bankBalance || 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Cash Runway */}
          <Card variant="gradient">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cash Runway</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {data?.runway.months ?? 0} months
                  </p>
                </div>
                <div className={`rounded-full p-3 ${getRiskColor(data?.runway.status || '')}`}>
                  {getRiskIcon(data?.runway.status || '')}
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Status</span>
                  <span className={`font-medium ${data?.runway.status === 'GREEN' ? 'text-green-600' : data?.runway.status === 'AMBER' ? 'text-amber-600' : 'text-red-600'}`}>
                    {runwayStatusLabel}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-2 rounded-full ${
                      data?.runway.status === 'GREEN' ? 'bg-green-500' : 
                      data?.runway.status === 'AMBER' ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(((data?.runway.months || 0) / 12) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Inflow */}
          <Card variant="gradient">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Monthly Inflow</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(data?.runway.avgMonthlyInflow || 0)}
                  </p>
                </div>
                <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/20">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="mt-4 text-sm">
                <span className="text-green-600 dark:text-green-400">↗ 12% from last month</span>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Outflow */}
          <Card variant="gradient">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Monthly Outflow</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(data?.runway.avgMonthlyOutflow || 0)}
                  </p>
                </div>
                <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="mt-4 text-sm">
                <span className="text-red-600 dark:text-red-400">↗ 5% from last month</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Insights */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Cash Flow Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Inflow vs Outflow Mix</CardTitle>
              <CardDescription>Based on trailing 3 closed months</CardDescription>
            </CardHeader>
            <CardContent>
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
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
                    <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Inflow
                    </div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(inflow)}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 dark:bg-red-900/20">
                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Outflow
                    </div>
                    <p className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(outflow)}</p>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Net Cash Flow: <span className="font-semibold">{(data?.runway.netCashFlow || 0) >= 0 ? '+' : ''}{formatCurrency(data?.runway.netCashFlow || 0)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Insights</CardTitle>
                  <CardDescription>Latest recommendations and risk alerts</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(data?.insights.recent || []).length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 dark:text-gray-500 mb-2">
                    <AlertCircle className="h-12 w-12 mx-auto" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No insights yet. Connect accounting software to unlock AI recommendations.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.insights.recent.map((insight) => (
                    <div
                      key={insight.id}
                      className={`border-l-4 ${getInsightBorder(insight.riskLevel)} bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm`}
                    >
                      <div className="flex items-start gap-3">
                        {getInsightIcon(insight.riskLevel)}
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">{insight.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{insight.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {data?.insights?.unreadCount && data.insights.unreadCount > 3 && (
                    <Button variant="outline" size="sm" className="w-full">
                      View {data.insights.unreadCount - 3} more insights
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Button variant="outline" size="sm" leftIcon={<TrendingUp className="h-4 w-4" />} onClick={() => navigate('/revenue')}>
                View Revenue Trends
              </Button>
              <Button variant="outline" size="sm" leftIcon={<Wallet className="h-4 w-4" />} onClick={() => navigate('/cashflow')}>
                Check Cash Position
              </Button>
              <Button variant="outline" size="sm" leftIcon={<AlertTriangle className="h-4 w-4" />} onClick={() => navigate('/ai-insights')}>
                Review Alerts
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
};

export default ModernDashboard;
