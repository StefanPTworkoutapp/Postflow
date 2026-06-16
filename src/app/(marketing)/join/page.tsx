import Link from "next/link"
import type { Metadata } from "next"
import { PLANS, TRIAL_DAYS, ANNUAL_DISCOUNT_PERCENT, formatPrice } from "@/lib/config/pricing"

export const metadata: Metadata = {
  title: "PostFlow — Your expertise, finally on social.",
  description:
    "PostFlow turns your knowledge into scheduled content across Instagram, LinkedIn, Facebook, TikTok, X, and Threads. Built for service businesses who have actual clients to serve.",
  openGraph: {
    title: "PostFlow — Your expertise, finally on social.",
    description:
      "Upload a clip. Get a week of posts. Scheduled across 6 platforms, written in your voice, in under 20 minutes.",
    url: "https://postflowsocials.app/join",
    siteName: "PostFlow",
    type: "website",
  },
}

// ── Shared mark ───────────────────────────────────────────────────────────

function Logo({ size = 7 }: { size?: number }) {
  const s = `w-${size} h-${size}`
  return (
    <div className={`${s} rounded-lg bg-[#0DA5A5] flex items-center justify-center shrink-0`}>
      <svg className="w-[58%] h-[58%] text-white" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2.18L13.18 6 8 8.82 2.82 6 8 3.18z"/>
      </svg>
    </div>
  )
}

// ── Platform SVG icons ────────────────────────────────────────────────────

const PLATFORMS = [
  {
    key:    "instagram",
    label:  "Instagram",
    direct: true,
    note:   "Posts, Reels & Stories",
    color:  "#E1306C",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
        <rect x="2" y="2" width="20" height="20" rx="5.5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    key:    "linkedin",
    label:  "LinkedIn",
    direct: true,
    note:   "Posts & images",
    color:  "#0077B5",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    key:    "facebook",
    label:  "Facebook",
    direct: true,
    note:   "Page posts",
    color:  "#1877F2",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    key:    "tiktok",
    label:  "TikTok",
    direct: false,
    note:   "via Buffer",
    color:  "#ffffff",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.2 8.2 0 004.79 1.52V6.76a4.85 4.85 0 01-1.02-.07z"/>
      </svg>
    ),
  },
  {
    key:    "x",
    label:  "X",
    direct: false,
    note:   "via Buffer",
    color:  "#ffffff",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.733-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    key:    "threads",
    label:  "Threads",
    direct: false,
    note:   "via Buffer",
    color:  "#ffffff",
    icon: (
      <svg viewBox="0 0 192 192" fill="currentColor" className="w-5 h-5">
        <path d="M141.537 88.988a66.667 66.667 0 00-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.05l13.24 9.087c5.742-8.712 14.76-10.565 21.88-10.565h.23c8.446.054 14.83 2.51 18.985 7.3 3.012 3.512 5.023 8.374 5.997 14.5a110.148 110.148 0 00-24.246-.274c-24.4 1.407-40.104 15.672-39.052 35.49.527 9.938 5.406 18.489 13.75 24.055 7.05 4.752 16.124 7.066 25.557 6.537 12.455-.696 22.222-5.415 29.049-14.027 5.1-6.497 8.32-14.91 9.677-25.49a58.92 58.92 0 018.44 5.097c8.136 5.907 12.621 14.612 12.518 23.931-.18 16.301-13.702 29.677-32.604 34.924-8.174 2.25-17.08 3.118-26.47 2.58-9.358-.535-18.092-3.001-25.97-7.335-14.57-8.046-22.896-20.98-23.557-36.53-.5-11.77 3.412-22.59 11.347-31.262C48.57 95.44 58.5 88.986 70.71 85.393c12.75-3.762 26.93-4.283 41.1-1.538a85.54 85.54 0 0110.388 2.813 60.154 60.154 0 00-1.06-8.208c-3.94-18.56-16.49-27.65-37.76-27.65h-.2c-12.58 0-23.3 4.22-30.98 12.2L41.53 53.896C52.07 42.457 66.81 36 84.23 36h.34c32.25.21 50.38 19.693 51.965 55.27.16 3.706.135 7.405-.043 11.04z"/>
      </svg>
    ),
  },
]

