import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { financeApi, DataHealthResponse, type DataHealthImpactMessage } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Activity, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import DataReadyBadge from '../components/common/DataReadyBadge';
import { Card, CardContent } from '../components/ui/Card';
import { THEME } from '../lib/theme';

function formatMonth(value: string | null): string {
  if (!value) return '—';
  const [y, m] = value.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function formatSyncStatus(status: string | null): string {
  if (!status) return 'Never synced';
  const s = String(status).toLowerCase();
  if (s === 'success' || s === 'completed') return 'Success';
  if (s === 'failed' || s === 'error') return 'Failed';
  if (s === 'syncing' || s === 'in_progress') return 'Syncing';
  return status;
}

export default function DataHealth() {
  const navigate = useNavigate();
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const [data, setData] = useState<DataHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!selectedCompanyId) return;
    setLoading(true);
    setError('');
    financeApi
      .getDataHealth()
      .then((res) => {
        setData(res?.data?.data ?? null);
      })
      .catch(() => {
        setError('Failed to load data health.');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [selectedCompanyId, retryCount]);

  const loadData = () => setRetryCount((c) => c + 1);

  if (!selectedCompanyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Data Health</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Select a company to view mapping and sync health.</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Data Health</h1>
        <Card variant="critical" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4">
          <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
          <button type="button" onClick={() => { setError(''); setLoading(true); loadData(); }} className="rounded-md border border-red-300 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-gray-700 shrink-0">Retry</button>
        </Card>
      </div>
    );
  }

  const health = data!;
  const impactMessages: DataHealthImpactMessage[] = Array.isArray(health.impactMessages)
    ? health.impactMessages.filter((m): m is DataHealthImpactMessage => m != null && typeof m === 'object' && 'message' in m)
    : [];
  const suggestedNextSteps = health.suggestedNextSteps ?? [];
  const lastSyncStatus = formatSyncStatus(health.lastSync?.last_sync_status ?? null);
  const syncFailed = lastSyncStatus === 'Failed';
  const dataReady = health.dataReadyForInsights === true;

  const getImpactBorderClass = (severity: string) => {
    switch (severity) {
      case 'critical': return THEME.severity.critical;
      case 'high': return THEME.severity.high;
      case 'medium': return THEME.severity.medium;
      case 'low': return THEME.severity.low;
      default: return THEME.severity.neutral;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Data Health</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Mapping and sync diagnostics for your accounting data
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="subtle">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">Coverage</p>
              <DataReadyBadge dataReady={dataReady} />
            </div>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">{health.classifiedPct}%</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{health.classifiedLedgers} of {health.totalLedgers} ledgers classified</p>
            {!dataReady && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Resolve highlighted issues to unlock full insights.</p>}
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Latest month</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">{formatMonth(health.latestMonth)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{health.availableMonthsCount} months available</p>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Last sync</p>
            <div className="flex items-center gap-2 mt-1">
              {syncFailed ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : lastSyncStatus === 'Success' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Activity className="h-5 w-5 text-slate-400" />}
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{lastSyncStatus}</p>
            </div>
            {health.lastSync?.last_sync_at && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(health.lastSync.last_sync_at).toLocaleString()}</p>}
            {health.lastSync?.last_sync_error && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 truncate" title={health.lastSync.last_sync_error}>{health.lastSync.last_sync_error}</p>}
          </CardContent>
        </Card>
      </div>

      <Card variant="default" className="overflow-hidden">
        <h2 className="px-4 py-3 text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700">What&apos;s missing</h2>
        {health.topUnclassifiedLedgers.length === 0 ? (
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">No unclassified ledgers in the top list. Coverage is complete for known ledgers.</p>
          </CardContent>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {health.topUnclassifiedLedgers.map((item, i) => (
              <li key={i} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-800 dark:text-gray-200">{item.name}</span>
                {item.balance != null && <span className="text-slate-500 dark:text-slate-400 tabular-nums">{item.balance.toLocaleString()}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card variant="default" className="overflow-hidden">
        <h2 className="px-4 py-3 text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700">Impact</h2>
        {impactMessages.length === 0 ? (
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">No impact messages. Key metrics (e.g. CCC, DIO, aging) have required mappings.</p>
          </CardContent>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {impactMessages.map((msg, i) => (
              <li key={msg.key || i} className={`px-4 py-3 flex items-start gap-2 text-sm border-l-4 ${getImpactBorderClass(msg.severity)}`}>
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-gray-700 dark:text-gray-300">{msg.message}</span>
                  {msg.link && (
                    <button type="button" onClick={() => navigate(msg.link!)} className="ml-2 text-primary-600 dark:text-primary-400 hover:underline text-xs font-medium inline-flex items-center gap-0.5">View →</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card variant="default" className="overflow-hidden">
        <h2 className="px-4 py-3 text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700">Suggested next steps</h2>
        {suggestedNextSteps.length === 0 ? (
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">No actions needed. Keep syncing to refresh data.</p>
          </CardContent>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {suggestedNextSteps.map((step, i) => (
              <li key={i} className="px-4 py-3 flex items-center gap-2 text-sm">
                <ChevronRight className="h-4 w-4 text-primary-500 shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">{step}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
