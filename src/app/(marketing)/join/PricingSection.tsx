"use client"

import { useState }  from "react"
import Link           from "next/link"
import { PLANS, TRIAL_DAYS, ANNUAL_DISCOUNT_PERCENT } from "@/lib/config/pricing"

// ── Plan display data ──────────────────────────────────────────────────────

const DISPLAY_PLANS = [
  {
    ...PLANS.free,
    cta:         "Start free",
    highlighted: false,
    items: [
      { text: "5 posts per month",               detail: null },
      { text: "1 brand",                          detail: null },
      { text: "Instagram, LinkedIn & Facebook",   detail: null },
      { text: "Basic analytics",                  detail: "Reach, likes, comments per post" },
    ],
  },
  {
    ...PLANS.starter,
    cta:         `Try free for ${TRIAL_DAYS} days`,
    highlighted: true,
    items: [
      { text: "Unlimited posts",         detail: null },
      { text: "Reels & Stories",         detail: null },
      { text: "Brand voice",             detail: null },
      { text: "Buffer integration",      detail: null },
      { text: "Standard analytics",      detail: "Post performance, template health scores, weekly trend digest" },
    ],
  },
  {
    ...PLANS.pro,
    cta:         `Try free for ${TRIAL_DAYS} days`,
    highlighted: false,
    items: [
      { text: "Everything in Starter",   detail: null },
      { text: "3 brands",               detail: null },
      { text: "3 team members",         detail: null },
      { text: "Unlimited templates",    detail: null },
      { text: "Advanced analytics",     detail: "Performance trends over time, A/B template comparison, Reel completion rates, carousel swipe rates, lock your best template" },
    ],
  },
] as const

// ── Component ─────────────────────────────────────────────────────────────

export function PricingSection() {
  const [billing, setBilling] = useState<"annual" | "monthly">("annual")

  return (
    <section id="pricing" className="border-t border-white/[0.06] py-24 px-6 bg-[#0d1321]">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              Simple pricing. No surprises.
            </h2>
            <p className="text-white/40 text-sm">
              All paid plans include a {TRIAL_DAYS}-day free trial — no card required.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.08] rounded-xl p-1 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === "annual"
                  ? "bg-[#0DA5A5] text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Annual
              {billing !== "annual" && (
                <span className="ml-1.5 text-[10px] font-bold text-[#0DA5A5]">
                  −{ANNUAL_DISCOUNT_PERCENT}%
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {DISPLAY_PLANS.map(({ name, monthly, annual, cta, highlighted, items }) => {
            const price     = billing === "annual" ? annual  : monthly
            const altPrice  = billing === "annual" ? monthly : annual
            const isAnnual  = billing === "annual"
            const hasPricing = monthly > 0

            return (
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

                {/* Price — annual price shown BIG */}
                <div className="mb-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold tabular-nums">
                      €{price}
                    </span>
                    {hasPricing && (
                      <span className="text-white/30 text-sm">/mo</span>
                    )}
                  </div>
                  {hasPricing && (
                    <p className="text-xs text-white/30 mt-1 h-4">
                      {isAnnual
                        ? `Billed annually · or €${altPrice}/mo monthly`
                        : <span className="text-[#0DA5A5]/70">Save €{(monthly - annual) * 12}/yr with annual billing</span>
                      }
                    </p>
                  )}
                  {!hasPricing && <p className="text-xs text-white/20 mt-1 h-4">Free forever</p>}
                </div>

                {/* Feature list */}
                <ul className="space-y-3 flex-1 mt-6 mb-7">
                  {items.map(({ text, detail }) => (
                    <li key={text} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-[#0DA5A5] shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div>
                        <span className="text-sm text-white/60">{text}</span>
                        {detail && (
                          <p className="text-[11px] text-white/25 mt-0.5 leading-relaxed">{detail}</p>
                        )}
                      </div>
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
            )
          })}
        </div>

        {/* Fine print */}
        <p className="text-white/20 text-xs mb-16">
          Prices exclude VAT where applicable. EU VAT handled automatically.
          Pause or cancel any time.
        </p>

        {/* Agency row */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#141929] px-8 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-semibold mb-1">Managing social for multiple clients?</p>
            <p className="text-sm text-white/40 max-w-md">
              PostFlow has Studio, Business, and Agency plans built for teams running content across multiple brands.
              Volume pricing, white-label options, and dedicated support.
            </p>
          </div>
          <Link
            href="/contact"
            className="shrink-0 inline-flex items-center gap-2 border border-white/15 hover:border-[#0DA5A5]/50 hover:text-[#0DA5A5] text-white/60 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
          >
            Talk to us
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </Link>
        </div>

      </div>
    </section>
  )
}
