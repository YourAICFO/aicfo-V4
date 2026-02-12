import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { adminApi } from '../services/api';

type AnyObject = Record<string, any>;

const StatCard = ({ label, value, tone = 'text-gray-900' }: { label: string; value: string | number; tone?: string }) => (
  <div className="card">
    <p className="text-sm text-gray-600">{label}</p>
    <p className={`text-2xl font-bold ${tone}`}>{value}</p>
  </div>
);

export default function AdminControlTower() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [system, setSystem] = useState<AnyObject>({});
  const [business, setBusiness] = useState<AnyObject>({});
  const [usage, setUsage] = useState<AnyObject>({});
  const [ai, setAi] = useState<AnyObject>({});
  const [accounting, setAccounting] = useState<AnyObject>({});
  const [risk, setRisk] = useState<AnyObject>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [systemRes, businessRes, usageRes, aiRes, accountingRes, riskRes] = await Promise.all([
          adminApi.getSystemMetrics(),
          adminApi.getBusinessMetrics(),
          adminApi.getUsageMetrics(),
          adminApi.getAIMetrics(),
          adminApi.getAccountingMetrics(),
          adminApi.getRiskMetrics()
        ]);

        setSystem(systemRes.data?.data || {});
        setBusiness(businessRes.data?.data || {});
        setUsage(usageRes.data?.data || {});
        setAi(aiRes.data?.data || {});
        setAccounting(accountingRes.data?.data || {});
        setRisk(riskRes.data?.data || {});
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load admin metrics');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const businessChartData = useMemo(() => business?.companies_created_per_month || [], [business]);
  const unansweredData = useMemo(
    () => (ai?.top_unanswered_questions || []).map((item: AnyObject, idx: number) => ({
      name: item.question || `Q${idx + 1}`,
      count: Number(item.count || 0)
    })),
    [ai]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-red-600 font-medium">Failed to load Control Tower</p>
        <p className="text-sm text-gray-600 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Control Tower</h1>
        <p className="text-gray-600">System health, business metrics, AI quality, accounting coverage and risk posture.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="DB Status" value={system.db_status || '-'} tone={system.db_status === 'up' ? 'text-green-700' : 'text-red-700'} />
          <StatCard label="Redis Status" value={system.redis_status || '-'} tone={system.redis_status === 'up' ? 'text-green-700' : 'text-red-700'} />
          <StatCard label="Worker Status" value={system.worker_status || '-'} tone={system.worker_status === 'up' ? 'text-green-700' : 'text-amber-700'} />
          <StatCard label="Queue Depth" value={Number(system.queue_depth || 0)} />
          <StatCard label="Failed Jobs (24h)" value={Number(system.failed_jobs_24h || 0)} tone={Number(system.failed_jobs_24h || 0) > 0 ? 'text-red-700' : 'text-green-700'} />
          <StatCard label="Error Logs (24h)" value={Number(system.error_logs_24h || 0)} tone={Number(system.error_logs_24h || 0) > 0 ? 'text-red-700' : 'text-green-700'} />
          <StatCard label="Warn Logs (24h)" value={Number(system.warn_logs_24h || 0)} />
          <StatCard label="Pending Migrations" value={Number(system.pending_migrations || 0)} tone={Number(system.pending_migrations || 0) > 0 ? 'text-amber-700' : 'text-green-700'} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Business Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard label="Total Companies" value={Number(business.total_companies || 0)} />
          <StatCard label="Active Companies" value={Number(business.active_companies || 0)} />
          <StatCard label="Trial Companies" value={Number(business.trial_companies || 0)} />
          <StatCard label="Paying Companies" value={Number(business.paying_companies || 0)} />
          <StatCard label="Trial to Paid %" value={`${Number(business.conversion_trial_to_paid || 0)}%`} />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Companies Created per Month</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={businessChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1d4ed8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <StatCard label="DAU" value={Number(usage.DAU || 0)} />
          <StatCard label="WAU" value={Number(usage.WAU || 0)} />
          <StatCard label="MAU" value={Number(usage.MAU || 0)} />
          <StatCard label="Questions/User" value={Number(usage.questions_per_user || 0)} />
          <StatCard label="Reports Generated" value={Number(usage.reports_generated || 0)} />
          <StatCard label="Snapshot Runs" value={Number(usage.snapshot_runs || 0)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">AI Quality</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard label="Total AI Questions" value={Number(ai.ai_questions_total || 0)} />
          <StatCard label="Unanswered" value={Number(ai.unanswered_questions || 0)} tone={Number(ai.unanswered_questions || 0) > 0 ? 'text-red-700' : 'text-green-700'} />
          <StatCard label="Deterministic Hit Rate" value={`${Number(ai.deterministic_hit_rate || 0)}%`} />
          <StatCard label="LLM Fallback Rate" value={`${Number(ai.llm_fallback_rate || 0)}%`} />
          <StatCard label="Avg Answer Time (ms)" value={Number(ai.avg_answer_time || 0)} />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Top Unanswered Questions</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unansweredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Accounting Coverage</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Ledgers Total" value={Number(accounting.ledgers_total || 0)} />
          <StatCard label="Ledgers Mapped" value={Number(accounting.ledgers_mapped || 0)} />
          <StatCard label="Mapping Coverage" value={`${Number(accounting.mapping_coverage_percent || 0)}%`} />
          <StatCard label="Months Ingested" value={Number(accounting.months_ingested || 0)} />
          <StatCard label="Months Snapshotted" value={Number(accounting.months_snapshotted || 0)} />
          <StatCard label="Snapshot Row Count" value={Number(accounting.snapshot_row_counts || 0)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Risk Alerts</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="No Mapping" value={Number(risk.companies_no_mapping || 0)} tone={Number(risk.companies_no_mapping || 0) > 0 ? 'text-amber-700' : 'text-green-700'} />
          <StatCard label="No Snapshots" value={Number(risk.companies_no_snapshots || 0)} tone={Number(risk.companies_no_snapshots || 0) > 0 ? 'text-amber-700' : 'text-green-700'} />
          <StatCard label="Stale Sync" value={Number(risk.stale_sync_companies || 0)} tone={Number(risk.stale_sync_companies || 0) > 0 ? 'text-red-700' : 'text-green-700'} />
          <StatCard label="Anomaly Companies" value={Number(risk.anomaly_companies || 0)} tone={Number(risk.anomaly_companies || 0) > 0 ? 'text-red-700' : 'text-green-700'} />
        </div>
      </section>
    </div>
  );
}
