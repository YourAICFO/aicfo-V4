import React from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Wallet,
  TrendingUp,
  Activity,
  FileText,
  Shield,
  Lock,
  Cpu,
  Sparkles,
  MessageSquare,
  Lightbulb,
  User,
  Briefcase,
  Scale,
  ArrowRight,
  Check,
} from 'lucide-react';
import SEOMetaTags from '../components/seo/SEOMetaTags';

const SEOOptimizedHome: React.FC = () => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AI CFO',
    url: 'https://aicfo.in',
    description: 'AI-powered financial intelligence platform for Indian SMEs',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://aicfo.in/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AI CFO',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '4999',
      priceCurrency: 'INR',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '4999',
        priceCurrency: 'INR',
        unitText: 'month',
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '127',
    },
  };

  const sectionSpacing = 'py-16 md:py-20';
  const containerClass = 'mx-auto w-full max-w-6xl px-6';
  const headingClass = 'text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl';
  const subheadingClass = 'mt-2 text-sm text-slate-600 dark:text-slate-400';
  const cardClass = 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm';

  // Assets are served from frontend/public → /landing/* (SVG defaults; PNG used when present)
  const HeroIllustration = () => (
    <div className="relative w-full max-w-lg mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 shadow-lg p-4">
      <picture>
        <source srcSet="/landing/hero.png" type="image/png" />
        <img
          src="/landing/hero.svg"
          alt="AI CFO dashboard preview"
          className="w-full h-auto block object-contain"
          style={{ minHeight: 240 }}
        />
      </picture>
      {import.meta.env.DEV && (
        <div className="mt-2 text-xs text-slate-400">
          img src: /landing/hero.svg · <a href="/landing/hero.svg" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Open SVG</a>
        </div>
      )}
    </div>
  );

  return (
    <>
      <SEOMetaTags
        title="AI CFO - Financial Intelligence for Indian SMEs"
        description="Clear visibility into cash health, P&L, working capital, and data quality. Bank-grade security, read-only access, signed connector. 30-day free trial."
        keywords={[
          'AI CFO',
          'financial intelligence platform',
          'cash flow management',
          'revenue analytics',
          'expense tracking',
          'Tally integration',
          'Indian SMEs',
          'financial dashboard',
          'AI insights',
          'business finance',
          'cash runway calculator',
          'financial planning',
          'SME finance',
          'startup finance',
        ]}
        ogImage="/og-homepage.jpg"
        ogType="website"
        twitterCard="summary_large_image"
        canonicalUrl="/"
        structuredData={[structuredData, productSchema]}
      />

      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        {/* ——— Hero ——— */}
        <section className="relative overflow-hidden border-b border-slate-200 dark:border-white/10 bg-gradient-to-b from-white to-slate-50/80 dark:from-slate-900/50 dark:to-slate-950" aria-labelledby="hero-heading">
          <div className="absolute top-0 right-0 h-[320px] w-[320px] rounded-full bg-blue-400/10 dark:bg-blue-500/10 blur-3xl" aria-hidden="true" />

          <header className={`relative ${containerClass} flex items-center justify-between py-6`} role="banner">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 dark:bg-blue-500/20 border border-blue-400/30">
                <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              </div>
              <span className="text-base font-semibold text-slate-900 dark:text-white">AI CFO</span>
            </div>
            <nav className="hidden items-center gap-6 text-sm text-slate-600 dark:text-slate-400 md:flex" role="navigation" aria-label="Main navigation">
              <a href="#what-you-get" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
              <a href="#security" className="hover:text-slate-900 dark:hover:text-white transition-colors">Security</a>
              <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                Get started
              </Link>
            </div>
          </header>

          <div className={`relative ${containerClass} pb-16 pt-8 md:pt-12 lg:pt-16`}>
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 lg:items-center">
              <div>
                <h1 id="hero-heading" className={headingClass}>
                  Financial intelligence for Indian SMEs
                </h1>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                  P&L, working capital, cashflow, and data health in one place. Connect Tally once—get runway, alerts, and on-demand AI narrative. Read-only layer. No guesswork.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                  >
                    Start 30-day free trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center rounded-lg border border-slate-300 dark:border-white/20 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-white/40 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    View demo
                  </Link>
                </div>
                <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    Read-only · no write-back
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    30-day free trial
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    Bank-grade security
                  </li>
                </ul>
              </div>
              <div className="flex justify-center lg:justify-end">
                <HeroIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* ——— Social proof ——— */}
        <section className={`${sectionSpacing} border-b border-slate-200 dark:border-white/10`} aria-label="Social proof">
          <div className={containerClass}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              <div className={cardClass}>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">500+</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">SMEs</p>
              </div>
              <div className={cardClass}>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">₹50Cr+</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Cash analyzed</p>
              </div>
              <div className={cardClass}>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">4.8/5</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Rating</p>
              </div>
              <div className={cardClass}>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">Read-only</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">No write-back</p>
              </div>
            </div>
          </div>
        </section>

        {/* ——— See it in action ——— */}
        <section id="see-it-in-action" className={sectionSpacing} aria-labelledby="preview-heading">
          <div className={containerClass}>
            <h2 id="preview-heading" className={headingClass}>
              See it in action
            </h2>
            <p className={subheadingClass}>
              P&L Pack and Data Health—two core views that give you clarity on numbers and data quality.
            </p>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 shadow-sm p-3">
                  <picture>
                    <source srcSet="/landing/pl-pack.png" type="image/png" />
                    <img
                      src="/landing/pl-pack.svg"
                      alt="P&L Pack preview"
                      className="w-full h-auto block object-contain"
                      style={{ minHeight: 200 }}
                    />
                  </picture>
                  {import.meta.env.DEV && (
                    <div className="mt-2 text-xs text-slate-400">
                      img src: /landing/pl-pack.svg · <a href="/landing/pl-pack.svg" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Open SVG</a>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">P&L Pack — revenue, expenses, drivers, AI narrative</p>
              </div>
              <div className="space-y-2">
                <div className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 shadow-sm p-3">
                  <picture>
                    <source srcSet="/landing/data-health.png" type="image/png" />
                    <img
                      src="/landing/data-health.svg"
                      alt="Data Health preview"
                      className="w-full h-auto block object-contain"
                      style={{ minHeight: 200 }}
                    />
                  </picture>
                  {import.meta.env.DEV && (
                    <div className="mt-2 text-xs text-slate-400">
                      img src: /landing/data-health.svg · <a href="/landing/data-health.svg" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Open SVG</a>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Data Health — coverage, sync status, impact</p>
              </div>
            </div>
          </div>
        </section>

        {/* ——— What you get ——— */}
        <section id="what-you-get" className={`${sectionSpacing} border-b border-slate-200 dark:border-white/10`} aria-labelledby="what-you-get-heading">
          <div className={containerClass}>
            <h2 id="what-you-get-heading" className={headingClass}>
              What you get
            </h2>
            <p className={subheadingClass}>
              One platform: command center, P&L pack, working capital, cashflow, data health, and monthly report.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: BarChart3, title: 'P&L Pack', desc: 'Month-wise revenue, expenses, drivers, and optional AI narrative.' },
                { icon: Wallet, title: 'Working capital', desc: 'NWC, CCC, DSO/DPO, liquidity, and loans at a glance.' },
                { icon: TrendingUp, title: 'Cashflow', desc: 'Cash & bank movement: inflow, outflow, net—no P&L proxy.' },
                { icon: Activity, title: 'Data health', desc: 'Coverage, sync status, and impact so you know data is ready.' },
                { icon: FileText, title: 'Monthly report', desc: 'Downloadable PDF for the selected closed month.' },
              ].map((item) => (
                <article key={item.title} className={cardClass}>
                  <item.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Security ——— */}
        <section id="security" className={`${sectionSpacing} border-b border-slate-200 dark:border-white/10`} aria-labelledby="security-heading">
          <div className={containerClass}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-10">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-400/20">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              </div>
              <div>
                <h2 id="security-heading" className={headingClass}>
                  Security
                </h2>
                <p className={subheadingClass}>
                  Your data stays protected. We never write back to your books.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>Bank-grade encryption in transit and at rest. Compliant with Indian data norms.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>Signed desktop connector; only syncs what you allow. No direct DB access.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Cpu className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>Read-only layer—AI CFO never posts or changes your books.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ——— AI features ——— */}
        <section className={`${sectionSpacing} border-b border-slate-200 dark:border-white/10`} aria-labelledby="ai-heading">
          <div className={containerClass}>
            <h2 id="ai-heading" className={headingClass}>
              AI features
            </h2>
            <p className={subheadingClass}>
              Clearly labelled AI: on-demand narrative, chat, and insights. You stay in control.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Sparkles, title: 'On-demand narrative', desc: 'CFO-style explanation for the selected month’s P&L and drivers. Generated when you ask, cached per month.' },
                { icon: MessageSquare, title: 'AI chat', desc: 'Ask questions about your financial data in natural language.' },
                { icon: Lightbulb, title: 'AI insights', desc: 'Proactive insights and recommendations based on your numbers.' },
              ].map((item) => (
                <article key={item.title} className={cardClass}>
                  <item.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ——— For whom ——— */}
        <section className={`${sectionSpacing} border-b border-slate-200 dark:border-white/10`} aria-labelledby="for-whom-heading">
          <div className={containerClass}>
            <h2 id="for-whom-heading" className={headingClass}>
              Built for
            </h2>
            <p className={subheadingClass}>
              Founders, finance heads, and practicing CAs who need clarity without the complexity.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { icon: User, title: 'Founder', desc: 'Runway, cashflow, and alerts so you can focus on the business.' },
                { icon: Briefcase, title: 'Finance head', desc: 'P&L pack, working capital, and data health in one dashboard.' },
                { icon: Scale, title: 'Practicing CA', desc: 'Client visibility and report-ready output without touching the client’s books.' },
              ].map((item) => (
                <article key={item.title} className={cardClass}>
                  <item.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Pricing preview ——— */}
        <section id="pricing" className={`${sectionSpacing} border-b border-slate-200 dark:border-white/10`} aria-labelledby="pricing-heading">
          <div className={containerClass}>
            <h2 id="pricing-heading" className={headingClass}>
              Pricing
            </h2>
            <p className={subheadingClass}>
              Simple plans. 30-day free trial. No credit card required to start.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className={`${cardClass} border-blue-500/40 dark:border-blue-500/30`}>
                <h3 className="font-semibold text-slate-900 dark:text-white">Starter</h3>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">₹4,999<span className="text-sm font-normal text-slate-600 dark:text-slate-400">/month</span></p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">After 30-day free trial</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {['Tally integration', 'P&L Pack & Cashflow', 'Working capital', 'Data health', 'Monthly report PDF'].map((x) => (
                    <li key={x} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 dark:bg-blue-500 py-2.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  Start free trial
                </Link>
              </div>
              <div className={cardClass}>
                <h3 className="font-semibold text-slate-900 dark:text-white">Pro</h3>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Contact us</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Higher limits, priority support</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {['Everything in Starter', 'More companies', 'Priority support', 'Custom reporting'].map((x) => (
                    <li key={x} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      {x}
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:sales@aicfo.in"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 dark:border-white/20 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-white/40 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Contact sales
                </a>
              </div>
              <div className={cardClass}>
                <h3 className="font-semibold text-slate-900 dark:text-white">Enterprise</h3>
                <p className="mt-2 text-lg font-semibold text-slate-600 dark:text-slate-400">Contact sales</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">SSO, SLA, dedicated support</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {['Custom deployment', 'SSO & audit logs', 'Dedicated success manager'].map((x) => (
                    <li key={x} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-slate-500 shrink-0" />
                      {x}
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:sales@aicfo.in"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  Contact sales
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Final CTA ——— */}
        <section className={sectionSpacing} aria-labelledby="cta-heading">
          <div className={containerClass}>
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-10 text-center md:p-12 shadow-sm">
              <h2 id="cta-heading" className="text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
                Ready to see your numbers clearly?
              </h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                Join Indian SMEs who use AI CFO for runway, P&L, and data health. No credit card required.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  Start 30-day free trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center rounded-lg border border-slate-300 dark:border-white/20 px-6 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-white/40 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Log in
                </Link>
              </div>
              <p className="mt-6 text-xs text-slate-500">30-day free trial · Cancel anytime · Bank-grade security</p>
            </div>
          </div>
        </section>

        {/* ——— Footer ——— */}
        <footer className="border-t border-slate-200 dark:border-white/10 py-8" role="contentinfo">
          <div className={`${containerClass} flex flex-col items-center gap-4 text-center`}>
            <p className="text-xs text-slate-500">AI CFO provides decision support, not statutory advice.</p>
            <div className="flex flex-wrap justify-center gap-6 text-xs">
              <Link to="/privacy" className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Terms</Link>
              <a href="mailto:support@aicfo.in" className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Support</a>
            </div>
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} AI CFO. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </>
  );
};

export default SEOOptimizedHome;
