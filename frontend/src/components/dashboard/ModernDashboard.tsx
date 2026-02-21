import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Wallet, RefreshCw, Info, FileText, Users, CreditCard, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { dashboardApi, syncApi, connectorApi, financeApi, type ConnectorStatusV1Data, type FinanceAlert } from '../../services/api';
import { formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import DashboardSkeleton from './DashboardSkeleton';
import DataReadyBadge from '../common/DataReadyBadge';

interface CommandCenterItem {
  amount?: number;
  label: string;
  link: string;
}

interface OverviewData {
  cashPosition: {
    currentBalance: number;
    bankBalance: number;
    currency: string;
  };
  runway: {
    months: number | null;
    status: string;
    statusLabel?: string;
    runwaySeries?: Array<{ month: string; netChange: number; closing?: number }>;
  };
  commandCenter?: {
    collectionsRisk: CommandCenterItem;
    payablesPressure: CommandCenterItem;
    profitSignal: { text: string; value: number; link: string };
  } | null;
  insights?: {
    unreadCount: number;
    recent: Array<{ id: string; type: string; riskLevel: string; title: string; content: string }>;
  };
  dataReadyForInsights?: boolean;
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
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatusV1Data | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<FinanceAlert[]>([]);
  const [alertMenuOpen, setAlertMenuOpen] = useState<string | null>(null);
  const [alertActionLoading, setAlertActionLoading] = useState<string | null>(null);

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
      if (selectedCompanyId) {
        try {
          const connectorResponse = await connectorApi.getStatusV1(selectedCompanyId);
          if (connectorResponse?.data?.success) {
            setConnectorStatus(connectorResponse.data.data);
          }
        } catch (error) {
          setConnectorStatus(null);
          console.error('Failed to load connector status v1:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [overviewRes, alertsRes] = await Promise.all([
        dashboardApi.getOverview(),
        financeApi.getAlerts().catch(() => ({ data: { data: [] } }))
      ]);
      if (overviewRes?.data?.data) {
        setData(overviewRes.data.data);
      }
      if (alertsRes?.data?.data && Array.isArray(alertsRes.data.data)) {
        setAlerts(alertsRes.data.data);
      } else {
        setAlerts([]);
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

  const handleCopyDiagnostics = async () => {
    try {
      const payload = {
        selectedCompanyId,
        connectorStatusV1: connectorStatus,
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch (error) {
      console.error('Failed to copy diagnostics:', error);
    }
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

  const handleAlertAction = async (ruleKey: string, action: 'snooze7' | 'snooze30' | 'dismiss') => {
    setAlertMenuOpen(null);
    setAlertActionLoading(ruleKey);
    try {
      let res;
      if (action === 'snooze7') res = await financeApi.snoozeAlert(ruleKey, 7);
      else if (action === 'snooze30') res = await financeApi.snoozeAlert(ruleKey, 30);
      else res = await financeApi.dismissAlert(ruleKey);
      if (res?.data?.data) setAlerts(res.data.data);
    } catch (e) {
      console.error('Alert action failed:', e);
    } finally {
      setAlertActionLoading(null);
    }
  };

  const getAlertSeverityStyle = (severity: FinanceAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10';
      case 'high':
        return 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10';
      case 'medium':
        return 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10';
      default:
        return 'border-l-gray-400 bg-gray-50 dark:bg-gray-800';
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const runwayStatusLabel = data?.runway.statusLabel ?? data?.runway.status ?? '—';
  const runwayMonths = data?.runway.months ?? null;
  const runwayIsNumeric = typeof runwayMonths === 'number';
  const runwaySeries = data?.runway.runwaySeries ?? [];
  const cc = data?.commandCenter;

  return (
    <>
      <div className="space-y-6">

        {/* Header with refresh */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Command Center</h1>
              {data != null && (
                <DataReadyBadge dataReady={data.dataReadyForInsights === true} />
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {data?.dataReadyForInsights === false
                ? 'Insights may be incomplete due to data gaps.'
                : 'Safety and attention at a glance'}
            </p>
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

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Connector Health</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Online: {connectorStatus?.connector?.isOnline ? 'Yes' : 'No'}{connectorStatus?.connector?.lastSeenAt ? ` • Last seen ${new Date(connectorStatus.connector.lastSeenAt).toLocaleString()}` : ''}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sync: {connectorStatus?.sync?.lastRunStatus || 'never'}{connectorStatus?.sync?.lastRunCompletedAt ? ` • ${new Date(connectorStatus.sync.lastRunCompletedAt).toLocaleString()}` : ''}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ready: {connectorStatus?.dataReadiness?.status || 'never'}{connectorStatus?.dataReadiness?.latestMonthKey ? ` • ${connectorStatus.dataReadiness.latestMonthKey}` : ''}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Sync = connector run status. Ready = snapshot/data readiness.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyDiagnostics}>
              Copy diagnostics
            </Button>
          </CardContent>
        </Card>

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

        {/* Command Center: Cash & Bank, Runway, Collections Risk, Payables Pressure, Profit Signal */}
        {data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Cash & Bank */}
            <Card variant="gradient">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cash & Bank</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency((data.cashPosition.currentBalance || 0) + (data.cashPosition.bankBalance || 0))}
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-100 p-2.5 dark:bg-blue-900/20">
                    <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                {data.cashPosition.bankBalance != null && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Bank {formatCurrency(data.cashPosition.bankBalance)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Runway */}
            <Card variant="gradient">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Runway</p>
                    <span
                      className="text-gray-400 dark:text-gray-500 cursor-help"
                      title="Based on last 6 months average Cash & Bank movement from accounting ledgers."
                    >
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className={`rounded-full p-2.5 ${getRiskColor(data?.runway?.status || '')}`}>
                    {getRiskIcon(data?.runway?.status || '')}
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {runwayIsNumeric ? `${runwayMonths} months` : runwayStatusLabel}
                </p>
                {runwayIsNumeric && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={`h-1.5 rounded-full ${
                        data?.runway?.status === 'GREEN' ? 'bg-green-500' :
                        data?.runway?.status === 'AMBER' ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min((runwayMonths / 12) * 100, 100)}%` }}
                    />
                  </div>
                )}
                {runwaySeries.length > 0 && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400" title={runwaySeries.map((s) => `${s.month}: ${s.netChange >= 0 ? '+' : ''}${formatCurrency(s.netChange)}`).join('\n')}>
                    Last {runwaySeries.length} mo net change on hover
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Collections Risk */}
            <Card variant="gradient">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Collections Risk</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {cc?.collectionsRisk?.amount != null ? formatCurrency(cc.collectionsRisk.amount) : '—'}
                    </p>
                  </div>
                  <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                {cc?.collectionsRisk?.link && (
                  <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs px-2" onClick={() => navigate(cc.collectionsRisk!.link)}>
                    Working capital →
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Payables Pressure */}
            <Card variant="gradient">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Payables Pressure</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {cc?.payablesPressure?.amount != null ? formatCurrency(cc.payablesPressure.amount) : '—'}
                    </p>
                  </div>
                  <CreditCard className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                {cc?.payablesPressure?.link && (
                  <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs px-2" onClick={() => navigate(cc.payablesPressure!.link)}>
                    Working capital →
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Profit Signal (one-line, link to pl-pack) */}
            <Card variant="gradient">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Profit Signal</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {cc?.profitSignal?.value != null ? formatCurrency(cc.profitSignal.value) : '—'}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                {cc?.profitSignal?.link && (
                  <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs px-2" onClick={() => navigate(cc.profitSignal!.link)}>
                    P&L Pack →
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Red Flag Alerts (deterministic, max 5) */}
        {syncStatus === 'ready' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Alerts</CardTitle>
              <CardDescription>Red flags requiring attention. Click to open relevant screen.</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No alerts.</p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="relative flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(alert.link)}
                        className={`flex-1 text-left border-l-4 rounded-r px-3 py-2 ${getAlertSeverityStyle(alert.severity)} hover:opacity-90 transition-opacity`}
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">{alert.title}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">{alert.message}</span>
                      </button>
                      <div className="flex-shrink-0">
                        <button
                          type="button"
                          aria-label="Alert actions"
                          onClick={(e) => { e.stopPropagation(); setAlertMenuOpen(alertMenuOpen === alert.id ? null : alert.id); }}
                          disabled={!!alertActionLoading}
                          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {alertMenuOpen === alert.id && (
                          <>
                            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setAlertMenuOpen(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 py-1 w-36 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
                              <button type="button" className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleAlertAction(alert.ruleKey, 'snooze7'); }}>Snooze 7d</button>
                              <button type="button" className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleAlertAction(alert.ruleKey, 'snooze30'); }}>Snooze 30d</button>
                              <button type="button" className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleAlertAction(alert.ruleKey, 'dismiss'); }}>Dismiss</button>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Jump to detail screens</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" leftIcon={<FileText className="h-4 w-4" />} onClick={() => navigate('/pl-pack')}>
                P&L Pack
              </Button>
              <Button variant="outline" size="sm" leftIcon={<Wallet className="h-4 w-4" />} onClick={() => navigate('/cashflow')}>
                Cashflow
              </Button>
              <Button variant="outline" size="sm" leftIcon={<Users className="h-4 w-4" />} onClick={() => navigate('/working-capital')}>
                Working Capital
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
};

export default ModernDashboard;
