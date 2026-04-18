/**
 * Privacy Policy Page - GDPR Compliance
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | DREAM Discovery',
  description: 'Privacy policy and data protection information',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Privacy Policy
        </h1>

        <div className="prose prose-blue max-w-none space-y-6">
          <p className="text-sm text-gray-600">
            <strong>Last Updated:</strong> April 17, 2026
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              1. Who We Are
            </h2>
            <p className="text-gray-700">
              DREAM Discovery Platform is operated by RAISE. We
              facilitate pre-workshop discovery conversations to gather insights
              from workshop participants.
            </p>
            <p className="text-gray-700 mt-2">
              <strong>Data Controller:</strong> RAISE (operated by Ethenta Ltd)
              <br />
              <strong>Contact:</strong> privacy@raisegtm.com
              <br />
              <strong>Address:</strong> United Kingdom
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              2. What Data We Collect
            </h2>
            <p className="text-gray-700">
              When you participate in a discovery conversation, we collect:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>
                <strong>Identity Data:</strong> Your name, email address, role,
                and department (if provided by your organization)
              </li>
              <li>
                <strong>Conversation Data:</strong> All messages you send during
                the discovery conversation, including your responses to questions
              </li>
              <li>
                <strong>Technical Data:</strong> IP address, browser type, device
                information, and timestamps
              </li>
              <li>
                <strong>Preference Data:</strong> Your attribution preference
                (named or anonymous)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              3. Legal Basis for Processing (GDPR Article 6)
            </h2>
            <p className="text-gray-700">
              We process your personal data on the following legal bases:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>
                <strong>Consent (Article 6(1)(a)):</strong> You explicitly
                consent to data processing when you click "I Agree" before
                starting your conversation
              </li>
              <li>
                <strong>Legitimate Interests (Article 6(1)(f)):</strong> To
                facilitate effective workshops and improve organizational outcomes
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              4. How We Use Your Data
            </h2>
            <p className="text-gray-700">We use your data to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>Prepare insights and reports for workshop facilitators</li>
              <li>Identify common themes and challenges across participants</li>
              <li>Improve workshop effectiveness and participant experience</li>
              <li>Generate summaries and analytics (anonymized where possible)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              5. Data Sharing and Third Parties
            </h2>
            <p className="text-gray-700">
              We share your data with the following parties:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>
                <strong>Your Organization:</strong> Workshop facilitators and
                administrators from your organization can access your responses
              </li>
              <li>
                <strong>OpenAI (GPT-4 API):</strong> We use OpenAI's API to
                facilitate conversations. OpenAI processes data according to their
                Zero Data Retention policy (data is not stored beyond 30 days)
              </li>
              <li>
                <strong>Supabase (Infrastructure):</strong> Our database provider,
                with servers located in the European Economic Area (EEA) and United Kingdom, primarily on infrastructure provided by Supabase (EU region) and Vercel (EU edge network)
              </li>
            </ul>
            <p className="text-gray-700 mt-2">
              We do NOT sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              6. Data Security
            </h2>
            <p className="text-gray-700">
              We implement appropriate security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>Data transmitted over HTTPS (TLS/SSL encryption)</li>
              <li>Database access restricted to authorized personnel only</li>
              <li>Regular security audits and monitoring</li>
              <li>Row-level security to prevent cross-organization data access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              7. Data Retention
            </h2>
            <p className="text-gray-700">
              We retain your personal data for:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>
                <strong>Conversation Data:</strong> 12 months after workshop
                completion, or until you request deletion
              </li>
              <li>
                <strong>Consent Records:</strong> 7 years (legal requirement for
                proof of consent)
              </li>
              <li>
                <strong>Audit Logs:</strong> 7 years (compliance requirement)
              </li>
            </ul>
            <p className="text-gray-700 mt-2">
              After the retention period, data is automatically deleted unless
              legal obligations require longer retention.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              8. Your Rights Under GDPR
            </h2>
            <p className="text-gray-700">You have the following rights:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>
                <strong>Right of Access (Article 15):</strong> Request a copy of
                your personal data
              </li>
              <li>
                <strong>Right to Rectification (Article 16):</strong> Request
                correction of inaccurate data
              </li>
              <li>
                <strong>Right to Erasure (Article 17):</strong> Request deletion
                of your data ("right to be forgotten")
              </li>
              <li>
                <strong>Right to Restrict Processing (Article 18):</strong> Limit
                how we use your data
              </li>
              <li>
                <strong>Right to Data Portability (Article 20):</strong> Receive
                your data in a machine-readable format
              </li>
              <li>
                <strong>Right to Object (Article 21):</strong> Object to data
                processing
              </li>
              <li>
                <strong>Right to Withdraw Consent (Article 7(3)):</strong> Withdraw
                your consent at any time
              </li>
            </ul>
            <p className="text-gray-700 mt-4">
              To exercise any of these rights, contact us at:{' '}
              <a
                href="mailto:privacy@raisegtm.com"
                className="text-blue-600 hover:underline"
              >
                privacy@raisegtm.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              9. How to Exercise Your Rights
            </h2>
            <p className="text-gray-700">
              To request access, correction, or deletion of your data:
            </p>
            <ol className="list-decimal pl-6 mt-2 space-y-2 text-gray-700">
              <li>
                Email us at{' '}
                <a
                  href="mailto:privacy@raisegtm.com"
                  className="text-blue-600 hover:underline"
                >
                  privacy@raisegtm.com
                </a>{' '}
                with "Data Subject Request" in the subject line
              </li>
              <li>
                Provide your email address used for the discovery conversation
              </li>
              <li>Specify which workshop/organization you're associated with</li>
              <li>
                We will respond within 30 days (as required by GDPR Article 12)
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              10. Cookies and Tracking
            </h2>
            <p className="text-gray-700">
              We use minimal cookies necessary for the application to function.
              We do NOT use tracking cookies or analytics cookies without your
              explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              11. International Data Transfers
            </h2>
            <p className="text-gray-700">
              Your data is stored in the European Economic Area (EEA) and United Kingdom, primarily on infrastructure provided by Supabase (EU region) and Vercel (EU edge network). If data is transferred outside the
              EU/EEA, we ensure appropriate safeguards are in place through:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>Standard Contractual Clauses (SCCs)</li>
              <li>Adequacy decisions by the European Commission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              11b. Sub-Processors (GDPR Article 28)
            </h2>
            <p className="text-gray-700">
              We share your data with the following third-party sub-processors who process data on our behalf, each governed by a Data Processing Agreement:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li><strong>Supabase, Inc.</strong> — database hosting and authentication (EU region). <a href="https://supabase.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
              <li><strong>Vercel, Inc.</strong> — application hosting and edge delivery (EU region available). <a href="https://vercel.com/legal/privacy-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
              <li><strong>OpenAI, LLC</strong> — AI synthesis and transcription (processed under zero data retention agreement where available). <a href="https://openai.com/policies/privacy-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
              <li><strong>Railway Technologies, Inc.</strong> — voice capture processing (transient; audio deleted after transcription). <a href="https://railway.app/legal/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
              <li><strong>GitHub, Inc.</strong> — source code hosting; does not process personal data of participants.</li>
              <li><strong>Upstash, Inc.</strong> — rate limiting cache; processes only anonymised IP-derived keys, no personal data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              12. Data Breach Notification
            </h2>
            <p className="text-gray-700">
              In the event of a data breach that poses a risk to your rights and
              freedoms, we will:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>
                Notify the relevant supervisory authority within 72 hours (GDPR
                Article 33)
              </li>
              <li>
                Notify affected individuals without undue delay (GDPR Article 34)
              </li>
              <li>Provide details of the breach and remedial actions taken</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              13. Children's Privacy
            </h2>
            <p className="text-gray-700">
              This service is not intended for individuals under 16 years of age.
              We do not knowingly collect data from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              14. Changes to This Policy
            </h2>
            <p className="text-gray-700">
              We may update this privacy policy from time to time. We will notify
              you of any significant changes by email or through the platform.
              Continued use after changes constitutes acceptance of the updated
              policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              15. Complaints
            </h2>
            <p className="text-gray-700">
              If you have concerns about how we handle your data, you have the
              right to lodge a complaint with a supervisory authority:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-700">
              <li>
                <strong>UK:</strong> Information Commissioner's Office (ICO) -{' '}
                <a
                  href="https://ico.org.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://ico.org.uk
                </a>
              </li>
              <li>
                <strong>EU:</strong> Your local Data Protection Authority
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              16. Contact Us
            </h2>
            <p className="text-gray-700">
              For questions about this privacy policy or data protection:
            </p>
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <p className="text-gray-900">
                <strong>Data Protection Officer</strong>
                <br />
                RAISE
                <br />
                Email:{' '}
                <a
                  href="mailto:privacy@raisegtm.com"
                  className="text-blue-600 hover:underline"
                >
                  privacy@raisegtm.com
                </a>
                <br />
                Phone: [PHONE NUMBER]
                <br />
                Address: [FULL ADDRESS]
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 text-sm text-gray-600">
          <p>
            This privacy policy complies with the General Data Protection
            Regulation (GDPR) 2016/679 and the UK Data Protection Act 2018.
          </p>
        </div>
      </div>
    </div>
  );
}
