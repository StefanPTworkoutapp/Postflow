import { createClient } from "@/lib/supabase/server"
import {
  getPlanBrandLimit,
  getNextPlanWithMoreBrands,
  UNLIMITED_BRANDS,
} from "./plans"

export interface BrandLimitResult {
  allowed:   boolean
  current:   number
  /** -1 means unlimited */
  limit:     number
  plan:      string
  upgradeTo: string | null
}

/**
 * Checks whether the current user can create another brand under their plan.
 * Reads plan from `postflow.accounts.subscription_tier`, defaulting to "free"
 * if the column is missing or the user has no account row yet.
 */
export async function checkBrandLimit(): Promise<BrandLimitResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, current: 0, limit: 0, plan: "free", upgradeTo: null }
  }

  // ── Resolve plan tier ────────────────────────────────────────────────────
  let plan = "free"
  const { data: account } = await supabase
    .from("accounts")
    .select("subscription_tier")
    .eq("id", user.id)
    .maybeSingle()

  if (account?.subscription_tier) plan = account.subscription_tier

  // ── Count brands ─────────────────────────────────────────────────────────
  const { count } = await supabase
    .from("brands")
    .select("*", { count: "exact", head: true })
    .eq("account_id", user.id)

  const current = count ?? 0
  const limit   = getPlanBrandLimit(plan)
  const allowed = limit === UNLIMITED_BRANDS || current < limit
  const upgradeTo = allowed ? null : getNextPlanWithMoreBrands(plan)

  return { allowed, current, limit, plan, upgradeTo }
}
