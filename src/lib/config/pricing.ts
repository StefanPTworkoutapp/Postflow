/**
 * PostFlow Pricing Configuration
 *
 * Single source of truth for all plan pricing, limits, and trial settings.
 * Import this wherever prices or limits are shown — UI, emails, API responses.
 *
 * To change a price: update here only. Do NOT hardcode prices anywhere else.
 */

export const CURRENCY = "€"
export const TRIAL_DAYS = 14
export const ANNUAL_DISCOUNT_PERCENT = 20

export const PLANS = {
  free: {
    id:          "free",
    name:        "Free",
    monthly:     0,
    annual:      0,
    description: "Try it out, no commitment",
    limits: {
      brands:           1,
      postsPerMonth:    5,
      storageGb:        1,
      customTemplates:  0,
      teamMembers:      1,
    },
    features: {
      storiesAndReels:   false,
      bufferIntegration: false,
      analyticsLevel:    "basic"  as const,
      brandVoice:        false,
    },
  },

  starter: {
    id:          "starter",
    name:        "Starter",
    monthly:     49,
    annual:      39,
    description: "For solo creators and single-brand businesses",
    limits: {
      brands:           1,
      postsPerMonth:    null,     // unlimited
      storageGb:        10,
      customTemplates:  5,
      teamMembers:      1,
    },
    features: {
      storiesAndReels:   true,
      bufferIntegration: true,   // manual
      analyticsLevel:    "standard" as const,
      brandVoice:        true,
    },
  },

  pro: {
    id:          "pro",
    name:        "Pro",
    monthly:     99,
    annual:      79,
    description: "For multi-brand operators and small teams",
    limits: {
      brands:           3,
      postsPerMonth:    null,     // unlimited
      storageGb:        50,
      customTemplates:  null,    // unlimited
      teamMembers:      3,
    },
    features: {
      storiesAndReels:   true,
      bufferIntegration: true,   // auto
      analyticsLevel:    "advanced" as const,
      brandVoice:        true,
    },
  },

  business: {
    id:          "business",
    name:        "Business",
    monthly:     199,
    annual:      159,
    description: "For agencies and multi-brand portfolios",
    limits: {
      brands:           10,
      postsPerMonth:    null,     // unlimited
      storageGb:        200,
      customTemplates:  null,    // unlimited
      teamMembers:      10,
    },
    features: {
      storiesAndReels:   true,
      bufferIntegration: true,   // auto
      analyticsLevel:    "advanced" as const,
      brandVoice:        true,
    },
  },
} as const

export type PlanId = keyof typeof PLANS
export type Plan   = (typeof PLANS)[PlanId]

/** Formatted price string: "€49" or "€0" */
export function formatPrice(amount: number): string {
  return `${CURRENCY}${amount}`
}

/** Annual price per month as a formatted string */
export function formatAnnualMonthly(plan: Plan): string {
  return `${CURRENCY}${plan.annual}/mo`
}
