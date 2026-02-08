import { useEffect, useState } from 'react';
import { adminApi } from '../services/api';

export default function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryRes, questionRes, companiesRes] = await Promise.all([
        adminApi.getUsageSummary(),
        adminApi.getAIQuestions(),
        adminApi.getCompaniesActivity()
      ]);
      setSummary(summaryRes.data.data);
      setQuestions(questionRes.data.data?.topQuestions || []);
      setCompanies(companiesRes.data.data || []);
    } catch (error) {
      console.error('Admin dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Usage and AI analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Companies</p>
          <p className="text-2xl font-bold">{summary?.companiesCount || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Active Users (30d)</p>
          <p className="text-2xl font-bold">{summary?.activeUsers || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">AI Questions</p>
          <p className="text-2xl font-bold">{summary?.aiQuestions || 0}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Top Questions</h2>
        <ul className="space-y-2">
          {questions.length === 0 ? (
            <li className="text-gray-500">No data</li>
          ) : (
            questions.map((q, i) => (
              <li key={`${q.question}-${i}`} className="flex justify-between">
                <span className="text-gray-700">{q.question}</span>
                <span className="text-gray-500">{q.count}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Company Activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Company</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Events</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-500">No data</td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">{c.name}</td>
                    <td className="py-3 px-4 text-right">{c.events}</td>
                    <td className="py-3 px-4 text-right">{c.last_seen ? new Date(c.last_seen).toLocaleString('en-IN') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
