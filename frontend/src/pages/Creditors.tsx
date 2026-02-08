import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Users } from 'lucide-react';
import { financeApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function Creditors() {
  const [summary, setSummary] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadData();
  }, [selectedCompanyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryRes, topRes] = await Promise.all([
        financeApi.getCreditorsSummary(),
        financeApi.getCreditorsTop()
      ]);
      setSummary(summaryRes.data.data);
      setTop(topRes.data.data || []);
    } catch (error) {
      console.error('Failed to load creditors data:', error);
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

  const growthUp = (summary?.creditorGrowth || 0) >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Creditors</h1>
        <p className="text-gray-600">Payables intelligence based on monthly snapshots</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card border-transparent bg-gradient-to-br from-white to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Creditors</p>
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
              <p className="text-sm text-gray-600">MoM Creditors Growth</p>
              <p className={`text-2xl font-bold ${growthUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(summary?.creditorGrowth || 0) >= 0 ? '+' : ''}{((summary?.creditorGrowth || 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
        <div className="card border-transparent bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-slate-100">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Concentration (Top 5)</p>
              <p className="text-2xl font-bold">{((summary?.concentrationRatio || 0) * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Top 10 Creditors</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Creditor</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Closing Balance</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {top.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500">No data</td>
                </tr>
              ) : (
                top.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">{row.creditor_name || row.creditorName}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(row.closing_balance || row.closingBalance)}</td>
                    <td className="py-3 px-4 text-right">{((row.percentage_of_total || row.percentageOfTotal || 0) * 100).toFixed(1)}%</td>
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
          {summary?.cashPressure
            ? 'Creditors outstanding exceed cash balance. Review payment schedule.'
            : 'Creditors look stable based on the latest closed month.'}
        </p>
      </div>
    </div>
  );
}
