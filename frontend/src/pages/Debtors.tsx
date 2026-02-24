import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Users, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../lib/format';
import { debtorsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardContent } from '../components/ui/Card';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const changeAmount = summary?.changeVsPrevClosed?.amount || 0;
  const changePct = summary?.changeVsPrevClosed?.pct;
  const growthUp = changeAmount >= 0;
  const top10 = summary?.top10 || [];
  const riskLevel = summary?.risk?.level || 'low';
  const riskLabel = riskLevel === 'high' ? 'High Risk' : riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk';
  const riskPillClass = riskLevel === 'high'
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : riskLevel === 'medium'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Debtors</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Receivables intelligence based on monthly snapshots</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <Users className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Debtors</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(summary?.totalBalance || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle" className={growthUp ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              {growthUp ? <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <TrendingDown className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Change vs Last Closed</p>
              <p className={`text-xl font-semibold ${growthUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {changePct === null || changePct === undefined ? '—' : `${growthUp ? '+' : ''}${changePct.toFixed(1)}%`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatCurrency(changeAmount)}</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <Users className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Concentration</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {summary?.concentration?.top1Pct?.toFixed?.(0) ?? 0}% / {summary?.concentration?.top5Pct?.toFixed?.(0) ?? 0}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Top 1 / Top 5</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
              <AlertTriangle className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Risk</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${riskPillClass}`}>
                {riskLabel}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="default">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top 10 Debtors</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Debtor</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Closing Balance</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {top10.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-500 dark:text-slate-400">No data</td>
                  </tr>
                ) : (
                  top10.map((row: any) => (
                    <tr key={row.guid || row.name} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{row.name}</td>
                      <td className="py-3 px-4 text-right text-gray-900 dark:text-gray-100">{formatCurrency(row.balance)}</td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{(row.sharePct || 0).toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card variant="subtle">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Summary</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {riskLevel === 'high'
              ? 'Receivables are highly concentrated. Monitor top counterparties closely.'
              : 'Debtors look stable based on the latest balance snapshot.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
