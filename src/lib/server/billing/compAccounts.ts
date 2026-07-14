import type { PlanTier } from "./plans"

/**
 * Complimentary accounts — email → tier granted WITHOUT any Stripe/Mollie
 * subscription behind it. Used for hand-picked comp/friends-and-family
 * accounts (e.g. Stefan giving someone a free Starter seat).
 *
 * This is intentionally a durable, code-defined list (not a one-off DB poke)
 * so it survives re-signups, account recreation, and is reviewable in git
 * history like any other access grant.
 *
 * Rules enforced by `applyCompTierGrant` (src/lib/server/billing/applyCompTierGrant.ts):
 *   - Only upgrades an account currently on 'free' (or with a null tier) —
 *     never downgrades, and never overwrites a tier the account already has
 *     for any other reason (e.g. a real paid subscription).
 *   - Idempotent: safe to call on every request, only writes when a change
 *     is actually needed.
 *
 * Keys are matched case-insensitively against the account's email.
 */
export const COMP_ACCOUNTS: Record<string, PlanTier> = {
  "evavanee@gmail.com": "starter",
}

/** Looks up the comp tier for an email, if any. Case-insensitive. */
export function getCompTierForEmail(email: string | null | undefined): PlanTier | null {
  if (!email) return null
  const tier = COMP_ACCOUNTS[email.trim().toLowerCase()]
  return tier ?? null
}
