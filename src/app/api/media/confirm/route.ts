import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

/**
 * POST /api/media/confirm
 * Records uploaded media in postflow.media_uploads after direct storage upload.
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
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ media: data }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
