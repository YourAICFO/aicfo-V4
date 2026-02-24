import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wallet, RotateCcw, Landmark, PercentCircle, Package, Info } from 'lucide-react';
import { formatCurrency, formatNumber } from '../lib/format';
import { financeApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent } from '../components/ui/Card';

type WorkingCapitalPayload = {
  working_capital: number | null;
  net_working_capital?: number | null;
  liquidity_position?: number | null;
  cash_conversion_cycle: number | null;
  cash_gap_ex_inventory?: number | null;
  receivable_days: number | null;
  payable_days: number | null;
  loans_total_outstanding: number | null;
  interest_expense_latest: number | null;
  interest_coverage: number | null;
  inventory_total?: number | null;
  inventory_delta?: number | null;
  inventory_days?: number | null;
  pl_activity_latest_month?: boolean;
  sources: Record<string, { metric_key: string; value: number | null }>;
};

export default function WorkingCapital() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const [data, setData] = useState<WorkingCapitalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (location.hash === '#inventory' && !loading) {
      document.getElementById('inventory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, loading]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await financeApi.getWorkingCapital();
        setData(response?.data?.data || null);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load working capital summary');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompanyId, retryCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Working Capital & Loans</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Liquidity and debt summary</p>
        </div>
        <Card variant="critical" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4">
          <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
          <button type="button" onClick={() => { setError(''); setLoading(true); setData(null); setRetryCount((c) => c + 1); }} className="rounded-md border border-red-300 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-gray-700 shrink-0">Retry</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Working Capital & Loans</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">NWC, CCC, DSO/DPO/DIO, liquidity, loans. Latest snapshot from stored metrics.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <button type="button" onClick={() => navigate('/pl-pack')} className="text-primary-600 hover:text-primary-700 font-medium">
            P&L Pack →
          </button>
          <button type="button" onClick={() => navigate('/cashflow')} className="text-primary-600 hover:text-primary-700 font-medium">
            Cashflow →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <Wallet className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Net working capital</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data?.net_working_capital ?? data?.working_capital ?? null)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Receivables + Inventory − Payables</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <Wallet className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Liquidity (Cash + NWC)</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data?.liquidity_position ?? data?.working_capital ?? null)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <section id="inventory" className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Inventory</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Closing stock, movement, and inventory days (DIO).</p>
        </div>
        {data?.pl_activity_latest_month && (data?.inventory_total === 0 || data?.inventory_total == null) && (
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
            <Info className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p>Inventory is ₹0. If you track stock, map Stock-in-Hand / Inventory ledgers in Data Health.</p>
              <button
                type="button"
                onClick={() => navigate('/data-health')}
                className="mt-2 font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Review Data Health →
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card variant="subtle">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
                <Package className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Inventory</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data?.inventory_total ?? null)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  MoM: {data?.inventory_delta != null ? (data.inventory_delta >= 0 ? '+' : '') + formatCurrency(data.inventory_delta) : '—'} · DIO: {formatNumber(data?.inventory_days ?? null, 'd')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Working capital cycle</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">CCC, DSO, DPO, DIO, and cash gap (ex. inventory).</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card variant="subtle">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
                <RotateCcw className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Cash Conversion Cycle</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatNumber(data?.cash_conversion_cycle ?? null, ' days')}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recv: {formatNumber(data?.receivable_days ?? null, 'd')} | Pay: {formatNumber(data?.payable_days ?? null, 'd')} | DIO: {formatNumber(data?.inventory_days ?? null, 'd')}
                </p>
                {data?.cash_conversion_cycle == null && data?.cash_gap_ex_inventory != null && Number.isFinite(data.cash_gap_ex_inventory) && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Cash gap (ex. inventory): {formatNumber(data.cash_gap_ex_inventory, ' days')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Financing</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loans outstanding and interest expense.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card variant="subtle">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
                <Landmark className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Loans Outstanding</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data?.loans_total_outstanding ?? null)}</p>
              </div>
            </CardContent>
          </Card>
          <Card variant="subtle">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
                <PercentCircle className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Interest Expense (Latest)</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(data?.interest_expense_latest ?? null)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card variant="default">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Data Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {Object.entries(data?.sources || {}).map(([key, source]) => (
              <div key={key} className="rounded-md border border-slate-200 dark:border-slate-600 px-3 py-2">
                <p className="font-medium text-gray-900 dark:text-gray-100">{key}</p>
                <p className="text-slate-500 dark:text-slate-400">metric: {source.metric_key}</p>
                <p className="text-gray-700 dark:text-gray-300">value: {formatNumber(source.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
