/**
 * Plan definitions, feature limits, and Stripe/Mollie price IDs.
 * Single source of truth — used by checkout, webhooks, and limit enforcement.
 */

export type PlanTier = "free" | "starter" | "pro" | "studio" | "agency" | "business"
export type BillingInterval = "monthly" | "annual"

export interface PlanLimits {
  postsPerMonth:     number | null   // null = unlimited
  /** Brand limit: positive integer, or -1 for unlimited. */
  brands:            number
  storageGb:         number
  customTemplates:   number | null   // null = unlimited
  teamMembers:       number
  analyticsLevel:    "none" | "basic" | "standard" | "advanced"
  bufferIntegration: boolean
  storiesReels:      boolean
  weeklyTrendEmail:  boolean
  /** Max saved template slots per post type. 1 = no rotation. */
  templateSlotsPerPostType: number
  /** How many of those slots can be locked (immune to auto-swap). 0 = no locking. */
  templateLockSlots: number
}

/** Sentinel value: brands limit = -1 means unlimited. */
export const UNLIMITED_BRANDS = -1

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
      templateSlotsPerPostType: 1,
      templateLockSlots:        0,
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
      templateSlotsPerPostType: 1,
      templateLockSlots:        0,
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
      templateSlotsPerPostType: 3,
      templateLockSlots:        1,
    },
    stripePriceMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
    stripePriceAnnual:  process.env.STRIPE_PRICE_PRO_ANNUAL  ?? null,
    molliePlanId:       process.env.MOLLIE_PLAN_PRO           ?? null,
  },

  studio: {
    tier:            "studio",
    name:            "Studio",
    monthlyEurCents: 14900,
    annualEurCents:  11900,
    limits: {
      postsPerMonth:     null,
      brands:            5,
      storageGb:         100,
      customTemplates:   null,
      teamMembers:       5,
      analyticsLevel:    "advanced",
      bufferIntegration: true,
      storiesReels:      true,
      weeklyTrendEmail:  true,
      templateSlotsPerPostType: 5,
      templateLockSlots:        2,
    },
    stripePriceMonthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY ?? null,
    stripePriceAnnual:  process.env.STRIPE_PRICE_STUDIO_ANNUAL  ?? null,
    molliePlanId:       process.env.MOLLIE_PLAN_STUDIO           ?? null,
  },

  agency: {
    tier:            "agency",
    name:            "Agency",
    monthlyEurCents: 29900,
    annualEurCents:  23900,
    limits: {
      postsPerMonth:     null,
      brands:            UNLIMITED_BRANDS,
      storageGb:         500,
      customTemplates:   null,
      teamMembers:       20,
      analyticsLevel:    "advanced",
      bufferIntegration: true,
      storiesReels:      true,
      weeklyTrendEmail:  true,
      templateSlotsPerPostType: 5,
      templateLockSlots:        3,
    },
    stripePriceMonthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY ?? null,
    stripePriceAnnual:  process.env.STRIPE_PRICE_AGENCY_ANNUAL  ?? null,
    molliePlanId:       process.env.MOLLIE_PLAN_AGENCY           ?? null,
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
      templateSlotsPerPostType: 5,
      templateLockSlots:        2,
    },
    stripePriceMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? null,
    stripePriceAnnual:  process.env.STRIPE_PRICE_BUSINESS_ANNUAL  ?? null,
    molliePlanId:       process.env.MOLLIE_PLAN_BUSINESS           ?? null,
  },
}

/** Returns the brand limit for a plan tier. -1 means unlimited. */
export function getPlanBrandLimit(plan: string): number {
  return getPlan(plan).limits.brands
}

/**
 * Returns the slug of the next plan tier that offers more brands than the
 * given plan, or null if no upgrade exists (already at unlimited).
 *
 * Ordered by brand capacity ascending so callers always get the *cheapest*
 * upgrade that solves the limit.
 */
export function getNextPlanWithMoreBrands(plan: string): string | null {
  const currentLimit = getPlanBrandLimit(plan)
  if (currentLimit === UNLIMITED_BRANDS) return null

  // Order matters: cheapest path forward first.
  const upgradePath: PlanTier[] = ["starter", "pro", "studio", "business", "agency"]

  for (const tier of upgradePath) {
    const limit = PLANS[tier].limits.brands
    if (limit === UNLIMITED_BRANDS) return tier
    if (limit > currentLimit) return tier
  }
  return null
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
