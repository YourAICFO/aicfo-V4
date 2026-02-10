import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Users, AlertTriangle } from 'lucide-react';
import { debtorsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function Debtors() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const summaryRes = await debtorsApi.getSummary();
      setSummary(summaryRes.data.data);
    } catch (error) {
      console.error('Failed to load debtors data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const changeAmount = summary?.changeVsPrevClosed?.amount || 0;
  const changePct = summary?.changeVsPrevClosed?.pct;
  const growthUp = changeAmount >= 0;
  const top10 = summary?.top10 || [];
  const riskLevel = summary?.risk?.level || 'low';
  const riskLabel = riskLevel === 'high' ? 'High Risk' : riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk';
  const riskClasses = riskLevel === 'high'
    ? 'bg-rose-100 text-rose-700'
    : riskLevel === 'medium'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-100 text-emerald-700';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Debtors</h1>
        <p className="text-gray-600">Receivables intelligence based on monthly snapshots</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card border-transparent bg-gradient-to-br from-white to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Debtors</p>
              <p className="text-2xl font-bold">{formatCurrency(summary?.totalBalance || 0)}</p>
            </div>
          </div>
        </div>
        <div className={`card border-transparent bg-gradient-to-br ${growthUp ? 'from-white to-emerald-50' : 'from-white to-rose-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${growthUp ? 'bg-emerald-100' : 'bg-rose-100'}`}>
              {growthUp ? <TrendingUp className="w-6 h-6 text-emerald-600" /> : <TrendingDown className="w-6 h-6 text-rose-600" />}
            </div>
            <div>
              <p className="text-sm text-gray-600">Change vs Last Closed</p>
              <p className={`text-2xl font-bold ${growthUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                {changePct === null || changePct === undefined ? '—' : `${growthUp ? '+' : ''}${changePct.toFixed(1)}%`}
              </p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(changeAmount)}</p>
            </div>
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-slate-100">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Concentration</p>
              <p className="text-2xl font-bold">
                {summary?.concentration?.top1Pct?.toFixed?.(0) ?? 0}% / {summary?.concentration?.top5Pct?.toFixed?.(0) ?? 0}%
              </p>
              <p className="text-xs text-gray-500">Top 1 / Top 5</p>
            </div>
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-100">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Risk</p>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${riskClasses}`}>
                {riskLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Top 10 Debtors</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Debtor</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Closing Balance</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {top10.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500">No data</td>
                </tr>
              ) : (
                top10.map((row) => (
                  <tr key={row.guid || row.name} className="border-b border-gray-100">
                    <td className="py-3 px-4">{row.name}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(row.balance)}</td>
                    <td className="py-3 px-4 text-right">{(row.sharePct || 0).toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">AI Insights</h2>
        <p className="text-sm text-gray-600">
          {riskLevel === 'high'
            ? 'Receivables are highly concentrated. Monitor top counterparties closely.'
            : 'Debtors look stable based on the latest balance snapshot.'}
        </p>
      </div>
    </div>
  );
}
