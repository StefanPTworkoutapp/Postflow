import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

// GET /api/media?type=image|video — returns media uploads for the current brand (newest first)
// Optional ?type= filter: "image" = images only, "video" = videos only, omit for all.
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ media: [] })

    const { searchParams } = new URL(request.url)
    const typeFilter = searchParams.get("type") // "image" | "video" | null

    let query = supabase
      .from("media_uploads")
      .select("id, public_url, media_type, mime_type, filename, file_size_mb, ai_tags, ai_description, ai_quality_score, used_in_post_id, created_at")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })

    if (typeFilter === "image" || typeFilter === "video") {
      query = query.eq("media_type", typeFilter)
    }

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ media: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
