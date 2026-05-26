/**
 * GET /api/connections/list
 * Returns the list of connected platform names for the current brand.
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand }     from "@/lib/server/brand/getBrand"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ platforms: [] })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ platforms: [] })

  const { data } = await supabase
    .from("social_accounts")
    .select("platform")
    .eq("brand_id", brand.id)
    .eq("is_active", true)

  return NextResponse.json({ platforms: (data ?? []).map(r => r.platform) })
}
