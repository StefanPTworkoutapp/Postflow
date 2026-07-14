import { createClient } from "@/lib/supabase/server"
import { applyCompTierGrant } from "@/lib/server/billing/applyCompTierGrant"

/**
 * Ensures a postflow.accounts row exists for the authenticated user.
 * Called after sign-in / sign-up. Safe to call multiple times (idempotent).
 */
export async function getOrCreateAccount() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("Not authenticated")

  // Check if account already exists
  const { data: existing } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", user.id)
    .single()

  if (existing) return applyCompTierGrant(supabase, existing)

  // Create new account row
  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create account: ${error.message}`)

  return applyCompTierGrant(supabase, created)
}
