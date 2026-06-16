import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "PostFlow — Post consistently. Without living on your phone.",
  description:
    "PostFlow plans your content calendar, writes captions in your voice, and schedules across Instagram, LinkedIn, and Facebook. Built for service businesses who have actual work to do.",
  openGraph: {
    title: "PostFlow — Post consistently. Without living on your phone.",
    description:
      "Turn a short clip into a week of scheduled posts. Captions, reels, and carousels — written in your voice. 20 minutes a week.",
    url: "https://postflowsocials.app/join",
    siteName: "PostFlow",
    type: "website",
  },
}

// ── Platform icons (inline SVG — no deps) ─────────────────────────────────

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="currentColor" strokeWidth="1.75"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function IconTikTok({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.2 8.2 0 004.79 1.52V6.76a4.85 4.85 0 01-1.02-.07z"/>
    </svg>
  )
}

// ── Feature cards ─────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "📹",
    title: "One clip. A week of content.",
    body: "Upload any video — a tip, a case study, a quick demo. PostFlow extracts the key moments and builds Reels, carousels, and caption posts from a single take.",
  },
  {
    icon: "🎙️",
    title: "Written in your voice.",
    body: "PostFlow learns your tone, your terminology, and your audience. Captions never sound like they came from an AI prompt — because they don't.",
  },
  {
    icon: "📅",
    title: "Calendar planned, posts scheduled.",
    body: "AI fills your content calendar for the week. Edit what you like, approve, and PostFlow publishes to Instagram, LinkedIn, and Facebook at exactly the right time.",
  },
  {
    icon: "📊",
    title: "See what's actually working.",
    body: "Template health scores, engagement tracking, and optimal posting windows — all based on your real audience data. No guesswork.",
  },
]

// ── How it works ──────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Connect your accounts",
    body: "Link Instagram, LinkedIn, and Facebook directly. TikTok, X, and Threads publish via Buffer — free to set up, one-click connect.",
  },
  {
    n: "02",
    title: "Drop in a clip or a brief",
    body: "Upload a short video or describe what you want to say. PostFlow generates a full week of content — captions, hashtags, images, and reels.",
  },
  {
    n: "03",
    title: "Review, tweak, publish.",
    body: "Every post hits your drafts first. Edit anything in seconds, or tap approve. PostFlow handles the scheduling — you go back to your actual job.",
  },
]

// ── Who it's for ──────────────────────────────────────────────────────────

const PERSONAS = [
  { emoji: "🏋️", label: "Personal trainers" },
  { emoji: "🧘", label: "Coaches & therapists" },
  { emoji: "💼", label: "Consultants" },
  { emoji: "🏥", label: "Clinics & studios" },
  { emoji: "🏠", label: "Local businesses" },
  { emoji: "🧑‍💻", label: "Solo founders" },
]

