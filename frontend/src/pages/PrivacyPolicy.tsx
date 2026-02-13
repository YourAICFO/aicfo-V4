import React from 'react';
import { Link } from 'react-router-dom';
import SEOMetaTags from '../components/seo/SEOMetaTags';

const PrivacyPolicy: React.FC = () => {
  return (
    <>
      <SEOMetaTags
        title="Privacy Policy - AI CFO"
        description="Learn how AI CFO collects, uses, and protects your personal and financial data. Our privacy policy explains our data handling practices for Indian SMEs."
        keywords={[
          'AI CFO privacy policy',
          'data protection',
          'financial data privacy',
          'Indian SME data',
          'Tally integration privacy',
          'personal data protection',
          'financial information security',
          'data handling practices',
          'privacy compliance India'
        ]}
        canonicalUrl="/privacy"
      />

      <main className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-4xl px-6">
          <article className="rounded-lg bg-white p-8 shadow-sm">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
              <p className="mt-2 text-gray-600">Last updated: February 14, 2026</p>
            </header>

            <div className="prose prose-gray max-w-none">
              <section>
                <h2 className="text-xl font-semibold text-gray-900">1. Introduction</h2>
                <p>
                  AI CFO ("we," "our," or "us") is committed to protecting your privacy and ensuring the security 
                  of your personal and financial information. This Privacy Policy explains how we collect, use, 
                  disclose, and safeguard your information when you use our AI-powered financial intelligence platform.
                </p>
                <p>
                  By using AI CFO, you agree to the collection and use of information in accordance with this policy. 
                  This policy applies to all users of our platform, including Indian SMEs, startups, and individual 
                  business owners.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">2. Information We Collect</h2>
                
                <h3 className="text-lg font-medium text-gray-900">2.1 Account Information</h3>
                <ul className="list-disc pl-6">
                  <li>Name, email address, phone number</li>
                  <li>Company name, PAN, GSTIN, business type</li>
                  <li>Login credentials and authentication data</li>
                  <li>Payment information (processed securely through third-party providers)</li>
                </ul>

                <h3 className="text-lg font-medium text-gray-900 mt-4">2.2 Financial Data</h3>
                <ul className="list-disc pl-6">
                  <li>Transaction data from Tally integration</li>
                  <li>Chart of accounts and ledger information</li>
                  <li>Cash flow statements and balance sheets</li>
                  <li>Revenue and expense breakdowns</li>
                  <li>Financial metrics and KPIs</li>
                </ul>

                <h3 className="text-lg font-medium text-gray-900 mt-4">2.3 Usage Data</h3>
                <ul className="list-disc pl-6">
                  <li>Login times and session duration</li>
                  <li>Features used and interactions</li>
                  <li>Device information and browser type</li>
                  <li>IP address and location data</li>
                </ul>

                <h3 className="text-lg font-medium text-gray-900 mt-4">2.4 AI Interaction Data</h3>
                <ul className="list-disc pl-6">
                  <li>Questions asked to our AI assistant</li>
                  <li>AI-generated insights and recommendations</li>
                  <li>User feedback on AI responses</li>
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">3. How We Use Your Information</h2>
                <p>We use the collected information for the following purposes:</p>
                <ul className="list-disc pl-6">
                  <li>To provide and maintain our financial intelligence platform</li>
                  <li>To generate AI-powered insights and recommendations</li>
                  <li>To analyze financial trends and patterns</li>
                  <li>To send important updates and notifications</li>
                  <li>To improve our platform and develop new features</li>
                  <li>To ensure compliance with Indian financial regulations</li>
                  <li>To prevent fraud and maintain security</li>
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">4. Data Security</h2>
                <p>
                  We implement appropriate technical and organizational measures to protect your data:
                </p>
                <ul className="list-disc pl-6">
                  <li>End-to-end encryption for data in transit and at rest</li>
                  <li>Secure data centers located in India (data localization compliant)</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Role-based access controls and authentication systems</li>
                  <li>Regular backups and disaster recovery procedures</li>
                  <li>Compliance with RBI guidelines for financial data handling</li>
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">5. Data Sharing and Disclosure</h2>
                <p>
                  We do not sell your personal or financial data. We may share information only in the following circumstances:
                </p>
                <ul className="list-disc pl-6">
                  <li>With your explicit consent</li>
                  <li>With trusted service providers who assist in operating our platform</li>
                  <li>When required by law or to comply with legal processes</li>
                  <li>To protect our rights, property, or safety, or that of our users</li>
                  <li>In connection with a business transfer or acquisition</li>
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">6. Your Rights</h2>
                <p>Under Indian data protection laws, you have the right to:</p>
                <ul className="list-disc pl-6">
                  <li>Access your personal information</li>
                  <li>Correct inaccurate or incomplete data</li>
                  <li>Request deletion of your data (subject to legal retention requirements)</li>
                  <li>Object to certain processing activities</li>
                  <li>Data portability</li>
                  <li>Withdraw consent at any time</li>
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">7. Data Retention</h2>
                <p>
                  We retain your information for as long as necessary to provide our services, comply with legal obligations, 
                  resolve disputes, and enforce our agreements. Financial data is typically retained for 7 years to comply 
                  with Indian financial regulations.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">8. Cookies and Tracking</h2>
                <p>
                  We use cookies and similar tracking technologies to enhance user experience, analyze usage patterns, 
                  and improve our services. You can control cookie settings through your browser preferences.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">9. Third-Party Services</h2>
                <p>
                  Our platform may integrate with third-party services such as payment processors and cloud infrastructure 
                  providers. These services have their own privacy policies, and we recommend reviewing them.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">10. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the 
                  new policy on this page and updating the "Last updated" date. Changes are effective immediately upon posting.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">11. Contact Us</h2>
                <p>
                  If you have any questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="mt-4 space-y-2">
                  <p><strong>Email:</strong> privacy@aicfo.in</p>
                  <p><strong>Phone:</strong> +91-XXXXXXXXXX</p>
                  <p><strong>Address:</strong> AI CFO Privacy Team, [Company Address], India</p>
                </div>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">12. GDPR Compliance</h2>
                <p>
                  While primarily serving Indian customers, we also comply with GDPR requirements for EU users, 
                  including the right to be forgotten and data portability rights.
                </p>
              </section>

              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">13. Grievance Officer</h2>
                <p>
                  In accordance with Indian data protection laws, we have appointed a Grievance Officer to address 
                  your concerns regarding data privacy:
                </p>
                <div className="mt-4">
                  <p><strong>Name:</strong> [Grievance Officer Name]</p>
                  <p><strong>Email:</strong> grievance@aicfo.in</p>
                  <p><strong>Response Time:</strong> Within 30 days of receiving your complaint</p>
                </div>
              </section>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-8">
              <p className="text-sm text-gray-600">
                By using AI CFO, you acknowledge that you have read and understood this Privacy Policy 
                and agree to its terms.
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

export default PrivacyPolicy;