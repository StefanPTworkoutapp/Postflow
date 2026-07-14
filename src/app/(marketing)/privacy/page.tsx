import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Privacy Policy — PostFlow",
  description:
    "How PostFlow collects, uses, and protects your personal data. GDPR-compliant. Last updated June 2026.",
}

export default function PrivacyPage() {
  return (
    <div className={jakarta.className}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --teal:     #0DA5A5;
          --navy:     #1A203A;
          --lime:     #D4E8C8;
          --white:    #ffffff;
          --grey-50:  #F8F9FA;
          --grey-100: #F1F3F5;
          --grey-300: #DEE2E6;
          --grey-500: #868E96;
          --grey-700: #495057;
          --grey-900: #212529;
        }

        .pf-body {
          background: var(--white);
          color: var(--grey-900);
          line-height: 1.7;
          font-size: 16px;
        }

        /* NAV */
        .pf-nav {
          position: sticky;
          top: 0;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--grey-100);
          z-index: 100;
          padding: 0 2rem;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .pf-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--navy);
          font-weight: 600;
          font-size: 1rem;
        }

        .pf-logo-mark {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .pf-logo-mark img { width: 100%; height: 100%; display: block; }

        .pf-nav-link {
          color: var(--grey-500);
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
        }
        .pf-nav-link:hover { color: var(--teal); }

        /* HERO */
        .pf-hero {
          background: var(--navy);
          color: white;
          padding: 5rem 2rem 4rem;
          text-align: center;
        }

        .pf-hero-badge {
          display: inline-block;
          background: rgba(13, 165, 165, 0.2);
          color: var(--teal);
          border: 1px solid rgba(13, 165, 165, 0.3);
          border-radius: 100px;
          padding: 4px 14px;
          font-size: 0.8rem;
          font-weight: 500;
          margin-bottom: 1.5rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .pf-hero h1 {
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 600;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }

        .pf-hero p {
          color: rgba(255,255,255,0.6);
          font-size: 1rem;
          max-width: 480px;
          margin: 0 auto;
        }

        /* LAYOUT */
        .pf-container {
          max-width: 760px;
          margin: 0 auto;
          padding: 4rem 2rem 6rem;
        }

        /* TOC */
        .pf-toc {
          background: var(--grey-50);
          border: 1px solid var(--grey-100);
          border-radius: 12px;
          padding: 1.5rem 2rem;
          margin-bottom: 3rem;
        }

        .pf-toc h3 {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--grey-500);
          margin-bottom: 1rem;
        }

        .pf-toc ol {
          padding-left: 1.2rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem 2rem;
        }

        .pf-toc li { font-size: 0.875rem; }

        .pf-toc a {
          color: var(--teal);
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .pf-toc a:hover { opacity: 0.75; }

        /* SECTIONS */
        .pf-section {
          margin-bottom: 3rem;
          scroll-margin-top: 80px;
        }

        .pf-section-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--teal);
          color: white;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
        }

        .pf-section h2 {
          font-size: 1.375rem;
          font-weight: 600;
          color: var(--navy);
          margin-bottom: 1rem;
          letter-spacing: -0.01em;
        }

        .pf-section h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--navy);
          margin: 1.5rem 0 0.5rem;
        }

        .pf-section p { margin-bottom: 1rem; color: var(--grey-700); }
        .pf-section p:last-child { margin-bottom: 0; }

        .pf-section ul, .pf-section ol {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
          color: var(--grey-700);
        }

        .pf-section li { margin-bottom: 0.4rem; }

        .pf-divider {
          height: 1px;
          background: var(--grey-100);
          margin: 3rem 0;
        }

        /* HIGHLIGHT BOX */
        .pf-highlight {
          background: rgba(13, 165, 165, 0.06);
          border-left: 3px solid var(--teal);
          border-radius: 0 8px 8px 0;
          padding: 1rem 1.25rem;
          margin: 1.25rem 0;
        }

        .pf-highlight p { color: var(--grey-700); margin: 0; font-size: 0.9375rem; }

        /* DATA TABLE */
        .pf-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0 1.5rem;
          font-size: 0.875rem;
        }

        .pf-table th {
          background: var(--grey-50);
          padding: 0.625rem 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--grey-500);
          border: 1px solid var(--grey-300);
        }

        .pf-table td {
          padding: 0.75rem 1rem;
          border: 1px solid var(--grey-300);
          color: var(--grey-700);
          vertical-align: top;
        }

        .pf-table tr:nth-child(even) td { background: var(--grey-50); }

        /* RIGHTS GRID */
        .pf-rights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
          margin: 1rem 0;
        }

        .pf-right-card {
          background: var(--grey-50);
          border: 1px solid var(--grey-100);
          border-radius: 10px;
          padding: 1rem;
        }

        .pf-right-card .pf-right-icon {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }

        .pf-right-card h4 {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--navy);
          margin-bottom: 0.25rem;
        }

        .pf-right-card p {
          font-size: 0.8125rem;
          color: var(--grey-500);
          margin: 0;
        }

        /* CONTACT CARD */
        .pf-contact-card {
          background: var(--navy);
          color: white;
          border-radius: 16px;
          padding: 2rem;
          margin-top: 2rem;
        }

        .pf-contact-card h3 { color: white; margin-top: 0; }
        .pf-contact-card p { color: rgba(255,255,255,0.65); margin-bottom: 0.5rem; }
        .pf-contact-card a { color: var(--teal); text-decoration: none; }

        /* FOOTER */
        .pf-footer {
          background: var(--grey-50);
          border-top: 1px solid var(--grey-100);
          padding: 2rem;
          text-align: center;
          font-size: 0.8125rem;
          color: var(--grey-500);
        }

        .pf-footer a { color: var(--teal); text-decoration: none; }

        @media (max-width: 600px) {
          .pf-toc ol { grid-template-columns: 1fr; }
          .pf-rights-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="pf-body">

        {/* Nav */}
        <nav className="pf-nav">
          <a href="https://postflowsocials.app" className="pf-logo">
            <div className="pf-logo-mark">
              <img src="/postflow-logo-icon.png" alt="" width={28} height={28} />
            </div>
            PostFlow
          </a>
          <a href="https://postflowsocials.app" className="pf-nav-link">← Back to PostFlow</a>
        </nav>

        {/* Hero */}
        <div className="pf-hero">
          <div className="pf-hero-badge">Legal</div>
          <h1>Privacy Policy</h1>
          <p>How PostFlow collects, uses, and protects your personal data. Last updated: June 2026.</p>
        </div>

        <div className="pf-container">

          {/* TOC */}
          <div className="pf-toc">
            <h3>Contents</h3>
            <ol>
              <li><a href="#who">Who we are</a></li>
              <li><a href="#data">Data we collect</a></li>
              <li><a href="#why">Why we use it</a></li>
              <li><a href="#legal">Legal basis (GDPR)</a></li>
              <li><a href="#third-parties">Third parties</a></li>
              <li><a href="#retention">Data retention</a></li>
              <li><a href="#rights">Your rights</a></li>
              <li><a href="#security">Security</a></li>
              <li><a href="#cookies">Cookies</a></li>
              <li><a href="#contact">Contact &amp; complaints</a></li>
            </ol>
          </div>

          <div className="pf-highlight">
            <p><strong>Plain English summary:</strong> PostFlow helps you create and schedule social media content. To do that, we need your email, brand info, and access to your social accounts. We don&apos;t sell your data. We don&apos;t use it for ads. We store it securely and you can delete it any time.</p>
          </div>

          {/* 1 — Who we are */}
          <div className="pf-section" id="who">
            <div className="pf-section-number">1</div>
            <h2>Who we are</h2>
            <p>PostFlow (&ldquo;PostFlow&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a social media content creation and scheduling platform operated by MindYourBodyPT B.V., registered in the Netherlands.</p>
            <p>MindYourBodyPT B.V. is the data controller for personal data collected through postflowsocials.app.</p>
            <p><strong>KVK:</strong> 42003965 &nbsp;·&nbsp; <strong>BTW:</strong> NL869239909B01</p>
            <p><strong>Contact:</strong> <a href="mailto:support@mindyourbodypt.nl?subject=PostFlow%20-%20Privacy" style={{ color: "var(--teal)" }}>support@mindyourbodypt.nl</a> (subject: <em>PostFlow – Privacy</em>)</p>
          </div>

          <div className="pf-divider" />

          {/* 2 — Data we collect */}
          <div className="pf-section" id="data">
            <div className="pf-section-number">2</div>
            <h2>Data we collect</h2>

            <table className="pf-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>What we collect</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Account data</strong></td>
                  <td>Email address, display name, profile picture</td>
                  <td>You, or Google/SSO on signup</td>
                </tr>
                <tr>
                  <td><strong>Brand data</strong></td>
                  <td>Business name, industry, niche, logo, colours, tone of voice, goals</td>
                  <td>You (during onboarding and brand setup)</td>
                </tr>
                <tr>
                  <td><strong>Content data</strong></td>
                  <td>Videos, images, and text you upload or generate via PostFlow</td>
                  <td>You</td>
                </tr>
                <tr>
                  <td><strong>Social account tokens</strong></td>
                  <td>OAuth access tokens for Instagram, Facebook, LinkedIn, TikTok, Buffer</td>
                  <td>Platform OAuth flows (you approve)</td>
                </tr>
                <tr>
                  <td><strong>Analytics data</strong></td>
                  <td>Post reach, impressions, likes, comments, shares — pulled from connected platforms</td>
                  <td>Buffer API / platform APIs</td>
                </tr>
                <tr>
                  <td><strong>Usage data</strong></td>
                  <td>Pages visited, features used, session duration</td>
                  <td>Automatically collected</td>
                </tr>
                <tr>
                  <td><strong>Technical data</strong></td>
                  <td>IP address, browser type, device type</td>
                  <td>Automatically collected</td>
                </tr>
                <tr>
                  <td><strong>Billing data</strong></td>
                  <td>Subscription plan, payment history (no card numbers — handled by Stripe)</td>
                  <td>Stripe (payment processor)</td>
                </tr>
              </tbody>
            </table>

            <p>We do <strong>not</strong> collect sensitive personal data (health, religion, ethnicity, political views, etc.).</p>
          </div>

          <div className="pf-divider" />

          {/* 3 — Why we use it */}
          <div className="pf-section" id="why">
            <div className="pf-section-number">3</div>
            <h2>Why we use your data</h2>

            <h3>To provide the service</h3>
            <ul>
              <li>Create and manage your account</li>
              <li>Generate AI-powered social media content using your brand settings</li>
              <li>Schedule and publish posts to your connected social platforms via Buffer</li>
              <li>Sync analytics from your social accounts to show performance data</li>
              <li>Improve brand token learning based on post performance</li>
            </ul>

            <h3>To operate the business</h3>
            <ul>
              <li>Process subscription payments via Stripe</li>
              <li>Send transactional emails (receipts, password resets, usage alerts)</li>
              <li>Provide customer support</li>
              <li>Prevent fraud and abuse</li>
            </ul>

            <h3>To improve PostFlow</h3>
            <ul>
              <li>Analyse aggregated, anonymised usage patterns to improve features</li>
              <li>Debug errors and monitor system performance</li>
            </ul>

            <p>We do <strong>not</strong> use your content or brand data to train AI models for other customers. Your brand intelligence tokens are private to your account.</p>
            <p>We do <strong>not</strong> sell your personal data to third parties. We do <strong>not</strong> use your data for advertising.</p>
          </div>

          <div className="pf-divider" />

          {/* 4 — Legal basis */}
          <div className="pf-section" id="legal">
            <div className="pf-section-number">4</div>
            <h2>Legal basis for processing (GDPR)</h2>
            <p>PostFlow processes personal data under the following legal bases as defined in Article 6 of the GDPR:</p>

            <table className="pf-table">
              <thead>
                <tr>
                  <th>Processing activity</th>
                  <th>Legal basis</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Creating and managing your account</td>
                  <td>Contract performance (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td>Generating content and scheduling posts</td>
                  <td>Contract performance (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td>Processing payments</td>
                  <td>Contract performance (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td>Sending transactional emails</td>
                  <td>Contract performance (Art. 6(1)(b))</td>
                </tr>
                <tr>
                  <td>Fraud prevention and security</td>
                  <td>Legitimate interests (Art. 6(1)(f))</td>
                </tr>
                <tr>
                  <td>Product analytics and improvement</td>
                  <td>Legitimate interests (Art. 6(1)(f))</td>
                </tr>
                <tr>
                  <td>Marketing communications</td>
                  <td>Consent (Art. 6(1)(a)) — opt-in only</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pf-divider" />

          {/* 5 — Third parties */}
          <div className="pf-section" id="third-parties">
            <div className="pf-section-number">5</div>
            <h2>Third parties and data processors</h2>
            <p>PostFlow uses the following third-party services to operate. Each acts as a data processor under a Data Processing Agreement (DPA):</p>

            <table className="pf-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Purpose</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Supabase</strong></td>
                  <td>Database and authentication</td>
                  <td>EU (Frankfurt)</td>
                </tr>
                <tr>
                  <td><strong>Vercel</strong></td>
                  <td>Application hosting</td>
                  <td>EU regions available</td>
                </tr>
                <tr>
                  <td><strong>Anthropic (Claude API)</strong></td>
                  <td>AI content generation</td>
                  <td>USA (SCCs apply)</td>
                </tr>
                <tr>
                  <td><strong>Buffer</strong></td>
                  <td>Social media scheduling</td>
                  <td>USA (SCCs apply)</td>
                </tr>
                <tr>
                  <td><strong>Shotstack</strong></td>
                  <td>Video rendering</td>
                  <td>Australia (SCCs apply)</td>
                </tr>
                <tr>
                  <td><strong>Mollie</strong></td>
                  <td>Payment processing (NL and supported countries)</td>
                  <td>Netherlands (EU)</td>
                </tr>
                <tr>
                  <td><strong>Stripe</strong></td>
                  <td>Payment processing (international)</td>
                  <td>EU/USA (SCCs apply)</td>
                </tr>
                <tr>
                  <td><strong>Meta (Instagram/Facebook)</strong></td>
                  <td>Publishing and analytics</td>
                  <td>USA (SCCs apply)</td>
                </tr>
                <tr>
                  <td><strong>LinkedIn</strong></td>
                  <td>Publishing and analytics</td>
                  <td>USA (SCCs apply)</td>
                </tr>
              </tbody>
            </table>

            <p>Where data is transferred outside the EEA, we rely on Standard Contractual Clauses (SCCs) approved by the European Commission to ensure adequate protection.</p>
          </div>

          <div className="pf-divider" />

          {/* 6 — Retention */}
          <div className="pf-section" id="retention">
            <div className="pf-section-number">6</div>
            <h2>How long we keep your data</h2>

            <table className="pf-table">
              <thead>
                <tr>
                  <th>Data type</th>
                  <th>Retention period</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Account and brand data</td>
                  <td>Until you delete your account, then 30 days before permanent deletion</td>
                </tr>
                <tr>
                  <td>Published post content</td>
                  <td>Until you delete it, or account deletion</td>
                </tr>
                <tr>
                  <td>Analytics data</td>
                  <td>24 months from collection</td>
                </tr>
                <tr>
                  <td>Social account OAuth tokens</td>
                  <td>Until you disconnect the platform or delete your account</td>
                </tr>
                <tr>
                  <td>Billing records</td>
                  <td>7 years (Dutch tax law requirement)</td>
                </tr>
                <tr>
                  <td>Usage logs</td>
                  <td>90 days</td>
                </tr>
              </tbody>
            </table>

            <p>When you delete your account, all personal data is permanently deleted within 30 days, except billing records which we are legally required to retain for 7 years.</p>
          </div>

          <div className="pf-divider" />

          {/* 7 — Rights */}
          <div className="pf-section" id="rights">
            <div className="pf-section-number">7</div>
            <h2>Your rights under GDPR</h2>
            <p>As a resident of the EU/EEA, you have the following rights regarding your personal data:</p>

            <div className="pf-rights-grid">
              <div className="pf-right-card">
                <div className="pf-right-icon">👁️</div>
                <h4>Access</h4>
                <p>Request a copy of all data we hold about you</p>
              </div>
              <div className="pf-right-card">
                <div className="pf-right-icon">✏️</div>
                <h4>Rectification</h4>
                <p>Correct inaccurate or incomplete data</p>
              </div>
              <div className="pf-right-card">
                <div className="pf-right-icon">🗑️</div>
                <h4>Erasure</h4>
                <p>Request deletion of your personal data (&ldquo;right to be forgotten&rdquo;)</p>
              </div>
              <div className="pf-right-card">
                <div className="pf-right-icon">⏸️</div>
                <h4>Restriction</h4>
                <p>Ask us to limit how we use your data</p>
              </div>
              <div className="pf-right-card">
                <div className="pf-right-icon">📦</div>
                <h4>Portability</h4>
                <p>Receive your data in a machine-readable format</p>
              </div>
              <div className="pf-right-card">
                <div className="pf-right-icon">🚫</div>
                <h4>Objection</h4>
                <p>Object to processing based on legitimate interests</p>
              </div>
              <div className="pf-right-card">
                <div className="pf-right-icon">🔄</div>
                <h4>Withdraw consent</h4>
                <p>Withdraw consent for marketing at any time</p>
              </div>
              <div className="pf-right-card">
                <div className="pf-right-icon">🤖</div>
                <h4>Automated decisions</h4>
                <p>Not be subject to solely automated decisions with legal effects</p>
              </div>
            </div>

            <p>To exercise any of these rights, email <a href="mailto:support@mindyourbodypt.nl?subject=PostFlow%20-%20Privacy" style={{ color: "var(--teal)" }}>support@mindyourbodypt.nl?subject=PostFlow%20-%20Privacy</a>. We will respond within 30 days. We may ask you to verify your identity before processing the request.</p>
          </div>

          <div className="pf-divider" />

          {/* 8 — Security */}
          <div className="pf-section" id="security">
            <div className="pf-section-number">8</div>
            <h2>Security</h2>
            <p>We take reasonable technical and organisational measures to protect your personal data, including:</p>
            <ul>
              <li>All data transmitted over TLS/HTTPS encryption</li>
              <li>OAuth tokens stored encrypted at rest in Supabase</li>
              <li>Access to production systems restricted to authorised personnel only</li>
              <li>Row-level security on all database tables</li>
              <li>Regular security reviews</li>
            </ul>
            <p>In the event of a data breach that is likely to result in a risk to your rights and freedoms, we will notify you and the Dutch Data Protection Authority (Autoriteit Persoonsgegevens) within 72 hours as required by GDPR Article 33.</p>
          </div>

          <div className="pf-divider" />

          {/* 9 — Cookies */}
          <div className="pf-section" id="cookies">
            <div className="pf-section-number">9</div>
            <h2>Cookies</h2>
            <p>PostFlow uses the following cookies:</p>

            <table className="pf-table">
              <thead>
                <tr>
                  <th>Cookie</th>
                  <th>Purpose</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>sb-auth-token</code></td>
                  <td>Supabase authentication session</td>
                  <td>Session / 7 days</td>
                </tr>
                <tr>
                  <td><code>pf_active_brand</code></td>
                  <td>Remembers your active brand selection</td>
                  <td>1 year</td>
                </tr>
                <tr>
                  <td><code>pf-weekly-ideas</code></td>
                  <td>Caches weekly content ideas locally</td>
                  <td>7 days</td>
                </tr>
              </tbody>
            </table>

            <p>PostFlow does <strong>not</strong> use advertising cookies, tracking pixels, or third-party analytics cookies. We do not use Google Analytics.</p>
          </div>

          <div className="pf-divider" />

          {/* 10 — Contact */}
          <div className="pf-section" id="contact">
            <div className="pf-section-number">10</div>
            <h2>Contact and complaints</h2>
            <p>For any questions about this privacy policy or your personal data:</p>

            <div className="pf-contact-card">
              <h3>PostFlow Privacy</h3>
              <p>📧 <a href="mailto:support@mindyourbodypt.nl?subject=PostFlow%20-%20Privacy">support@mindyourbodypt.nl</a> <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8125rem" }}>(subject: PostFlow – Privacy)</span></p>
              <p>🏢 MindYourBodyPT B.V. · KVK: 42003965 · BTW: NL869239909B01</p>
              <p style={{ marginTop: "1rem", fontSize: "0.875rem" }}>We aim to respond to all privacy requests within 30 days.</p>
            </div>

            <h3>Right to lodge a complaint</h3>
            <p>If you believe we are processing your personal data unlawfully, you have the right to lodge a complaint with the Dutch supervisory authority:</p>
            <ul>
              <li><strong>Autoriteit Persoonsgegevens (AP)</strong></li>
              <li>Website: <a href="https://www.autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)" }}>autoriteitpersoonsgegevens.nl</a></li>
              <li>Phone: +31 (0)70 888 8500</li>
            </ul>

            <h3>Changes to this policy</h3>
            <p>We may update this privacy policy from time to time. When we make material changes, we will notify you by email and update the &ldquo;last updated&rdquo; date at the top of this page. Continued use of PostFlow after changes constitutes acceptance of the updated policy.</p>
          </div>

        </div>

        {/* Footer */}
        <footer className="pf-footer">
          <p>© 2026 MindYourBodyPT B.V. · PostFlow · KVK: 42003965 · <a href="/terms">Terms of Service</a> · <a href="mailto:support@mindyourbodypt.nl?subject=PostFlow%20-%20Support">support@mindyourbodypt.nl</a></p>
        </footer>

      </div>
    </div>
  )
}
