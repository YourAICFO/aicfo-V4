import { Link } from 'react-router-dom';
import { Sparkles, LineChart, Wallet, PlugZap, CheckCircle2 } from 'lucide-react';
import VersionDisplay from '../components/VersionDisplay';

export default function Home() {
  const backendUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080';
  const connectorDownloadUrl = `${backendUrl}/download/connector`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute top-32 -left-20 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-400/10 blur-3xl" />
        </div>

        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
              <Wallet className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm text-emerald-200/80">AI CFO</p>
              <p className="text-lg font-semibold">AI CFO</p>
            </div>
          </div>
            <nav className="hidden items-center gap-6 text-sm text-slate-200 md:flex">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#pricing" className="hover:text-white">Pricing</a>
              <a href={connectorDownloadUrl} className="hover:text-white">Download Connector</a>
            </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-200 hover:text-white">
              Log in
            </Link>
            <Link to="/register" className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-300">
              Get Started
            </Link>
          </div>
        </header>

        <section className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-14">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <Sparkles className="h-4 w-4" />
                Built for Indian SMEs
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Your AI-Powered CFO for
                <span className="block text-emerald-200">Smarter Financial Decisions</span>
              </h1>
              <p className="mt-5 text-lg text-slate-200/80">
                Stop guessing about your finances. Get clear visibility into cash health, revenue trends,
                and expenses—with AI insights that help you make confident decisions.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link to="/register" className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-300">
                  Start your 30-day free trial
                </Link>
                <Link to="/login" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40 hover:text-white">
                  View Demo Dashboard
                </Link>
              </div>
              <div className="mt-8 grid gap-4 text-sm text-slate-200/80 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  Understand your cash runway in seconds
                </div>
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  Detect overspending before it hurts
                </div>
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  Get answers to financial questions 24/7
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl bg-slate-900/70 p-6 ring-1 ring-white/10 backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-300">Runway Snapshot</p>
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">Healthy</span>
                </div>
                <div className="mt-6 space-y-5">
                  <div className="rounded-2xl bg-slate-950/70 p-4 ring-1 ring-white/5">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Cash Balance</p>
                    <p className="mt-2 text-3xl font-semibold text-white">₹48,23,000</p>
                    <p className="text-sm text-emerald-300">+12% vs last month</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                      <p className="text-xs uppercase text-slate-400">Monthly Inflow</p>
                      <p className="mt-2 text-xl font-semibold">₹9,24,000</p>
                      <p className="text-xs text-slate-400">Trailing 6 months</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                      <p className="text-xs uppercase text-slate-400">Monthly Outflow</p>
                      <p className="mt-2 text-xl font-semibold">₹6,12,000</p>
                      <p className="text-xs text-slate-400">Trailing 6 months</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-r from-emerald-500/20 to-sky-500/20 p-4 ring-1 ring-white/10">
                    <p className="text-xs uppercase text-slate-200/70">AI Recommendation</p>
                    <p className="mt-2 text-sm text-slate-100">
                      Extend runway to 11 months by adjusting software spend and renegotiating two vendor contracts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-emerald-200/80">Everything You Need to Manage Finances</p>
            <h2 className="text-3xl font-semibold">
              A complete financial intelligence platform designed specifically for Indian founders and SMEs.
            </h2>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <LineChart className="h-6 w-6 text-emerald-200" />,
              title: 'Cash Health Monitoring',
              body: 'Real-time visibility into your cash position, runway, and burn rate with automatic risk assessment.',
            },
            {
              icon: <Wallet className="h-6 w-6 text-teal-200" />,
              title: 'Revenue & Expense Analytics',
              body: 'Understand your money flow with clear breakdowns, trends, and month-over-month comparisons.',
            },
            {
              icon: <Sparkles className="h-6 w-6 text-sky-200" />,
              title: 'AI-Powered Insights',
              body: 'Get CFO-grade analysis and recommendations based on your actual financial data.',
            },
            {
              icon: <PlugZap className="h-6 w-6 text-emerald-200" />,
              title: 'Tally Integration',
              body: 'Connect your Tally software for automatic data sync with real-time reconciliation.',
            },
            {
              icon: <CheckCircle2 className="h-6 w-6 text-sky-200" />,
              title: 'Risk Detection',
              body: 'Early warnings for cash risks, expense spikes, and revenue declines before they become problems.',
            },
            {
              icon: <CheckCircle2 className="h-6 w-6 text-teal-200" />,
              title: 'Simple, Transparent Pricing',
              body: 'Start your 30-day free trial, then ₹4,999/month.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                {item.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-3xl bg-white/5 p-10 ring-1 ring-white/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-emerald-200/80">Simple, Transparent Pricing</p>
              <h2 className="text-3xl font-semibold">Start your 30-day free trial.</h2>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-1">
            <div className="relative rounded-3xl bg-emerald-500/10 p-8 ring-2 ring-emerald-300/40">
              <span className="absolute -top-3 right-6 rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold text-slate-900">
                30-Day Trial
              </span>
              <p className="text-sm text-emerald-200/90">AI CFO</p>
              <h3 className="mt-2 text-xl font-semibold">Full AI CFO experience</h3>
              <p className="mt-4 text-3xl font-semibold">₹4,999/month</p>
              <p className="mt-2 text-sm text-emerald-100/80">After your 30-day free trial</p>
              <ul className="mt-6 space-y-2 text-sm text-slate-200">
                <li>Tally integration</li>
                <li>AI CFO insights</li>
                <li>Priority alerts</li>
                <li>AI chat assistant</li>
                <li>Advanced dashboards</li>
              </ul>
              <Link to="/register" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-300">
                Start your 30-day free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 pb-10 pt-8 text-center text-xs text-slate-400">
        <p>AI CFO provides decision support, not statutory advice.</p>
        <p className="mt-2">© 2024 AI CFO. All rights reserved.</p>
        <div className="mt-4 flex justify-center">
          <VersionDisplay />
        </div>
      </footer>
    </div>
  );
}
