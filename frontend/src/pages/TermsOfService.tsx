import React from 'react';
import { Link } from 'react-router-dom';
import SEOMetaTags from '../components/seo/SEOMetaTags';

const TermsOfService: React.FC = () => {
  return (
    <>
      <SEOMetaTags
        title="Terms of Service - AI CFO"
        description="Read the terms and conditions for using AI CFO platform. Understand your rights and responsibilities when using our AI-powered financial intelligence service for Indian SMEs."
        keywords={[
          'AI CFO terms of service',
          'terms and conditions',
          'service agreement',
          'Indian SME terms',
          'financial platform terms',
          'software license agreement',
          'user agreement',
          'platform usage terms',
          'service terms India'
        ]}
        canonicalUrl="/terms"
      />

      <main className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-4xl px-6">
          <article className="rounded-lg bg-white p-8 shadow-sm">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
              <p className="mt-2 text-gray-600">Last updated: February 14, 2026</p>
              <p className="mt-4 text-sm text-gray-600">
                Please read these Terms of Service ("Terms") carefully before using the AI CFO platform 
                ("Service") operated by AI CFO ("us", "we", or "our").
              </p>
            </header>

            <div className="prose prose-gray max-w-none">
              <section>
                <h2 className="text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using AI CFO, you agree to be bound by these Terms of Service and all applicable 
                  laws and regulations. If you disagree with any part of these terms, you may not access the Service.
                </p>
                <p>
                  These Terms apply to all users of the Service, including Indian SMEs, startups, individual business 
                  owners, and any other entities accessing our AI-powered financial intelligence platform.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">2. Description of Service</h2>
                <p>
                  AI CFO provides an AI-powered financial intelligence platform that integrates with Tally software 
                  to offer cash flow analysis, revenue insights, expense tracking, and AI-generated financial 
                  recommendations specifically designed for Indian SMEs.
                </p>
                <p>
                  Our Service includes, but is not limited to:
                </p>
                <ul className="list-disc pl-6">
                  <li>Financial data analysis and visualization</li>
                  <li>AI-powered insights and recommendations</li>
                  <li>Cash flow monitoring and runway calculations</li>
                  <li>Integration with Tally accounting software</li>
                  <li>Financial reporting and dashboards</li>
                  <li>AI chat assistant for financial queries</li>
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">3. User Eligibility</h2>
                <p>
                  You must be at least 18 years old and have the legal capacity to enter into these Terms. 
                  By using the Service, you represent and warrant that:
                </p>
                <ul className="list-disc pl-6">
                  <li>You are a legally registered business entity in India</li>
                  <li>You have valid Tally software and necessary licenses</li>
                  <li>You have the authority to bind your organization to these Terms</li>
                  <li>Your use of the Service complies with all applicable Indian laws</li>
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">4. User Accounts and Registration</h2>
                <h3 className="text-lg font-medium text-gray-900">4.1 Account Creation</h3>
                <p>
                  To access the Service, you must create an account by providing accurate and complete information. 
                  You agree to maintain the accuracy of this information and update it as necessary.
                </p>

                <h3 className="text-lg font-medium text-gray-900 mt-4">4.2 Account Security</h3>
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials and for all 
                  activities that occur under your account. You agree to:
                </p>
                <ul className="list-disc pl-6">
                  <li>Immediately notify us of any unauthorized use of your account</li>
                  <li>Use strong, unique passwords for your account</li>
                  <li>Not share your account credentials with third parties</li>
                  <li>Log out of your account after each session</li>
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">5. Use of Service</h2>
                <h3 className="text-lg font-medium text-gray-900">5.1 Permitted Use</h3>
                <p>
                  You may use the Service only for legitimate business purposes related to financial analysis 
                  and decision-making. You agree not to:
                </p>
                <ul className="list-disc pl-6">
                  <li>Use the Service for any illegal or unauthorized purpose</li>
                  <li>Reverse engineer, decompile, or attempt to extract the source code</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Attempt to gain unauthorized access to any part of the Service</li>
                  <li>Use the Service to store or transmit malicious code</li>
                  <li>Violate any applicable laws or regulations</li>
                </ul>

                <h3 className="text-lg font-medium text-gray-900 mt-4">5.2 Data Accuracy</h3>
                <p>
                  You are responsible for ensuring the accuracy and completeness of data you provide to the Service. 
                  AI CFO is not responsible for decisions made based on inaccurate or incomplete data.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">6. Intellectual Property</h2>
                <p>
                  The Service and its original content, features, and functionality are owned by AI CFO and are 
                  protected by international copyright, trademark, patent, trade secret, and other intellectual 
                  property laws.
                </p>
                <p>
                  You retain ownership of your financial data. By using the Service, you grant us a non-exclusive, 
                  worldwide, royalty-free license to use, process, and analyze your data solely for the purpose 
                  of providing the Service.
                </p>
                <p>
                  AI-generated insights and recommendations provided by the Service are for informational purposes 
                  only and should not be considered as professional financial advice.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">7. Payment and Subscription</h2>
                <h3 className="text-lg font-medium text-gray-900">7.1 Pricing</h3>
                <p>
                  Current pricing is ₹4,999 per month after a 30-day free trial. Prices are subject to change 
                  with 30 days' notice. All prices are in Indian Rupees and exclude applicable taxes.
                </p>

                <h3 className="text-lg font-medium text-gray-900 mt-4">7.2 Billing and Cancellation</h3>
                <p>
                  Subscriptions are billed monthly in advance. You can cancel your subscription at any time, 
                  and cancellation will be effective at the end of the current billing period. No refunds 
                  are provided for partial months.
                </p>

                <h3 className="text-lg font-medium text-gray-900 mt-4">7.3 Free Trial</h3>
                <p>
                  New users are eligible for a 30-day free trial. During the trial period, you have access 
                  to all features of the Service. After the trial period ends, you will be automatically 
                  charged unless you cancel before the trial expires.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">8. Disclaimer of Warranties</h2>
                <p>
                  The Service is provided on an "AS IS" and "AS AVAILABLE" basis. AI CFO makes no warranties, 
                  expressed or implied, and hereby disclaims and negates all other warranties including, without 
                  limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, 
                  or non-infringement of intellectual property.
                </p>
                <p>
                  AI CFO does not warrant or make any representations concerning the accuracy, likely results, 
                  or reliability of the use of the materials on its Service or otherwise relating to such 
                  materials or on any sites linked to this Service.
                </p>
                <p>
                  AI-generated insights and recommendations are provided for informational purposes only and 
                  should not be considered as professional financial, legal, or tax advice. Always consult 
                  with qualified professionals before making important business decisions.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">9. Limitations of Liability</h2>
                <p>
                  In no event shall AI CFO or its suppliers be liable for any damages (including, without limitation, 
                  damages for loss of data or profit, or due to business interruption) arising out of the use or 
                  inability to use the Service, even if AI CFO or an authorized representative has been notified 
                  orally or in writing of the possibility of such damage.
                </p>
                <p>
                  Because some jurisdictions do not allow limitations on implied warranties, or limitations of 
                  liability for consequential or incidental damages, these limitations may not apply to you.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">10. Indemnification</h2>
                <p>
                  You agree to indemnify and hold harmless AI CFO and its affiliates, officers, agents, and employees 
                  from any claim or demand, including reasonable attorneys' fees, made by any third party due to or 
                  arising out of your breach of these Terms or your violation of any law or the rights of a third party.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">11. Termination</h2>
                <p>
                  We may terminate or suspend your account and access to the Service immediately, without prior notice 
                  or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                </p>
                <p>
                  Upon termination, your right to use the Service will immediately cease. All provisions of the Terms 
                  which by their nature should survive termination shall survive termination.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">12. Governing Law</h2>
                <p>
                  These Terms shall be governed and construed in accordance with the laws of India, without regard 
                  to its conflict of law provisions. You agree to submit to the exclusive jurisdiction of the courts 
                  located in India for the resolution of any disputes.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">13. Changes to Terms</h2>
                <p>
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. 
                  We will provide notice of any material changes by posting the new Terms on this page and 
                  updating the "Last updated" date.
                </p>
                <p>
                  By continuing to access or use our Service after those revisions become effective, you agree 
                  to be bound by the revised terms.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">14. Contact Us</h2>
                <p>
                  If you have any questions about these Terms of Service, please contact us:
                </p>
                <div className="mt-4 space-y-2">
                  <p><strong>Email:</strong> legal@aicfo.in</p>
                  <p><strong>Phone:</strong> +91-XXXXXXXXXX</p>
                  <p><strong>Address:</strong> AI CFO Legal Team, [Company Address], India</p>
                </div>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">15. Severability</h2>
                <p>
                  If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining 
                  provisions of these Terms will remain in effect.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">16. Entire Agreement</h2>
                <p>
                  These Terms constitute the entire agreement between you and AI CFO regarding the use of the Service 
                  and supersede any prior agreements between you and us relating to the Service.
                </p>
              </section>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-8">
              <p className="text-sm text-gray-600">
                By using AI CFO, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
              <div className="mt-6 flex items-center justify-between">
                <Link to="/" className="text-sm text-primary-600 hover:text-primary-700">
                  ← Back to Home
                </Link>
                <p className="text-xs text-gray-500">
                  Last updated: February 14, 2026
                </p>
              </div>
            </div>
          </article>
        </div>
      </main>
    </>
  );
};

export default TermsOfService;