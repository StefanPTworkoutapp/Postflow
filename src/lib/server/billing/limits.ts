/**
 * Plan limit enforcement helpers.
 * All checks are server-side — never trust the client.
 *
 * Each check returns { allowed: true } or { allowed: false, reason, upgradeHint }
 * so API routes can return a consistent 402 / 403 with a useful message.
 */

import { createClient } from "@/lib/supabase/server"
import { getLimits } from "./plans"

export interface LimitCheckResult {
  allowed:     boolean
  reason?:     string
  upgradeHint?: string
}

/** Get the current account's tier (defaults to "free" if not found) */
export async function getAccountTier(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return "free"

  const { data } = await supabase
    .from("accounts")
    .select("subscription_tier, subscription_status")
    .eq("id", user.id)
    .single()

  if (!data) return "free"

  // If subscription is past_due or canceled, treat as free for limit purposes
  const blockedStatuses = ["past_due", "canceled"]
  if (blockedStatuses.includes(data.subscription_status)) return "free"

  return data.subscription_tier ?? "free"
}

/** Check whether a brand can create another post this calendar month */
export async function checkPostLimit(brandId: string): Promise<LimitCheckResult> {
  const tier   = await getAccountTier()
  const limits = getLimits(tier)

  if (limits.postsPerMonth === null) return { allowed: true }

  const supabase    = await createClient()
  const monthStart  = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .gte("created_at", monthStart.toISOString())

  const used = count ?? 0

  if (used >= limits.postsPerMonth) {
    return {
      allowed:     false,
      reason:      `You've used ${used}/${limits.postsPerMonth} posts this month on the ${tier} plan.`,
      upgradeHint: "Upgrade to Starter for unlimited posts.",
    }
  }

  return { allowed: true }
}

/** Check whether the account can create another brand */
export async function checkBrandLimit(accountId: string): Promise<LimitCheckResult> {
  const tier   = await getAccountTier()
  const limits = getLimits(tier)

  const supabase    = await createClient()
  const { count }   = await supabase
    .from("brands")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId)

  const used = count ?? 0

  if (used >= limits.brands) {
    return {
      allowed:     false,
      reason:      `You have ${used}/${limits.brands} brand${limits.brands !== 1 ? "s" : ""} on the ${tier} plan.`,
      upgradeHint: tier === "starter" ? "Upgrade to Pro for up to 3 brands." : "Upgrade your plan for more brands.",
    }
  }

  return { allowed: true }
}

/** Check whether a feature is enabled for the account's current plan */
export async function checkFeature(
  feature: "bufferIntegration" | "storiesReels" | "weeklyTrendEmail"
): Promise<LimitCheckResult> {
  const tier   = await getAccountTier()
  const limits = getLimits(tier)

  if (!limits[feature]) {
    const hints: Record<string, string> = {
      bufferIntegration: "Buffer scheduling requires Starter or higher.",
      storiesReels:      "Stories & Reels require Starter or higher.",
      weeklyTrendEmail:  "Weekly trend emails require Starter or higher.",
    }
    return {
      allowed:     false,
      reason:      `This feature isn't included in the ${tier} plan.`,
      upgradeHint: hints[feature],
    }
  }

  return { allowed: true }
}