// ── Pricing tiers ─────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    price: "€0",
    period: "",
    cta: "Start free",
    highlight: false,
    features: [
      "5 posts per month",
      "1 brand",
      "Instagram, LinkedIn & Facebook",
      "Basic analytics",
    ],
  },
  {
    name: "Starter",
    price: "€49",
    period: "/mo",
    cta: "Try free for 14 days",
    highlight: true,
    features: [
      "Unlimited posts",
      "Reels & Stories",
      "Brand voice training",
      "Buffer integration",
      "Standard analytics",
    ],
  },
  {
    name: "Pro",
    price: "€99",
    period: "/mo",
    cta: "Try free for 14 days",
    highlight: false,
    features: [
      "Everything in Starter",
      "3 brands",
      "Advanced analytics",
      "3 team members",
      "Unlimited templates",
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#0F1629] text-white font-[family-name:var(--font-geist-sans)] antialiased">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#0F1629]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0DA5A5] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2.18L13.18 6 8 8.82 2.82 6 8 3.18z"/>
              </svg>
            </div>
            <span className="font-semibold text-base tracking-tight">PostFlow</span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-[#0DA5A5] hover:bg-[#0b9494] text-white px-4 py-2 rounded-lg transition-colors"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">

        {/* Teal glow behind hero */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 900px 600px at 50% -80px, rgba(13,165,165,0.18) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 border border-[#0DA5A5]/30 bg-[#0DA5A5]/10 text-[#0DA5A5] text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0DA5A5] inline-block" />
            Built for service businesses
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.07] tracking-tight mb-6">
            Post consistently.
            <br />
            <span className="text-[#0DA5A5]">Without living</span>
            <br />
            on your phone.
          </h1>

          {/* Sub */}
          <p className="text-white/55 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
            PostFlow plans your content calendar, writes captions in your voice, and
            schedules posts across Instagram, LinkedIn, and Facebook.{" "}
            <span className="text-white/80 font-medium">20 minutes a week. That&apos;s it.</span>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0DA5A5] hover:bg-[#0b9494] text-white font-semibold text-base px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-[#0DA5A5]/25"
            >
              Start free — no card needed
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </Link>
            <a
              href="#how"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-white/15 hover:border-white/30 text-white/60 hover:text-white text-base px-8 py-3.5 rounded-xl transition-colors"
            >
              See how it works
            </a>
          </div>

          {/* Trust micro-copy */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-white/30">
            <span>✓ 14-day free trial</span>
            <span>·</span>
            <span>✓ Cancel any time</span>
            <span>·</span>
            <span>✓ No agency required</span>
          </div>
        </div>

        {/* ── App preview mockup ──────────────────────────────────────── */}
        <div className="relative max-w-3xl mx-auto mt-20">
          <div className="rounded-2xl bg-[#141929] overflow-hidden"
            style={{ boxShadow: "0 0 0 1px rgba(13,165,165,0.18), 0 40px 80px -20px rgba(0,0,0,0.55)" }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-[#0e1220]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.12]" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.12]" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.12]" />
              </div>
              <div className="flex-1 mx-3 h-6 rounded-md bg-white/[0.05] flex items-center px-3">
                <span className="text-[10px] text-white/20 font-mono">postflowsocials.app/calendar</span>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="p-5">
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                  <div key={d} className="text-[10px] text-center text-white/20 font-medium py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {[
                  { type: "Reel", platform: "instagram", label: "3 tips for posture" },
                  { type: "Carousel", platform: "linkedin", label: "Case study" },
                  null,
                  { type: "Post", platform: "instagram", label: "Before/after" },
                  { type: "Post", platform: "facebook", label: "Motivation" },
                  null,
                  null,
                  null,
                  { type: "Story", platform: "instagram", label: "Poll: recovery" },
                  { type: "Post", platform: "linkedin", label: "Expert insight" },
                  null,
                  { type: "Reel", platform: "instagram", label: "Quick tip" },
                  null,
                  null,
                ].map((item, i) =>
                  item ? (
                    <div
                      key={i}
                      className="rounded-lg p-2 min-h-[52px]"
                      style={{
                        background:
                          item.platform === "instagram"
                            ? "rgba(131,58,180,0.15)"
                            : item.platform === "linkedin"
                            ? "rgba(0,119,181,0.15)"
                            : "rgba(24,119,242,0.15)",
                        border: `1px solid ${
                          item.platform === "instagram"
                            ? "rgba(131,58,180,0.3)"
                            : item.platform === "linkedin"
                            ? "rgba(0,119,181,0.3)"
                            : "rgba(24,119,242,0.3)"
                        }`,
                      }}
                    >
                      <div
                        className="text-[8px] font-bold uppercase tracking-widest mb-0.5 opacity-70"
                        style={{
                          color:
                            item.platform === "instagram"
                              ? "#c084fc"
                              : item.platform === "linkedin"
                              ? "#60a5fa"
                              : "#93c5fd",
                        }}
                      >
                        {item.type}
                      </div>
                      <div className="text-[9px] leading-tight text-white/55">{item.label}</div>
                    </div>
                  ) : (
                    <div key={i} className="rounded-lg border border-white/[0.04] min-h-[52px]" />
                  )
                )}
              </div>

              {/* Status bar */}
              <div className="flex items-center gap-3 mt-4">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-[#0DA5A5] to-[#0DA5A5]/60" />
                </div>
                <span className="text-[10px] text-white/20 shrink-0">8 / 10 posts · Auto-scheduling on</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platforms strip ──────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-[#0d1220] py-10">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-[10px] text-white/25 uppercase tracking-[0.2em] font-semibold mb-7">
            Publishes directly to
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { icon: <IconInstagram className="w-5 h-5" />, label: "Instagram", color: "#E1306C", dim: false },
              { icon: <IconLinkedIn className="w-5 h-5" />, label: "LinkedIn", color: "#0077B5", dim: false },
              { icon: <IconFacebook className="w-5 h-5" />, label: "Facebook", color: "#1877F2", dim: false },
              { icon: <IconTikTok className="w-5 h-5" />, label: "TikTok", color: "#ffffff", dim: true },
              {
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.733-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                ),
                label: "X",
                color: "#ffffff",
                dim: true,
              },
              {
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 192 192" fill="currentColor">
                    <path d="M96 16C53.2 16 18 51.2 18 94s35.2 78 78 78 78-35.2 78-78S138.8 16 96 16zm0 20.4c24.8 0 46.4 12 59.8 30.4H36.2C49.6 48.4 71.2 36.4 96 36.4zM36 94c0-4 .4-8 1.2-11.6h117.6c.8 3.6 1.2 7.6 1.2 11.6s-.4 8-1.2 11.6H37.2C36.4 102 36 98 36 94zm60 57.6c-24.8 0-46.4-12-59.8-30.4h119.6C142.4 139.6 120.8 151.6 96 151.6z"/>
                  </svg>
                ),
                label: "Threads",
                color: "#ffffff",
                dim: true,
              },
            ].map(({ icon, label, color, dim }) => (
              <div
                key={label}
                className="flex items-center gap-2"
                style={{ color: dim ? "rgba(255,255,255,0.3)" : color }}
              >
                {icon}
                <span className={`text-sm font-medium ${dim ? "text-white/30" : "text-white/55"}`}>
                  {label}
                  {dim && <span className="text-white/20 text-xs ml-1">via Buffer</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6 text-center">
          {[
            { stat: "20 min", label: "to plan your whole week" },
            { stat: "6×", label: "platforms from one post" },
            { stat: "0", label: "midnight caption sessions" },
          ].map(({ stat, label }) => (
            <div key={label}>
              <p className="text-4xl sm:text-5xl font-bold text-[#0DA5A5] mb-2 tabular-nums">{stat}</p>
              <p className="text-sm text-white/35 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-[#0d1220]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#0DA5A5] text-xs font-bold tracking-widest uppercase mb-3">What it does</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything you&apos;d hire a content team for.
            </h2>
            <p className="text-white/40 mt-3 text-base max-w-xl mx-auto">
              Without the briefings, revisions, or monthly retainers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/[0.07] bg-[#141929] p-7 hover:border-[#0DA5A5]/25 transition-colors group"
              >
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-[#0DA5A5] transition-colors">
                  {title}
                </h3>
                <p className="text-white/40 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#0DA5A5] text-xs font-bold tracking-widest uppercase mb-3">The process</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              From nothing to scheduled in three steps.
            </h2>
          </div>

          <div className="space-y-6">
            {STEPS.map(({ n, title, body }, i) => (
              <div
                key={n}
                className="flex gap-5 items-start rounded-2xl border border-white/[0.07] p-6 bg-[#141929]"
              >
                <div className="shrink-0 w-11 h-11 rounded-xl border border-[#0DA5A5]/30 bg-[#0DA5A5]/10 flex items-center justify-center">
                  <span className="text-[#0DA5A5] text-xs font-bold tabular-nums">{n}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-1.5">{title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[#0d1220]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-white/25 text-xs font-bold tracking-widest uppercase mb-6">Made for</p>
          <div className="flex flex-wrap justify-center gap-3">
            {PERSONAS.map(({ emoji, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2.5 border border-white/[0.08] bg-white/[0.03] rounded-full px-4 py-2 text-sm text-white/55"
              >
                <span>{emoji}</span>
                {label}
              </div>
            ))}
          </div>
          <p className="text-white/25 text-sm mt-6 max-w-md mx-auto">
            If you have expertise worth sharing and clients worth reaching — PostFlow is for you.
          </p>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#0DA5A5] text-xs font-bold tracking-widest uppercase mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Start free. Upgrade when you&apos;re ready.
            </h2>
            <p className="text-white/35 mt-3 text-sm">
              All paid plans include a 14-day free trial. No card required to start.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {PLANS.map(({ name, price, period, cta, highlight, features }) => (
              <div
                key={name}
                className={`rounded-2xl border p-6 flex flex-col relative ${
                  highlight
                    ? "border-[#0DA5A5]/40 bg-[#0DA5A5]/[0.06] shadow-xl shadow-[#0DA5A5]/10"
                    : "border-white/[0.07] bg-[#141929]"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0DA5A5] text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full whitespace-nowrap">
                    Most popular
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-sm font-medium text-white/40 mb-1">{name}</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-4xl font-bold">{price}</span>
                    {period && <span className="text-white/35 text-sm">{period}</span>}
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/55">
                      <svg className="w-4 h-4 text-[#0DA5A5] shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    highlight
                      ? "bg-[#0DA5A5] hover:bg-[#0b9494] text-white"
                      : "border border-white/[0.12] hover:border-white/25 text-white/60 hover:text-white"
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-white/20 text-xs mt-6">
            Annual billing saves 20% · VAT included for EU · Pause or cancel any time
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────── */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 700px 400px at 50% 50%, rgba(13,165,165,0.13) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight tracking-tight">
            Your next week of posts is
            <br />
            <span className="text-[#0DA5A5]">already inside you.</span>
          </h2>
          <p className="text-white/40 text-base mb-10 leading-relaxed max-w-lg mx-auto">
            Stop staring at a blank caption box. PostFlow turns what you already know into content your audience actually wants to read.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-[#0DA5A5] hover:bg-[#0b9494] text-white font-bold text-lg px-10 py-4 rounded-2xl transition-colors shadow-2xl shadow-[#0DA5A5]/20"
          >
            Get started free
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </Link>
          <p className="text-white/20 text-xs mt-5">No card required · Setup takes under 3 minutes</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#0DA5A5] flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1L1 5v6l7 4 7-4V5L8 1zm0 2.18L13.18 6 8 8.82 2.82 6 8 3.18z"/>
              </svg>
            </div>
            <span className="text-sm font-medium text-white/50">PostFlow</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/25">
            <Link href="/privacy" className="hover:text-white/55 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/55 transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-white/55 transition-colors">Sign in</Link>
          </div>
          <p className="text-xs text-white/15">© 2026 PostFlow · postflowsocials.app</p>
        </div>
      </footer>

    </div>
  )
}
