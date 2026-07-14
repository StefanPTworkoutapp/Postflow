/**
 * Per-plan monthly AI spend cap.
 *
 * Mechanism (P5, 2026-07-14):
 *   - Under cap:        brand's normal ai_tier model choice (getModels(brandTier(brand))).
 *   - Over cap (1x):    force economy-tier models for the rest of the calendar month.
 *   - Over cap (2x):    additionally block non-essential background AI work
 *                        (inspiration analyze, niche research) for that account.
 *
 * User-facing generation (caption, calendar) is NEVER hard-blocked — it only
 * degrades to economy models. Only background/non-essential jobs get blocked.
 *
 * The check itself must stay cheap: one indexed aggregate query
 * (ai_usage_logs joined via brands.account_id, current month), memoized
 * in-process for CACHE_TTL_MS so one request handler can call it more than
 * once without re-querying. No AI call is ever made by this module.
 */

import { createServiceClient } from "@/lib/supabase/service"
import { getModels, type AiTier } from "@/lib/ai/models"
import type { PlanTier } from "./plans"

/**
 * Type-bypass helper for postflow.ai_budget_events — not yet in the
 * generated database.types.ts (migration 20260714000013 needs Stefan's
 * approval before it can be applied + types regenerated).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nt = (client: ReturnType<typeof createServiceClient>) => client as any

// ── Config ───────────────────────────────────────────────────────────────────

/**
 * Monthly AI spend cap per plan tier, in EUR.
 * TUNABLE — these are Stefan's starting guesses, not measured unit economics.
 * Revisit against real cost data in the /admin margin dashboard
 * (src/lib/server/admin/marginReport.ts) and adjust here as the only place
 * these numbers live.
 */
export const AI_BUDGET_CAP_EUR: Record<PlanTier, number> = {
  free:     1,
  starter:  5,
  pro:      15,
  studio:   25,
  business: 40,
  agency:   75,
}

/**
 * Fixed USD→EUR conversion used everywhere PostFlow compares AI cost (billed
 * in USD by Anthropic) against revenue/caps (billed in EUR). Approximate —
 * update periodically, not tied to a live FX feed. Same constant is reused
 * by src/lib/server/admin/marginReport.ts so the two surfaces never disagree.
 */
export const USD_TO_EUR = 0.92

export type BudgetVerdict = "normal" | "economy" | "blocked"

export interface BudgetCheckResult {
  verdict:    BudgetVerdict
  spentUsd:   number
  spentEur:   number
  capEur:     number
  /** Model tier to force for user-facing generation. null = use the brand's own ai_tier. */
  forcedTier: AiTier | null
}

// ── Cheap in-process memoization ─────────────────────────────────────────────
// Does not persist across serverless invocations — that's fine, the guarded
// query is already a single indexed aggregate, not an AI call.

const cache = new Map<string, { result: BudgetCheckResult; expiresAt: number }>()
const CACHE_TTL_MS = 30_000

async function getCurrentMonthAiCostUsd(accountId: string): Promise<number> {
  const supabase = createServiceClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  try {
    const { data: brands } = await supabase
      .from("brands")
      .select("id")
      .eq("account_id", accountId)

    const brandIds = (brands ?? []).map(b => b.id)
    if (!brandIds.length) return 0

    const { data: logs } = await supabase
      .from("ai_usage_logs")
      .select("cost_usd")
      .in("brand_id", brandIds)
      .gte("created_at", monthStart)

    return (logs ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0)
  } catch (err) {
    // Fail-open: never let a budget-check failure block user-facing generation.
    console.error("[aiBudget] cost lookup failed, defaulting to 0 (fail-open):", err)
    return 0
  }
}

/**
 * Insert one visibility row when an account crosses into economy/blocked —
 * deduped to at most one row per account+verdict per UTC day so this stays
 * cheap even if checkAiBudget() is called on every request.
 * Fire-and-forget — never blocks the caller.
 */
function recordBudgetEvent(accountId: string, verdict: "economy" | "blocked", spentUsd: number, capEur: number, plan: string): void {
  (async () => {
    try {
      const supabase = createServiceClient()
      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      const { data: existing } = await nt(supabase)
        .from("ai_budget_events")
        .select("id")
        .eq("account_id", accountId)
        .eq("verdict", verdict)
        .gte("created_at", todayStart.toISOString())
        .limit(1)

      if (existing && existing.length > 0) return

      await nt(supabase).from("ai_budget_events").insert({
        account_id: accountId,
        verdict,
        spent_usd:  spentUsd,
        cap_usd:    capEur / USD_TO_EUR,
        plan,
      })
    } catch (err) {
      // Table may not exist yet (migration pending Stefan approval) — degrade
      // silently, this is a visibility nice-to-have, never a hard dependency.
      console.error("[aiBudget] failed to record budget event:", err)
    }
  })()
}

/**
 * Checks an account's current-month AI spend against its plan's cap.
 * Cheap (one aggregate query, memoized) and never makes an AI call.
 */
export async function checkAiBudget(accountId: string, plan: string): Promise<BudgetCheckResult> {
  const cached = cache.get(accountId)
  if (cached && cached.expiresAt > Date.now()) return cached.result

  const capEur = AI_BUDGET_CAP_EUR[plan as PlanTier] ?? AI_BUDGET_CAP_EUR.free
  const spentUsd = await getCurrentMonthAiCostUsd(accountId)
  const spentEur = spentUsd * USD_TO_EUR

  let verdict: BudgetVerdict = "normal"
  if (spentEur >= capEur * 2) verdict = "blocked"
  else if (spentEur >= capEur) verdict = "economy"

  if (verdict !== "normal") recordBudgetEvent(accountId, verdict, spentUsd, capEur, plan)

  const result: BudgetCheckResult = {
    verdict,
    spentUsd,
    spentEur,
    capEur,
    forcedTier: verdict === "normal" ? null : "economy",
  }

  cache.set(accountId, { result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}

/**
 * Convenience wrapper for the two brand-tiered generation paths (caption,
 * calendar): resolves the models to use, forcing "economy" once the account
 * is over its monthly cap regardless of the brand's own ai_tier setting.
 */
export async function getBudgetAwareModels(opts: {
  accountId: string
  plan:      string
  brandAiTier: AiTier
}) {
  const budget = await checkAiBudget(opts.accountId, opts.plan)
  const effectiveTier: AiTier = budget.forcedTier ?? opts.brandAiTier
  return { models: getModels(effectiveTier), budget }
}
