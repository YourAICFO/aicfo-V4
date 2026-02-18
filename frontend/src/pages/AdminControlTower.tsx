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
  const [windowDays, setWindowDays] = useState<7 | 30>(30);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<AnyObject>({});
  const [system, setSystem] = useState<AnyObject>({});
  const [business, setBusiness] = useState<AnyObject>({});
  const [usage, setUsage] = useState<AnyObject>({});
  const [ai, setAi] = useState<AnyObject>({});
  const [connector, setConnector] = useState<AnyObject>({});
  const [accounting, setAccounting] = useState<AnyObject>({});
  const [risk, setRisk] = useState<AnyObject>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [summaryRes, systemRes, businessRes, usageRes, aiRes, connectorRes, accountingRes, riskRes] = await Promise.all([
          adminApi.getMetricsSummary(),
          adminApi.getSystemMetrics(),
          adminApi.getBusinessMetrics(),
          adminApi.getUsageMetrics(),
          adminApi.getAIMetrics(windowDays),
          adminApi.getConnectorMetrics(windowDays),
          adminApi.getAccountingMetrics(),
          adminApi.getRiskMetrics()
        ]);

        setSummary(summaryRes.data?.data || {});
        setSystem(systemRes.data?.data || {});
        setBusiness(businessRes.data?.data || {});
        setUsage(usageRes.data?.data || {});
        setAi(aiRes.data?.data || {});
        setConnector(connectorRes.data?.data || {});
        setAccounting(accountingRes.data?.data || {});
        setRisk(riskRes.data?.data || {});
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load admin metrics');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [windowDays]);

  const businessChartData = useMemo(() => business?.companies_created_per_month || [], [business]);
  const unansweredData = useMemo(
    () => (ai?.top_unanswered_questions || []).map((item: AnyObject, idx: number) => ({
      name: item.question || `Q${idx + 1}`,
      count: Number(item.count || 0)
    })),
    [ai]
  );
  const filteredConnectorFailures = useMemo(() => {
    const value = search.trim().toLowerCase();
    const rows = connector?.recent_failures || [];
    if (!value) return rows;
    return rows.filter((row: AnyObject) =>
      [row.company_name, row.user_email, row.tally_company_name, row.last_sync_error]
        .filter(Boolean)
        .some((item: string) => item.toLowerCase().includes(value))
    );
  }, [connector, search]);
  const filteredAIFailures = useMemo(() => {
    const value = search.trim().toLowerCase();
    const rows = ai?.recent_failures || [];
    if (!value) return rows;
    return rows.filter((row: AnyObject) =>
      [row.question, row.key, row.company_name, row.user_email]
        .filter(Boolean)
        .some((item: string) => item.toLowerCase().includes(value))
    );
  }, [ai, search]);

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
        <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard label="Total Users" value={Number(summary.users_total || business.total_users || 0)} />
          <StatCard label="Total Companies" value={Number(business.total_companies || summary.companies_total || 0)} />
          <StatCard label="Deleted Companies" value={Number(business.deleted_companies || 0)} />
          <StatCard label="Trialing Subs" value={Number(business.subscription_statuses?.trialing || 0)} />
          <StatCard label="Active Subs" value={Number(business.subscription_statuses?.active || 0)} />
        </div>
      </section>

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
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setWindowDays(7)}
              className={`rounded px-3 py-1 text-sm ${windowDays === 7 ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Last 7d
            </button>
            <button
              type="button"
              onClick={() => setWindowDays(30)}
              className={`rounded px-3 py-1 text-sm ${windowDays === 30 ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Last 30d
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or email"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold mb-3">Top Missing Metric Keys</h3>
            <ul className="space-y-2 text-sm">
              {(ai?.top_missing_metric_keys || []).map((row: AnyObject) => (
                <li key={row.metric_key} className="flex justify-between">
                  <span>{row.metric_key}</span>
                  <span className="text-gray-500">{row.count}</span>
                </li>
              ))}
              {(!ai?.top_missing_metric_keys || ai.top_missing_metric_keys.length === 0) && <li className="text-gray-500">No missing metrics</li>}
            </ul>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-3">Top Detected Question Failures</h3>
            <ul className="space-y-2 text-sm">
              {(ai?.top_detected_question_failures || []).map((row: AnyObject) => (
                <li key={row.key} className="flex justify-between">
                  <span>{row.key}</span>
                  <span className="text-gray-500">{row.count}</span>
                </li>
              ))}
              {(!ai?.top_detected_question_failures || ai.top_detected_question_failures.length === 0) && <li className="text-gray-500">No failures</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Connector Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Linked Companies" value={Number(connector.linked_companies || 0)} />
          <StatCard label="Sync Success" value={Number(connector.sync_status_counts?.success || 0)} />
          <StatCard label="Sync Failed" value={Number(connector.sync_status_counts?.failed || 0)} tone={Number(connector.sync_status_counts?.failed || 0) > 0 ? 'text-red-700' : 'text-green-700'} />
          <StatCard label="Syncing" value={Number(connector.sync_status_counts?.syncing || 0)} />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Devices & Last Heartbeat</h3>
          <div className="space-y-2 text-sm">
            {(connector?.devices || []).slice(0, 10).map((row: AnyObject, idx: number) => (
              <div key={`${row.device_id}-${idx}`} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                <div>
                  <div className="font-medium">{row.device_name || row.device_id}</div>
                  <div className="text-gray-500">{row.company_name || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="capitalize">{row.status || '-'}</div>
                  <div className="text-gray-500">{row.last_seen_at ? new Date(row.last_seen_at).toLocaleString('en-IN') : '-'}</div>
                </div>
              </div>
            ))}
            {(!connector?.devices || connector.devices.length === 0) && <div className="text-gray-500">No connector devices</div>}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-3">Recent Connector Failures</h3>
          <div className="space-y-2 text-sm">
            {filteredConnectorFailures.slice(0, 20).map((row: AnyObject, idx: number) => (
              <div key={`${row.id}-${idx}`} className="rounded border border-red-100 bg-red-50 p-3">
                <div className="font-medium">{row.company_name || '-'}</div>
                <div className="text-gray-600">{row.user_email || '-'}</div>
                <div className="text-gray-600">{row.tally_company_name || '-'}</div>
                <div className="text-red-700">{row.last_sync_error || 'Sync failed'}</div>
              </div>
            ))}
            {filteredConnectorFailures.length === 0 && <div className="text-gray-500">No recent connector failures</div>}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">AI Feedback Loop</h2>
        <div className="card">
          <h3 className="font-semibold mb-3">Recent Unanswered Questions</h3>
          <div className="space-y-2 text-sm">
            {filteredAIFailures.slice(0, 20).map((row: AnyObject, idx: number) => (
              <div key={`${row.id}-${idx}`} className="rounded border border-amber-100 bg-amber-50 p-3">
                <div className="font-medium">{row.question}</div>
                <div className="text-gray-600">{row.key || '-'}</div>
                <div className="text-gray-600">{row.company_name || '-'} · {row.user_email || '-'}</div>
              </div>
            ))}
            {filteredAIFailures.length === 0 && <div className="text-gray-500">No unanswered questions in selected window</div>}
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
