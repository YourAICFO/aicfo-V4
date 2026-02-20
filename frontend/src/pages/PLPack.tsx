import { useState, useEffect, useCallback } from 'react';
import { financeApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { TrendingUp, TrendingDown, FileText, Sparkles, Loader2 } from 'lucide-react';

type DriverItem = { key: string; label: string; amount: number };
type DriverBlock = { deltaAmount: number; topPositive: DriverItem[]; topNegative: DriverItem[] };

type PlPackData = {
  month: string;
  previousMonth: string | null;
  current: { totalRevenue: number; totalExpenses: number; grossProfit: number; netProfit: number };
  previous: { totalRevenue: number; totalExpenses: number; grossProfit: number; netProfit: number };
  variances: {
    revenue: number;
    opex: number;
    grossProfit: number;
    netProfit: number;
    revenuePct?: number | null;
    opexPct?: number | null;
    grossProfitPct?: number | null;
    netProfitPct?: number | null;
  };
  ytd: { totalRevenue: number; totalExpenses: number; grossProfit?: number; netProfit: number };
  ytdLastFy?: { totalRevenue: number; totalExpenses: number; grossProfit?: number; netProfit: number };
  ytdVarianceAmount?: { revenue: number; expenses: number; grossProfit: number; netProfit: number };
  ytdVariancePct?: { revenue: number | null; expenses: number | null; grossProfit: number | null; netProfit: number | null };
  drivers: {
    revenue: DriverBlock;
    opex: DriverBlock;
    grossProfit: DriverBlock;
    netProfit: DriverBlock;
  };
};

type RemarksData = {
  text: string | null;
  aiDraftText: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  aiDraftUpdatedAt: string | null;
};

function formatMonthLabel(value: string): string {
  const [y, m] = value.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export default function PLPack() {
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [monthsLoading, setMonthsLoading] = useState(true);
  const [month, setMonth] = useState<string>('');
  const [pack, setPack] = useState<PlPackData | null>(null);
  const [remarks, setRemarks] = useState<RemarksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [remarksSaving, setRemarksSaving] = useState(false);
  const [manualText, setManualText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedCompanyId) return;
    let cancelled = false;
    setMonthsLoading(true);
    financeApi
      .getPlMonths()
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.data?.months ?? [];
        const latest = res?.data?.data?.latest ?? list[0] ?? null;
        setAvailableMonths(list);
        setMonth((prev) => (latest || prev || list[0] || ''));
      })
      .catch(() => {
        if (!cancelled) setAvailableMonths([]);
      })
      .finally(() => {
        if (!cancelled) setMonthsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId]);

  const loadPackAndRemarks = useCallback(async () => {
    if (!selectedCompanyId || !month) return;
    setError('');
    setLoading(true);
    try {
      const [packRes, remarksRes] = await Promise.all([
        financeApi.getPlPack(month),
        financeApi.getPlRemarks(month),
      ]);
      setPack(packRes?.data?.data ?? null);
      const rem = remarksRes?.data?.data ?? null;
      setRemarks(rem);
      setManualText(rem?.text ?? '');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load P&L Pack');
      setPack(null);
      setRemarks(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, month]);

  useEffect(() => {
    if (!selectedCompanyId || !month) return;
    loadPackAndRemarks();
  }, [selectedCompanyId, month, loadPackAndRemarks]);

  const handleSaveRemarks = async () => {
    if (!month) return;
    setRemarksSaving(true);
    try {
      await financeApi.savePlRemarks(month, manualText);
      await loadPackAndRemarks();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save remarks');
    } finally {
      setRemarksSaving(false);
    }
  };

  const handleGenerateAi = async (forceRegenerate: boolean) => {
    if (!month) return;
    setAiLoading(true);
    setError('');
    try {
      const res = await financeApi.generatePlAiExplanation(month, forceRegenerate);
      const aiDraftText = res?.data?.aiDraftText ?? null;
      const aiDraftUpdatedAt = res?.data?.aiDraftUpdatedAt ?? null;
      setRemarks((prev) => (prev ? { ...prev, aiDraftText, aiDraftUpdatedAt } : { text: null, aiDraftText, updatedAt: null, updatedBy: null, aiDraftUpdatedAt }));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to generate AI explanation');
    } finally {
      setAiLoading(false);
    }
  };

  const monthOptions = availableMonths.map((value) => ({ value, label: formatMonthLabel(value) }));
  const monthSelectorDisabled = monthsLoading || availableMonths.length === 0;

  if (!selectedCompanyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">P&L Review Pack</h1>
        <p className="text-gray-600">Select a company to view the P&L pack.</p>
      </div>
    );
  }

  if (monthsLoading && availableMonths.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!month && availableMonths.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">P&L Review Pack</h1>
        <p className="text-gray-600">No P&L data available for this company yet. Sync accounting data to see months.</p>
      </div>
    );
  }

  if (loading && !pack && month) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P&L Review Pack</h1>
          <p className="text-gray-600">Deterministic P&L with drivers and optional AI narrative</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Month</label>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            disabled={monthSelectorDisabled}
          >
            {monthOptions.length === 0 ? (
              <option value="">No months</option>
            ) : (
              monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {pack && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Revenue (month)</p>
              <p className="text-xl font-semibold">{formatCurrency(pack.current.totalRevenue)}</p>
              <p className={`text-sm ${pack.variances.revenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {pack.variances.revenue >= 0 ? '+' : ''}{formatCurrency(pack.variances.revenue)} {formatPct(pack.variances.revenuePct)} vs prev
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Opex (month)</p>
              <p className="text-xl font-semibold">{formatCurrency(pack.current.totalExpenses)}</p>
              <p className={`text-sm ${pack.variances.opex <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {pack.variances.opex >= 0 ? '+' : ''}{formatCurrency(pack.variances.opex)} {formatPct(pack.variances.opexPct)} vs prev
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Net Profit (month)</p>
              <p className="text-xl font-semibold">{formatCurrency(pack.current.netProfit)}</p>
              <p className={`text-sm ${pack.variances.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {pack.variances.netProfit >= 0 ? '+' : ''}{formatCurrency(pack.variances.netProfit)} {formatPct(pack.variances.netProfitPct)} vs prev
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">YTD Net Profit</p>
              <p className="text-xl font-semibold">{formatCurrency(pack.ytd.netProfit)}</p>
              {pack.ytdLastFy != null && (
                <p className="text-xs text-gray-500 mt-1">
                  Last FY same period: {formatCurrency(pack.ytdLastFy.netProfit)}
                </p>
              )}
              {pack.ytdVarianceAmount != null && (
                <p className={`text-sm ${pack.ytdVarianceAmount.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {pack.ytdVarianceAmount.netProfit >= 0 ? '+' : ''}{formatCurrency(pack.ytdVarianceAmount.netProfit)} {formatPct(pack.ytdVariancePct?.netProfit)} vs last FY
                </p>
              )}
            </div>
          </div>

          {/* Drivers panel */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Drivers (MoM change)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Revenue</h3>
                <p className={`text-sm font-medium ${pack.drivers.revenue.deltaAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {pack.drivers.revenue.deltaAmount >= 0 ? '+' : ''}{formatCurrency(pack.drivers.revenue.deltaAmount)}
                </p>
                {pack.drivers.revenue.topPositive.length > 0 && (
                  <ul className="mt-2 text-xs text-gray-600">
                    {pack.drivers.revenue.topPositive.slice(0, 3).map((x) => (
                      <li key={x.key} className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        {x.label}: {formatCurrency(x.amount)}
                      </li>
                    ))}
                  </ul>
                )}
                {pack.drivers.revenue.topNegative.length > 0 && (
                  <ul className="mt-1 text-xs text-gray-600">
                    {pack.drivers.revenue.topNegative.slice(0, 3).map((x) => (
                      <li key={x.key} className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-red-500" />
                        {x.label}: {formatCurrency(x.amount)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Opex</h3>
                <p className={`text-sm font-medium ${pack.drivers.opex.deltaAmount <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {pack.drivers.opex.deltaAmount >= 0 ? '+' : ''}{formatCurrency(pack.drivers.opex.deltaAmount)}
                </p>
                {pack.drivers.opex.topPositive.length > 0 && (
                  <ul className="mt-2 text-xs text-gray-600">
                    {pack.drivers.opex.topPositive.slice(0, 3).map((x) => (
                      <li key={x.key} className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-red-500" />
                        {x.label}: +{formatCurrency(x.amount)}
                      </li>
                    ))}
                  </ul>
                )}
                {pack.drivers.opex.topNegative.length > 0 && (
                  <ul className="mt-1 text-xs text-gray-600">
                    {pack.drivers.opex.topNegative.slice(0, 3).map((x) => (
                      <li key={x.key} className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-emerald-500" />
                        {x.label}: {formatCurrency(x.amount)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Net Profit</h3>
                <p className={`text-sm font-medium ${pack.drivers.netProfit.deltaAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {pack.drivers.netProfit.deltaAmount >= 0 ? '+' : ''}{formatCurrency(pack.drivers.netProfit.deltaAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Remarks + AI */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Remarks
              </h2>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[100px]"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Manual remarks for this month"
              />
              <button
                type="button"
                className="mt-2 rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
                onClick={handleSaveRemarks}
                disabled={remarksSaving}
              >
                {remarksSaving ? 'Saving…' : 'Save remarks'}
              </button>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> AI Explanation
              </h2>
              {remarks?.aiDraftText ? (
                <>
                  <p className="text-xs text-gray-500 mb-2">
                    Generated on {remarks.aiDraftUpdatedAt ? new Date(remarks.aiDraftUpdatedAt).toLocaleString() : '—'}
                  </p>
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm whitespace-pre-wrap">
                    {remarks.aiDraftText}
                  </div>
                  <button
                    type="button"
                    className="mt-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => handleGenerateAi(true)}
                    disabled={aiLoading}
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Regenerate
                  </button>
                </>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Generate a short CFO-style narrative from this month’s numbers and drivers (on-demand, cached per month).</p>
                  <button
                    type="button"
                    className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50"
                    onClick={() => handleGenerateAi(false)}
                    disabled={aiLoading}
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null} Generate AI explanation
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
