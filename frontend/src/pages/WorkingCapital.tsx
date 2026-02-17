import { useEffect, useState } from 'react';
import { Wallet, RotateCcw, Landmark, PercentCircle } from 'lucide-react';
import { financeApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

type WorkingCapitalPayload = {
  working_capital: number | null;
  cash_conversion_cycle: number | null;
  receivable_days: number | null;
  payable_days: number | null;
  loans_total_outstanding: number | null;
  interest_expense_latest: number | null;
  interest_coverage: number | null;
  sources: Record<string, { metric_key: string; value: number | null }>;
};

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return 'Not available yet';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number | null, suffix = '') => {
  if (value === null || value === undefined) return 'Not available yet';
  return `${value.toFixed(1)}${suffix}`;
};

export default function WorkingCapital() {
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const [data, setData] = useState<WorkingCapitalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  }, [selectedCompanyId]);

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
          <h1 className="text-2xl font-bold text-gray-900">Working Capital & Loans</h1>
          <p className="text-gray-600">Liquidity and debt summary</p>
        </div>
        <div className="card text-red-700 bg-red-50 border border-red-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Working Capital & Loans</h1>
        <p className="text-gray-600">Latest snapshot from stored financial metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card border-transparent bg-gradient-to-br from-white to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-100">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Working Capital</p>
              <p className="text-xl font-bold">{formatCurrency(data?.working_capital ?? null)}</p>
            </div>
          </div>
        </div>

        <div className="card border-transparent bg-gradient-to-br from-white to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100">
              <RotateCcw className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Cash Conversion Cycle</p>
              <p className="text-xl font-bold">{formatNumber(data?.cash_conversion_cycle ?? null, ' days')}</p>
              <p className="text-xs text-gray-500">
                Recv: {formatNumber(data?.receivable_days ?? null, 'd')} | Pay: {formatNumber(data?.payable_days ?? null, 'd')}
              </p>
            </div>
          </div>
        </div>

        <div className="card border-transparent bg-gradient-to-br from-white to-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-100">
              <Landmark className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Loans Outstanding</p>
              <p className="text-xl font-bold">{formatCurrency(data?.loans_total_outstanding ?? null)}</p>
            </div>
          </div>
        </div>

        <div className="card border-transparent bg-gradient-to-br from-white to-rose-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-rose-100">
              <PercentCircle className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Interest Expense (Latest)</p>
              <p className="text-xl font-bold">{formatCurrency(data?.interest_expense_latest ?? null)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Data Sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {Object.entries(data?.sources || {}).map(([key, source]) => (
            <div key={key} className="rounded-md border border-gray-200 px-3 py-2">
              <p className="font-medium text-gray-900">{key}</p>
              <p className="text-gray-500">metric: {source.metric_key}</p>
              <p className="text-gray-700">value: {source.value ?? 'Not available yet'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
