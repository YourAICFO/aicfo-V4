import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, LineChart, Wallet, PlugZap, CheckCircle2, ArrowRight, Star, Users, TrendingUp } from 'lucide-react';
import SEOMetaTags from '../components/seo/SEOMetaTags';

const SEOOptimizedHome: React.FC = () => {
  // Structured data for better SEO
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

  const features = [
    {
      icon: <LineChart className="h-6 w-6 text-emerald-200" />,
      title: 'Cash Health Monitoring',
      description: 'Real-time visibility into your cash position, runway, and burn rate with automatic risk assessment.',
    },
    {
      icon: <Wallet className="h-6 w-6 text-teal-200" />,
      title: 'Revenue & Expense Analytics',
      description: 'Understand your money flow with clear breakdowns, trends, and month-over-month comparisons.',
    },
    {
      icon: <Sparkles className="h-6 w-6 text-sky-200" />,
      title: 'AI-Powered Insights',
      description: 'Get CFO-grade analysis and recommendations based on your actual financial data.',
    },
    {
      icon: <PlugZap className="h-6 w-6 text-emerald-200" />,
      title: 'Tally Integration',
      description: 'Connect your Tally software for automatic data sync with real-time reconciliation.',
    },
    {
      icon: <CheckCircle2 className="h-6 w-6 text-sky-200" />,
      title: 'Risk Detection',
      description: 'Early warnings for cash risks, expense spikes, and revenue declines before they become problems.',
    },
  ];

  const testimonials = [
    {
      name: 'Rajesh Kumar',
      role: 'Founder, TechStart Solutions',
      company: 'IT Services',
      rating: 5,
      text: 'AI CFO helped us identify a cash flow issue 3 months before it would have become critical. The Tally integration is seamless.',
    },
    {
      name: 'Priya Sharma',
      role: 'Finance Manager, RetailChain',
      company: 'Retail',
      rating: 5,
      text: 'The AI insights are incredibly accurate. We\'ve reduced unnecessary expenses by 23% in just 2 months.',
    },
    {
      name: 'Amit Patel',
      role: 'CEO, Manufacturing Co.',
      company: 'Manufacturing',
      rating: 5,
      text: 'Finally, a financial tool that speaks our language. The runway calculations have been a game-changer for planning.',
    },
  ];

  const stats = [
    { value: '500+', label: 'SMEs Trust AI CFO', icon: <Users className="h-5 w-5" /> },
    { value: '₹50Cr+', label: 'Cash Analyzed', icon: <TrendingUp className="h-5 w-5" /> },
    { value: '4.8/5', label: 'Average Rating', icon: <Star className="h-5 w-5" /> },
  ];

  return (
    <>
      <SEOMetaTags
        title="AI CFO - Your AI-Powered Financial Intelligence Platform for Indian SMEs"
        description="Stop guessing about your finances. Get clear visibility into cash health, revenue trends, and expenses with AI insights that help Indian SMEs make confident financial decisions. 30-day free trial."
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
          'financial decision making',
          'AI-powered CFO',
          'financial analysis tool',
          'cash management',
          'revenue optimization',
          'expense management'
        ]}
        ogImage="/og-homepage.jpg"
        ogType="website"
        twitterCard="summary_large_image"
        canonicalUrl="/"
        structuredData={[structuredData, productSchema]}
      />

      <main className="min-h-screen bg-slate-950 text-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden" aria-labelledby="hero-heading">
          <div className="absolute inset-0">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="absolute top-32 -left-20 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-400/10 blur-3xl" />
          </div>

          <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6" role="banner">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40" aria-hidden="true">
                <Wallet className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-sm text-emerald-200/80">AI CFO</p>
                <p className="text-lg font-semibold">AI CFO Platform</p>
              </div>
            </div>
            <nav className="hidden items-center gap-6 text-sm text-slate-200 md:flex" role="navigation" aria-label="Main navigation">
              <a href="#features" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1">
                Features
              </a>
              <a href="#pricing" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1">
                Pricing
              </a>
              <a href="#testimonials" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1">
                Testimonials
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-slate-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1">
                Log in
              </Link>
              <Link to="/register" className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                Get Started
              </Link>
            </div>
          </header>

          <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-14">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Built for Indian SMEs
                </p>
                <h1 id="hero-heading" className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Your AI-Powered CFO for
                  <span className="block text-emerald-200">Smarter Financial Decisions</span>
                </h1>
                <p className="mt-5 text-lg text-slate-200/80">
                  Stop guessing about your finances. Get clear visibility into cash health, revenue trends,
                  and expenses with AI insights that help Indian SMEs make confident financial decisions.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link to="/register" className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    Start your 30-day free trial
                  </Link>
                  <Link to="/login" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 hover:border-white/40 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50">
                    View Demo Dashboard
                  </Link>
                </div>
                
                {/* Stats Section */}
                <div className="mt-8 grid gap-4 text-sm text-slate-200/80 sm:grid-cols-3">
                  {stats.map((stat, index) => (
                    <div key={index} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                      <div className="flex items-center gap-2">
                        {stat.icon}
                        <span className="font-semibold">{stat.value}</span>
                      </div>
                      <p className="mt-1 text-xs">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="rounded-3xl bg-slate-900/70 p-6 ring-1 ring-white/10 backdrop-blur" role="img" aria-label="AI CFO Dashboard Preview">
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
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="mx-auto w-full max-w-6xl px-6 py-16" aria-labelledby="features-heading">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-emerald-200/80">Everything You Need to Manage Finances</p>
              <h2 id="features-heading" className="text-3xl font-semibold">
                A complete financial intelligence platform designed specifically for Indian founders and SMEs.
              </h2>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((item, index) => (
              <article key={index} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10" aria-hidden="true">
                  {item.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="mx-auto w-full max-w-6xl px-6 py-16" aria-labelledby="testimonials-heading">
          <div className="text-center">
            <p className="text-sm text-emerald-200/80">Trusted by Indian SMEs</p>
            <h2 id="testimonials-heading" className="mt-2 text-3xl font-semibold">What Our Customers Say</h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-1 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <article key={index} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="flex items-center gap-1 mb-4" role="img" aria-label={`${testimonial.rating} out of 5 stars`}>
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="text-sm text-slate-300 mb-4">
                  <p>"{testimonial.text}"</p>
                </blockquote>
                <footer>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs text-slate-400">{testimonial.role}, {testimonial.company}</p>
                </footer>
              </article>
            ))}
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="mx-auto w-full max-w-6xl px-6 pb-20" aria-labelledby="pricing-heading">
          <div className="rounded-3xl bg-white/5 p-10 ring-1 ring-white/10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm text-emerald-200/80">Simple, Transparent Pricing</p>
                <h2 id="pricing-heading" className="text-3xl font-semibold">Start your 30-day free trial.</h2>
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
                <Link to="/register" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  Start your 30-day free trial
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16" aria-labelledby="faq-heading">
          <div className="text-center">
            <h2 id="faq-heading" className="text-3xl font-semibold">Frequently Asked Questions</h2>
            <p className="mt-2 text-slate-400">Everything you need to know about AI CFO</p>
          </div>

          <div className="mt-10 space-y-6">
            <details className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <summary className="flex cursor-pointer items-center justify-between text-lg font-semibold">
                How does AI CFO integrate with Tally?
                <ArrowRight className="h-5 w-5 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-4 text-sm text-slate-300">
                AI CFO connects to your Tally installation through our secure Windows connector. Once connected, 
                it automatically syncs your financial data while maintaining end-to-end encryption and compliance 
                with Indian data protection standards.
              </p>
            </details>

            <details className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <summary className="flex cursor-pointer items-center justify-between text-lg font-semibold">
                Is my financial data secure?
                <ArrowRight className="h-5 w-5 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-4 text-sm text-slate-300">
                Yes, we use bank-grade encryption and follow RBI guidelines for financial data handling. 
                Your data is encrypted in transit and at rest, and we never store your Tally credentials. 
                We're also compliant with Indian data localization requirements.
              </p>
            </details>

            <details className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <summary className="flex cursor-pointer items-center justify-between text-lg font-semibold">
                What makes AI CFO different from other accounting tools?
                <ArrowRight className="h-5 w-5 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-4 text-sm text-slate-300">
                Unlike generic accounting software, AI CFO is specifically designed for Indian SMEs and provides 
                CFO-level insights. We analyze your Tally data to give you actionable recommendations, not just 
                reports. Plus, our AI understands Indian business contexts and GST compliance requirements.
              </p>
            </details>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-20" aria-labelledby="cta-heading">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-500/20 to-sky-500/20 p-10 ring-1 ring-white/10 text-center">
            <h2 id="cta-heading" className="text-3xl font-semibold">Ready to Transform Your Financial Management?</h2>
            <p className="mt-4 text-lg text-slate-200/80">
              Join hundreds of Indian SMEs who are making smarter financial decisions with AI CFO.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/register" className="rounded-full bg-emerald-400 px-8 py-4 text-lg font-semibold text-slate-900 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                Start Free Trial
              </Link>
              <Link to="/login" className="rounded-full border border-white/20 px-8 py-4 text-lg font-semibold text-white/80 hover:border-white/40 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50">
                Schedule Demo
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-400">No credit card required • 30-day free trial • Cancel anytime</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 pb-10 pt-8 text-center text-xs text-slate-400" role="contentinfo">
          <div className="mx-auto max-w-6xl px-6">
            <p>AI CFO provides decision support, not statutory advice.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-6 text-xs">
              <Link to="/privacy" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1">
                Terms of Service
              </Link>
              <Link to="/support" className="hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1">
                Support
              </Link>
            </div>
            <p className="mt-4">© 2024 AI CFO. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </>
  );
};

export default SEOOptimizedHome;