// ── Pricing display data (derived from config) ────────────────────────────

const DISPLAY_PLANS = [
  {
    ...PLANS.free,
    cta:         "Start free",
    highlighted: false,
    items: [
      `${PLANS.free.limits.postsPerMonth} posts per month`,
      "1 brand",
      "Instagram, LinkedIn & Facebook",
      "Basic analytics",
    ],
  },
  {
    ...PLANS.starter,
    cta:         `Try free for ${TRIAL_DAYS} days`,
    highlighted: true,
    items: [
      "Unlimited posts",
      "Reels & Stories",
      "Brand voice",
      "Buffer integration",
      "Standard analytics",
    ],
  },
  {
    ...PLANS.pro,
    cta:         `Try free for ${TRIAL_DAYS} days`,
    highlighted: false,
    items: [
      "Everything in Starter",
      "3 brands",
      "Advanced analytics",
      "3 team members",
      "Unlimited templates",
    ],
  },
] as const

// ── Page ──────────────────────────────────────────────────────────────────

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white font-[family-name:var(--font-geist-sans)] antialiased selection:bg-[#0DA5A5]/30">

      {/* ══ NAV ══════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.05] bg-[#0A0F1E]/80 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={6} />
            <span className="font-semibold text-sm tracking-tight">PostFlow</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-white/40 hover:text-white/80 transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-[#0DA5A5] hover:bg-[#0b9494] text-white px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative pt-40 pb-28 px-6">
        {/* Subtle glow */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20"
          style={{ background: "radial-gradient(ellipse at center, #0DA5A5 0%, transparent 65%)" }}
        />

        <div className="relative max-w-4xl mx-auto">
          {/* Main headline */}
          <h1 className="text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[1.05] tracking-tight mb-8 max-w-3xl">
            You&apos;re great at{" "}
            <br className="hidden sm:block"/>
            what you do.
            <br />
            <span className="text-[#0DA5A5]">Instagram doesn&apos;t</span>
            <br />
            <span className="text-[#0DA5A5]">know it yet.</span>
          </h1>

          {/* Sub */}
          <p className="text-white/50 text-lg sm:text-xl leading-relaxed max-w-xl mb-10">
            PostFlow turns your expertise into scheduled content across{" "}
            <span className="text-white/75">all 6 platforms</span> — in under 20 minutes a week.
            Upload a clip, approve the posts, get back to your clients.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-start gap-3 mb-6">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[#0DA5A5] hover:bg-[#0b9494] text-white font-semibold text-base px-7 py-3.5 rounded-xl transition-all shadow-[0_0_24px_rgba(13,165,165,0.3)] hover:shadow-[0_0_32px_rgba(13,165,165,0.45)]"
            >
              Start free
              <svg className="w-4 h-4 opacity-80" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-base py-3.5 transition-colors"
            >
              Already have an account →
            </Link>
          </div>

          <p className="text-white/20 text-sm">
            {TRIAL_DAYS}-day free trial on paid plans. No card required to start.
          </p>
        </div>
      </section>

      {/* ══ PLATFORMS ════════════════════════════════════════════════════ */}
      <section className="border-y border-white/[0.06] py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/20 text-xs uppercase tracking-[0.2em] font-medium mb-8 text-center">
            Publishes to
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {PLATFORMS.map(({ key, label, direct, note, color, icon }) => (
              <div key={key} className="flex flex-col items-center gap-2 text-center group">
                <div
                  className="w-11 h-11 rounded-xl border border-white/[0.08] flex items-center justify-center transition-colors group-hover:border-white/20"
                  style={{ color: direct ? color : "rgba(255,255,255,0.35)" }}
                >
                  {icon}
                </div>
                <div>
                  <p className={`text-xs font-medium ${direct ? "text-white/60" : "text-white/25"}`}>
                    {label}
                  </p>
                  <p className="text-[10px] text-white/20 mt-0.5">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WHAT HAPPENS ═════════════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-[1fr_1px_1fr_1px_1fr] gap-0">

            {/* Step 1 */}
            <div className="py-8 md:pr-12">
              <p className="text-[#0DA5A5] text-xs font-bold tracking-[0.15em] uppercase mb-5">01 — Input</p>
              <h3 className="text-xl font-semibold mb-3 leading-snug">
                Upload a clip, a voice note, or just a topic.
              </h3>
              <p className="text-white/40 text-sm leading-relaxed">
                Sixty seconds of you explaining something you already know. A behind-the-scenes moment. A client win. PostFlow does the rest — no script needed.
              </p>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-white/[0.06] mx-6" />

            {/* Step 2 */}
            <div className="py-8 md:px-6">
              <p className="text-[#0DA5A5] text-xs font-bold tracking-[0.15em] uppercase mb-5">02 — Generate</p>
              <h3 className="text-xl font-semibold mb-3 leading-snug">
                A full week of posts, written in your voice.
              </h3>
              <p className="text-white/40 text-sm leading-relaxed">
                Captions, hashtags, Reels, carousels, Stories — all generated from your content and trained on your tone. Every post sounds like you wrote it on a good day.
              </p>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-white/[0.06] mx-6" />

            {/* Step 3 */}
            <div className="py-8 md:pl-12">
              <p className="text-[#0DA5A5] text-xs font-bold tracking-[0.15em] uppercase mb-5">03 — Publish</p>
              <h3 className="text-xl font-semibold mb-3 leading-snug">
                Review, approve, done. PostFlow handles the rest.
              </h3>
              <p className="text-white/40 text-sm leading-relaxed">
                Posts land in your drafts. Edit anything. Approve what works. PostFlow schedules and publishes across every connected platform at the right time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ HONEST PRODUCT TRUTH ═════════════════════════════════════════ */}
      <section className="border-t border-white/[0.06] py-24 px-6 bg-[#0d1321]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-x-20 gap-y-14">

            <div>
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight mb-6">
                Built for people with actual work to do.
              </h2>
              <p className="text-white/45 leading-relaxed">
                PostFlow is not for agencies. It&apos;s not for content creators whose job is content. It&apos;s for the physio, the coach, the consultant, the studio owner — someone who is excellent at their craft and has been putting off social media for months because there&apos;s always something more important.
              </p>
            </div>

            <div className="space-y-7">
              {[
                {
                  label: "Brand voice that sticks",
                  body: "PostFlow learns from how you write and talk. Captions don't come out sounding generic — they come out sounding like you on a day when you actually had time to think.",
                },
                {
                  label: "One content source. Six platforms.",
                  body: "A single clip can become a Reel on Instagram, a long-form post on LinkedIn, a Story, a carousel, and three text posts. PostFlow knows what each platform needs.",
                },
                {
                  label: "Your calendar, filled in advance.",
                  body: "PostFlow suggests a week of posts based on what works for your audience and what you haven't covered recently. You approve or edit — never start from scratch.",
                },
              ].map(({ label, body }) => (
                <div key={label} className="flex gap-4">
                  <div className="w-px bg-[#0DA5A5]/40 shrink-0 mt-1" style={{ minHeight: "100%" }} />
                  <div>
                    <p className="font-semibold text-sm mb-1.5">{label}</p>
                    <p className="text-white/40 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ WHAT YOU GET ════════════════════════════════════════════════ */}
      <section className="border-t border-white/[0.06] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.05] rounded-2xl overflow-hidden border border-white/[0.05]">
            {[
              { number: "6",       label: "platforms",              sub: "Instagram, LinkedIn, Facebook, TikTok, X, Threads" },
              { number: "3",       label: "post types per clip",    sub: "Reel, carousel, and caption post — one input" },
              { number: "20 min",  label: "per week",               sub: "From upload to full week of scheduled content" },
              { number: "0",       label: "blank caption boxes",    sub: "Every post drafted before you even open the app" },
            ].map(({ number, label, sub }) => (
              <div key={label} className="bg-[#0d1321] p-7 flex flex-col gap-3">
                <p className="text-4xl font-bold text-[#0DA5A5] tabular-nums">{number}</p>
                <div>
                  <p className="font-semibold text-sm mb-1">{label}</p>
                  <p className="text-white/30 text-xs leading-relaxed">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING ══════════════════════════════════════════════════════ */}
      <section id="pricing" className="border-t border-white/[0.06] py-24 px-6 bg-[#0d1321]">
        <div className="max-w-5xl mx-auto">

          <div className="mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Simple pricing. No surprises.
            </h2>
            <p className="text-white/40">
              All paid plans include a {TRIAL_DAYS}-day free trial — no card required.
              Annual billing saves {ANNUAL_DISCOUNT_PERCENT}%.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {DISPLAY_PLANS.map(({ name, monthly, annual, cta, highlighted, items }) => (
              <div
                key={name}
                className={`rounded-2xl p-6 flex flex-col relative ${
                  highlighted
                    ? "bg-[#0DA5A5]/[0.08] border border-[#0DA5A5]/30"
                    : "bg-[#141929] border border-white/[0.07]"
                }`}
              >
                {highlighted && (
                  <p className="absolute top-4 right-4 text-[10px] text-[#0DA5A5] font-bold tracking-widest uppercase">
                    Popular
                  </p>
                )}

                <p className="text-sm font-medium text-white/40 mb-1">{name}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">{formatPrice(monthly)}</span>
                  {monthly > 0 && (
                    <span className="text-white/30 text-sm">
                      /mo · {formatPrice(annual)}/mo annual
                    </span>
                  )}
                </div>

                <ul className="space-y-2.5 flex-1 mb-7">
                  {items.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/55">
                      <svg className="w-4 h-4 text-[#0DA5A5] shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    highlighted
                      ? "bg-[#0DA5A5] hover:bg-[#0b9494] text-white"
                      : "border border-white/10 hover:border-white/20 text-white/50 hover:text-white/80"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-white/20 text-xs mt-6">
            Prices exclude VAT where applicable. EU VAT handled automatically.
            Pause or cancel any time.
          </p>
        </div>
      </section>

      {/* ══ CLOSING ══════════════════════════════════════════════════════ */}
      <section className="border-t border-white/[0.06] py-28 px-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-15"
          style={{ background: "radial-gradient(ellipse at center bottom, #0DA5A5 0%, transparent 70%)" }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5 leading-tight">
            Stop putting it off.
            <br />
            Your audience is already out there.
          </h2>
          <p className="text-white/35 text-base mb-10 max-w-xl mx-auto leading-relaxed">
            You&apos;ve been meaning to post consistently for a while now. PostFlow makes that the easy part.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#0DA5A5] hover:bg-[#0b9494] text-white font-bold text-base px-9 py-4 rounded-2xl transition-all shadow-[0_0_32px_rgba(13,165,165,0.25)] hover:shadow-[0_0_48px_rgba(13,165,165,0.4)]"
          >
            Get started free
            <svg className="w-4 h-4 opacity-80" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </Link>
          <p className="text-white/20 text-xs mt-4">No card required · Setup in under 3 minutes</p>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.05] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={5} />
            <span className="text-sm text-white/40 font-medium">PostFlow</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/20">
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy policy</Link>
            <Link href="/terms" className="hover:text-white/50 transition-colors">Terms of use</Link>
            <Link href="/login" className="hover:text-white/50 transition-colors">Sign in</Link>
          </div>
          <p className="text-[11px] text-white/15">© 2026 PostFlow · postflowsocials.app</p>
        </div>
      </footer>

    </div>
  )
}
