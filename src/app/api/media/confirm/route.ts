import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { inngest } from "@/inngest/client"

/**
 * POST /api/media/confirm
 * Records uploaded media in postflow.media_uploads after direct storage upload.
 * Fires postflow/media.uploaded event so the AI tagging job picks it up.
 * Body: { path, publicUrl, filename, contentType, size }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const { path, publicUrl, filename, contentType, size } = await request.json() as {
      path: string
      publicUrl: string
      filename: string
      contentType: string
      size: number
    }

    const mediaType = contentType.startsWith("video/") ? "video" : "image"

    const { data, error } = await supabase
      .from("media_uploads")
      .insert({
        brand_id:         brand.id,
        filename,
        storage_provider: "supabase",
        storage_path:     path,
        public_url:       publicUrl,
        media_type:       mediaType,
        mime_type:        contentType,
        file_size_mb:     size / (1024 * 1024),
      })
      .select("id, public_url, media_type, filename, file_size_mb, ai_tags, ai_description, ai_quality_score, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Fire AI tagging job (non-blocking — images only; job skips videos)
    await inngest.send({
      name: "postflow/media.uploaded",
      data: {
        mediaId:   data.id,
        brandId:   brand.id,
        publicUrl: data.public_url ?? publicUrl,
        mediaType,
      },
    }).catch(err => {
      // Don't fail the confirm if Inngest is unavailable
      console.warn("confirm: failed to fire media.uploaded event:", err)
    })

    return NextResponse.json({ media: data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
