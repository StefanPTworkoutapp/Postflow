import { createClient } from "@/lib/supabase/server"

export interface BrandSummary {
  id: string
  name: string
  logo_url: string | null
  created_at: string
}

/**
 * Returns all brands for the authenticated user, oldest first.
 * Used by the BrandSwitcher in the sidebar.
 */
export async function getBrands(): Promise<BrandSummary[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from("brands")
    .select("id, name, logo_url, created_at")
    .eq("account_id", user.id)
    .order("created_at", { ascending: true })

  if (error || !data) return []

  return data as BrandSummary[]
}
