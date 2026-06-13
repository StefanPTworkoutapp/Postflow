import { Plus_Jakarta_Sans } from "next/font/google"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
})

export const metadata = {
  title: "Terms of Service – PostFlow",
  description: "Terms of Service for PostFlow",
}

export default function TermsPage() {
  return (
    <div className={`${jakarta.variable} pf-legal`} style={{ fontFamily: "var(--font-jakarta, system-ui, sans-serif)" }}>
      <style>{`
        .pf-legal { background: #fff; color: #111827; min-height: 100vh; }
        .pf-legal-nav { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 2rem; border-bottom: 1px solid #e5e7eb; }
        .pf-legal-logo { font-weight: 700; font-size: 1.125rem; color: #111827; text-decoration: none; letter-spacing: -0.02em; }
        .pf-legal-logo span { color: #0DA5A5; }
        .pf-legal-back { font-size: 0.875rem; color: #6b7280; text-decoration: none; }
        .pf-legal-back:hover { color: #0DA5A5; }
        .pf-legal-body { max-width: 720px; margin: 0 auto; padding: 3rem 2rem 6rem; }
        .pf-legal-body h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.03em; margin: 0 0 0.5rem; }
        .pf-legal-meta { font-size: 0.875rem; color: #6b7280; margin-bottom: 2.5rem; }
        .pf-legal-body h2 { font-size: 1.125rem; font-weight: 600; margin: 2rem 0 0.75rem; }
        .pf-legal-body p, .pf-legal-body li { font-size: 0.9375rem; line-height: 1.75; color: #374151; }
        .pf-legal-body ul { padding-left: 1.5rem; margin: 0.5rem 0 1rem; }
        .pf-legal-body li { margin-bottom: 0.25rem; }
        .pf-legal-footer { text-align: center; padding: 2rem; border-top: 1px solid #e5e7eb; font-size: 0.8125rem; color: #9ca3af; }
      `}</style>

      <nav className="pf-legal-nav">
        <a href="/" className="pf-legal-logo">Post<span>Flow</span></a>
        <a href="/" className="pf-legal-back">← Back to PostFlow</a>
      </nav>

      <div className="pf-legal-body">
        <h1>Terms of Service</h1>
        <p className="pf-legal-meta">Last updated: June 2026</p>

        <p>
          These Terms of Service ("Terms") govern your access to and use of PostFlow ("Service"), operated by PostFlow
          ("we", "us", or "our"). By creating an account or using the Service, you agree to be bound by these Terms.
        </p>

        <h2>1. The Service</h2>
        <p>
          PostFlow is a social media management platform that allows you to plan, generate, schedule, and publish
          content to social media platforms including Instagram, Facebook, LinkedIn, and TikTok. You may connect
          third-party social accounts to your PostFlow account to enable publishing.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>You must be at least 18 years old to use PostFlow.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You may not share your account or use it on behalf of others without their consent.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
        </ul>

        <h2>3. Acceptable Use</h2>
        <p>You agree not to use PostFlow to:</p>
        <ul>
          <li>Post content that violates applicable law or the terms of any connected social platform.</li>
          <li>Distribute spam, malware, or misleading content.</li>
          <li>Attempt to gain unauthorized access to our systems or other users' accounts.</li>
          <li>Reverse-engineer, copy, or resell any part of the Service.</li>
        </ul>

        <h2>4. Third-Party Platforms</h2>
        <p>
          PostFlow integrates with third-party social media platforms (Instagram, Facebook, LinkedIn, TikTok, and
          others). Your use of those platforms is also governed by their respective terms of service. PostFlow is not
          responsible for third-party platform outages, API changes, or policy decisions that affect functionality.
        </p>
        <p>
          When you connect a social account, you grant PostFlow permission to publish content on your behalf as
          directed by you through the platform. You can revoke this access at any time from your connections
          settings or directly on the third-party platform.
        </p>

        <h2>5. Subscription and Billing</h2>
        <ul>
          <li>PostFlow offers paid subscription plans. Pricing is displayed on the pricing page.</li>
          <li>Subscriptions renew automatically unless cancelled before the renewal date.</li>
          <li>We do not offer refunds for partial billing periods.</li>
          <li>We reserve the right to change pricing with 30 days' notice to existing subscribers.</li>
        </ul>

        <h2>6. Content and Data</h2>
        <p>
          You retain ownership of all content you create or upload to PostFlow. By using the Service, you grant
          PostFlow a limited license to store and process your content solely to provide the Service. We do not
          sell your content to third parties.
        </p>
        <p>
          We may use aggregated, anonymized usage data to improve the Service. See our{" "}
          <a href="/privacy" style={{ color: "#0DA5A5" }}>Privacy Policy</a> for details.
        </p>

        <h2>7. Service Availability</h2>
        <p>
          We aim for high availability but cannot guarantee uninterrupted service. We may perform maintenance,
          updates, or experience outages. We are not liable for losses caused by service unavailability.
        </p>

        <h2>8. Termination</h2>
        <p>
          You may delete your account at any time. We may suspend or terminate accounts that violate these Terms.
          Upon termination, your right to use the Service ceases immediately. We may retain certain data as
          required by law or for legitimate business purposes.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, PostFlow is not liable for indirect, incidental, special, or
          consequential damages arising from your use of the Service. Our total liability for any claim is limited
          to the amount you paid us in the 3 months preceding the claim.
        </p>

        <h2>10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify you of material changes by email or via the
          Service. Continued use after changes take effect constitutes acceptance of the revised Terms.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the Netherlands. Disputes will be resolved in the courts of the
          Netherlands, unless mandatory consumer protection law in your country provides otherwise.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about these Terms? Contact us at{" "}
          <a href="mailto:info@postflow.app" style={{ color: "#0DA5A5" }}>info@postflow.app</a>.
        </p>
      </div>

      <footer className="pf-legal-footer">
        © {new Date().getFullYear()} PostFlow. All rights reserved. ·{" "}
        <a href="/privacy" style={{ color: "#9ca3af" }}>Privacy Policy</a>
      </footer>
    </div>
  )
}
