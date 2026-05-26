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
    .select("platform, buffer_profile_id")
    .eq("brand_id", brand.id)
    .eq("is_active", true)

  const platforms = (data ?? []).map(r => r.platform)

  // If any row has a buffer_profile_id, Buffer is connected — report it as "buffer"
  // so the UI can show the Buffer "Connected" state.
  const bufferConnected = (data ?? []).some(r => r.buffer_profile_id)
  if (bufferConnected && !platforms.includes("buffer")) platforms.push("buffer")

  return NextResponse.json({ platforms })
}
