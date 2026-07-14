import type { Database } from "@/types/database.types"
import type { createClient } from "@/lib/supabase/server"
import { getCompTierForEmail } from "./compAccounts"

type Accounts       = Database["postflow"]["Tables"]["accounts"]["Row"]
type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/**
 * Grants a complimentary subscription tier (see compAccounts.ts) to an
 * account whose email matches the comp list — but ONLY if the account is
 * still on 'free' (or has no tier at all). Never downgrades, and never
 * overwrites a tier the account reached any other way (e.g. an actual paid
 * Stripe/Mollie subscription, or a higher comp tier set by hand later).
 *
 * Idempotent + cheap: does nothing (no DB write) once the grant has already
 * been applied, or if the account isn't on the comp list.
 *
 * Called from getOrCreateAccount() so every request that touches the account
 * row re-checks it — this makes the grant durable across re-signups (the
 * comp list is keyed by email, not account id).
 */
export async function applyCompTierGrant(
  supabase: SupabaseServer,
  account: Accounts
): Promise<Accounts> {
  const compTier = getCompTierForEmail(account.email)
  if (!compTier) return account

  const currentTier = account.subscription_tier ?? "free"
  if (currentTier !== "free") return account // already upgraded (comp or real) — never touch it

  const { data: updated, error } = await supabase
    .from("accounts")
    .update({ subscription_tier: compTier })
    .eq("id", account.id)
    .select()
    .single()

  if (error) {
    // Fail soft — the account still works on 'free', just without the comp
    // upgrade this one time. Next call will retry.
    console.error(`[compAccounts] Failed to apply comp tier "${compTier}" to ${account.email}:`, error.message)
    return account
  }

  return updated ?? account
}
