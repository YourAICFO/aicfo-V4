import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { companyApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function CreateCompany() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSelectedCompany } = useAuthStore();

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await companyApi.create({
        name,
        industry,
        currency,
      });

      const companyId = response.data?.data?.id;
      if (companyId) {
        setSelectedCompany(companyId);
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemo = async () => {
    setError('');
    setDemoLoading(true);
    try {
      const response = await companyApi.createDemo();
      const companyId = response.data?.data?.id;
      if (companyId) {
        setSelectedCompany(companyId);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create demo company');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-6">Create Company</h2>

        {(location.state as any)?.message && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {(location.state as any)?.message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Company Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Industry</label>
            <input
              className="input"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Currency</label>
            <select
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || demoLoading}
            className="btn-primary w-full py-3"
          >
            {loading ? 'Creating...' : 'Create Company'}
          </button>

          <div className="relative my-4">
            <span className="block text-center text-sm text-gray-500">or</span>
          </div>

          <button
            type="button"
            disabled={loading || demoLoading}
            onClick={handleCreateDemo}
            className="w-full py-3 rounded-lg border border-primary-500 text-primary-600 hover:bg-primary-50 font-medium"
          >
            {demoLoading ? 'Creating...' : 'Create Demo Company'}
          </button>
        </form>
      </div>
    </div>
  );
}
