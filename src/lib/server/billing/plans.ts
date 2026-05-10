/**
 * Plan definitions, feature limits, and Stripe/Mollie price IDs.
 * Single source of truth — used by checkout, webhooks, and limit enforcement.
 */

export type PlanTier = "free" | "starter" | "pro" | "business"
export type BillingInterval = "monthly" | "annual"

export interface PlanLimits {
  postsPerMonth:     number | null   // null = unlimited
  brands:            number
  storageGb:         number
  customTemplates:   number | null   // null = unlimited
  teamMembers:       number
  analyticsLevel:    "none" | "basic" | "standard" | "advanced"
  bufferIntegration: boolean
  storiesReels:      boolean
  weeklyTrendEmail:  boolean
}

export interface PlanDefinition {
  tier:             PlanTier
  name:             string
  monthlyEurCents:  number
  annualEurCents:   number            // per month, billed annually
  limits:           PlanLimits
  // Stripe price IDs (set via env vars so they can differ between test/live)
  stripePriceMonthly: string | null
  stripePriceAnnual:  string | null
  // Mollie plan ID (used for recurring)
  molliePlanId:       string | null
  highlight?:         string          // marketing label (e.g. "Most popular")
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier:            "free",
    name:            "Free",
    monthlyEurCents: 0,
    annualEurCents:  0,
    limits: {
      postsPerMonth:     5,
      brands:            1,
      storageGb:         1,
      customTemplates:   0,
      teamMembers:       1,
      analyticsLevel:    "basic",
      bufferIntegration: false,
      storiesReels:      false,
      weeklyTrendEmail:  false,
    },
    stripePriceMonthly: null,
    stripePriceAnnual:  null,
    molliePlanId:       null,
  },

  starter: {
    tier:            "starter",
    name:            "Starter",
    monthlyEurCents: 4900,
    annualEurCents:  3900,
    limits: {
      postsPerMonth:     null,
      brands:            1,
      storageGb:         10,
      customTemplates:   5,
      teamMembers:       1,
      analyticsLevel:    "standard",
      bufferIntegration: true,
      storiesReels:      true,
      weeklyTrendEmail:  true,
    },
    stripePriceMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? null,
    stripePriceAnnual:  process.env.STRIPE_PRICE_STARTER_ANNUAL  ?? null,
    molliePlanId:       process.env.MOLLIE_PLAN_STARTER           ?? null,
    highlight:          "Most popular",
  },

  pro: {
    tier:            "pro",
    name:            "Pro",
    monthlyEurCents: 9900,
    annualEurCents:  7900,
    limits: {
      postsPerMonth:     null,
      brands:            3,
      storageGb:         50,
      customTemplates:   null,
      teamMembers:       3,
      analyticsLevel:    "advanced",
      bufferIntegration: true,
      storiesReels:      true,
      weeklyTrendEmail:  true,
    },
    stripePriceMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
    stripePriceAnnual:  process.env.STRIPE_PRICE_PRO_ANNUAL  ?? null,
    molliePlanId:       process.env.MOLLIE_PLAN_PRO           ?? null,
  },

  business: {
    tier:            "business",
    name:            "Business",
    monthlyEurCents: 19900,
    annualEurCents:  15900,
    limits: {
      postsPerMonth:     null,
      brands:            10,
      storageGb:         200,
      customTemplates:   null,
      teamMembers:       10,
      analyticsLevel:    "advanced",
      bufferIntegration: true,
      storiesReels:      true,
      weeklyTrendEmail:  true,
    },
    stripePriceMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? null,
    stripePriceAnnual:  process.env.STRIPE_PRICE_BUSINESS_ANNUAL  ?? null,
    molliePlanId:       process.env.MOLLIE_PLAN_BUSINESS           ?? null,
  },
}

export function getPlan(tier: string): PlanDefinition {
  return PLANS[tier as PlanTier] ?? PLANS.free
}

export function getLimits(tier: string): PlanLimits {
  return getPlan(tier).limits
}

/** Format euro cents as "€49" or "€49/mo" */
export function formatPrice(cents: number, suffix?: string): string {
  const euros = cents / 100
  const str = euros % 1 === 0 ? `€${euros}` : `€${euros.toFixed(2)}`
  return suffix ? `${str}${suffix}` : str
}

export const TRIAL_DAYS = 14
