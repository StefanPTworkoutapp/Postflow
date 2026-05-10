import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

// GET /api/media — returns all media uploads for the current brand (newest first)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ media: [] })

    const { data, error } = await supabase
      .from("media_uploads")
      .select("id, public_url, media_type, mime_type, filename, file_size_mb, ai_tags, ai_description, ai_quality_score, used_in_post_id, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ media: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
