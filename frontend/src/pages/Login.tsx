import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ShieldCheck, Sparkles, LineChart } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi, companyApi } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, setSelectedCompany } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login(email, password);

      // DEBUG LOGS
      console.log("FULL RESPONSE:", response.data);

      const { user, token } = response.data.data;

      console.log("TOKEN RECEIVED:", token);

      // Save in Zustand store
      setAuth(user, token);

      console.log("SET AUTH CALLED");

      // Check localStorage after setting auth
      setTimeout(() => {
        console.log(
          "LOCAL STORAGE auth-storage:",
          localStorage.getItem("auth-storage")
        );
      }, 500);

      const companiesResponse = await companyApi.getAll();
      const companies = companiesResponse.data?.data || [];

      if (!companies.length) {
        navigate('/create-company', { state: { message: 'Please create or select a company first.' } });
        return;
      }

      if (!useAuthStore.getState().selectedCompanyId) {
        setSelectedCompany(companies[0].id);
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.log("LOGIN ERROR:", err);
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute top-32 -left-20 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
        </div>

        <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-sm text-emerald-200/80">AI CFO</p>
            <p className="text-lg font-semibold">Finance OS</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-slate-200 hover:text-white"
          >
            Return to home
          </button>
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-6 pb-16 pt-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden rounded-3xl bg-white/5 p-10 ring-1 ring-white/10 lg:block">
            <p className="text-sm text-emerald-200/80">Welcome back</p>
            <h1 className="mt-4 text-3xl font-semibold">Your AI CFO is ready.</h1>
            <p className="mt-4 text-sm text-slate-300">
              Log in to monitor cash runway, track revenue growth, and receive real-time AI recommendations.
            </p>
            <div className="mt-8 space-y-4 text-sm text-slate-200">
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <LineChart className="h-5 w-5 text-emerald-200" />
                <span>Live dashboards for revenue, expenses, and cash flow.</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <Sparkles className="h-5 w-5 text-sky-200" />
                <span>AI insights to cut costs and extend runway.</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <ShieldCheck className="h-5 w-5 text-emerald-200" />
                <span>Secure, compliant, and built for finance teams.</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 text-slate-900 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">Sign In</h2>
              <p className="text-sm text-slate-500">Access your finance workspace</p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" />
                  <span className="text-slate-600">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-primary-600 hover:text-primary-700">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
