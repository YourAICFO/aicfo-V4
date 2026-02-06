import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles, LineChart, Wallet, PlugZap, CheckCircle2 } from 'lucide-react';

export default function Home() {
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
              <p className="text-lg font-semibold">Finance OS</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-200 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#insights" className="hover:text-white">Insights</a>
            <a href="#security" className="hover:text-white">Security</a>
            <a href="#pricing" className="hover:text-white">Plans</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-200 hover:text-white">
              Sign in
            </Link>
            <Link to="/register" className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-300">
              Start free
            </Link>
          </div>
        </header>

        <section className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-14">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <Sparkles className="h-4 w-4" />
                AI-powered finance for founders
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                A trustworthy CFO brain for your business.
              </h1>
              <p className="mt-5 text-lg text-slate-200/80">
                Track revenue, expenses, cash flow, and runway in real time. Get AI insights, forecasts,
                and recommendations that keep you in control without the spreadsheets.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link to="/register" className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-300">
                  Create your account
                </Link>
                <Link to="/login" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40 hover:text-white">
                  View demo dashboard
                </Link>
              </div>
              <div className="mt-8 grid gap-4 text-sm text-slate-200/80 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <p className="text-2xl font-semibold text-white">6.2x</p>
                  <p>Faster monthly close</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <p className="text-2xl font-semibold text-white">94%</p>
                  <p>Cash flow accuracy</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <p className="text-2xl font-semibold text-white">24/7</p>
                  <p>AI CFO guidance</p>
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
                    <p className="mt-2 text-3xl font-semibold text-white">$482,300</p>
                    <p className="text-sm text-emerald-300">+12% vs last month</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                      <p className="text-xs uppercase text-slate-400">Monthly Inflow</p>
                      <p className="mt-2 text-xl font-semibold">$92,400</p>
                      <p className="text-xs text-slate-400">Trailing 6 months</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                      <p className="text-xs uppercase text-slate-400">Monthly Outflow</p>
                      <p className="mt-2 text-xl font-semibold">$61,200</p>
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
              <div className="absolute -bottom-10 -left-8 hidden rounded-2xl bg-white/10 p-4 text-xs text-slate-200 ring-1 ring-white/10 backdrop-blur md:block">
                <p className="font-semibold text-emerald-200">AI Insight</p>
                <p className="mt-2">Revenue concentration risk detected in top 2 clients.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-emerald-200/80">Built for clarity</p>
            <h2 className="text-3xl font-semibold">Finance operations, finally unified.</h2>
          </div>
          <p className="max-w-xl text-sm text-slate-300">
            Keep every financial signal in one place: transactions, cash balance, revenue, expenses, and AI-led decisions.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <LineChart className="h-6 w-6 text-emerald-200" />,
              title: 'Live runway and cash flow',
              body: 'Instant runway tracking with real-time inflow and outflow analysis across accounts.',
            },
            {
              icon: <Sparkles className="h-6 w-6 text-sky-200" />,
              title: 'AI decision support',
              body: 'Get daily recommendations on cost savings, pricing, and funding readiness.',
            },
            {
              icon: <Wallet className="h-6 w-6 text-teal-200" />,
              title: 'Revenue intelligence',
              body: 'Measure growth, detect dips early, and quantify the impact of new revenue streams.',
            },
            {
              icon: <PlugZap className="h-6 w-6 text-emerald-200" />,
              title: 'Fast integrations',
              body: 'Connect Tally, Zoho, or QuickBooks and keep manual entries in sync.',
            },
            {
              icon: <ShieldCheck className="h-6 w-6 text-sky-200" />,
              title: 'Bank-grade security',
              body: 'Role-based access controls, audit trails, and secure storage for every transaction.',
            },
            {
              icon: <CheckCircle2 className="h-6 w-6 text-teal-200" />,
              title: 'Clean financial statements',
              body: 'Generate P&L, balance sheets, and cash flow statements with CFO-grade rigor.',
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

      <section id="insights" className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
            <p className="text-sm text-emerald-200/80">AI CFO Playbooks</p>
            <h2 className="mt-3 text-3xl font-semibold">Move from reactive to predictive.</h2>
            <p className="mt-4 text-sm text-slate-300">
              Your AI CFO watches for margin erosion, vendor bloat, and revenue concentration risks.
              It delivers playbooks you can act on immediately.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>Identify 3-5 highest ROI cost cuts.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>Forecast cash runway with best/worst scenarios.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>Highlight growth signals from revenue cohorts.</span>
              </li>
            </ul>
          </div>
          <div className="grid gap-4">
            {[
              { title: 'Cost Optimization', detail: 'Switch 2 vendor contracts to annual billing to save $8.4k.' },
              { title: 'Growth Opportunity', detail: 'Upsell consulting clients with bundled audits for +18% margin.' },
              { title: 'Risk Alert', detail: 'Cash coverage dips below 4 months if payroll grows by 12%.' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-slate-900/70 p-6 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">Actionable</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-10 ring-1 ring-white/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-emerald-200/80">Trusted by finance teams</p>
              <h2 className="mt-2 text-3xl font-semibold">Security and ownership, built in.</h2>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-200/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>Encrypted data storage and audit logs</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span>Role-based access and exportable reports</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-3xl bg-white/5 p-10 ring-1 ring-white/10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold">Start with the free trial.</h2>
              <p className="mt-2 text-sm text-slate-300">
                Unlock AI insights, live dashboards, and monthly statements in minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-300">
                Start free trial
              </Link>
              <Link to="/login" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40 hover:text-white">
                Talk to sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 pb-10 pt-8 text-center text-xs text-slate-400">
        Built for finance leaders who want clarity and control.
      </footer>
    </div>
  );
}
