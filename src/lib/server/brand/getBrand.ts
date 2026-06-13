import { createClient } from "@/lib/supabase/server"

/**
 * Returns a brand for the authenticated user.
 *
 *   - With no arg: returns the user's oldest brand (legacy MVP behaviour).
 *   - With a `brandId`: returns that specific brand, but only if the user owns it.
 *
 * For the multi-brand-aware "currently active brand", use `getActiveBrand()`.
 */
export async function getBrand(brandId?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  if (brandId) {
    const { data } = await supabase
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .eq("account_id", user.id)
      .maybeSingle()

    return data ?? null
  }

  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("account_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return data ?? null
}
