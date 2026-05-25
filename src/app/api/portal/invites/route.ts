/**
 * GET /api/portal/invites?brandId=<uuid>
 *
 * Returns all portal invites for the given brand (owned by the authenticated user).
 * Used by the BrandEditor "Client sharing" tab to list active links.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get("brandId")
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 })

  // Verify ownership
  const { data: brand } = await supabase
    .from("brands")
    .select("id, account_id")
    .eq("id", brandId)
    .single()

  if (!brand || brand.account_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: invites, error } = await supabase
    .from("portal_invites")
    .select("id, email, created_at, expires_at, last_viewed_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invites: invites ?? [] })
}
