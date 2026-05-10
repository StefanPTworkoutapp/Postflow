import { createClient } from "@/lib/supabase/server"

/**
 * Returns the first brand for the authenticated user's account, or null.
 * MVP: one account = one brand.
 */
export async function getBrand() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from("brands")
    .select("*")
    .eq("account_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single()

  return data ?? null
}
