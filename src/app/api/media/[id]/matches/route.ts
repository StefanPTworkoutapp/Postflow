import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

/**
 * GET /api/media/[id]/matches
 *
 * Returns upcoming calendar entries whose required_media_type is compatible
 * with this upload's media_type, ordered by scheduled_date ASC (soonest first).
 *
 * Compatibility:
 *   upload "image" → calendar entries with required_media_type IN ('photo', 'carousel')
 *   upload "video" → calendar entries with required_media_type = 'video'
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ matches: [] })

  // Get the upload's media_type
  const { data: upload } = await supabase
    .from("media_uploads")
    .select("id, media_type")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const today = new Date().toISOString().split("T")[0]

  // Determine compatible required_media_types
  const compatibleTypes = upload.media_type === "video"
    ? ["video"]
    : ["photo", "carousel"]  // images can serve both photo and carousel slots

  const { data: entries } = await supabase
    .from("content_calendar")
    .select("id, scheduled_date, topic, platforms, post_type, content_pillar, required_media_type, media_urls, status")
    .eq("brand_id", brand.id)
    .gte("scheduled_date", today)
    .in("required_media_type", compatibleTypes)
    .or("media_urls.is.null,media_urls.eq.{}")  // not already filled
    .order("scheduled_date", { ascending: true })
    .limit(5)

  return NextResponse.json({ matches: entries ?? [] })
}
