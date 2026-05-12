import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

/**
 * GET /api/settings/social
 * Returns all social_accounts for the current brand.
 * Consumed by useConnections() hook — do not return sensitive token data.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ connections: [] })

    const { data, error } = await supabase
      .from("social_accounts")
      .select("id, platform, account_handle, account_url, buffer_profile_id, is_active, token_expires_at, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ connections: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
