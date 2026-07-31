import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

/**
 * GET /api/media/by-hash?hash={sha256hex}
 * Returns the existing media record if this brand already has a file with
 * the same SHA-256 content hash. Used by the upload pipeline to skip
 * re-uploading duplicate files.
 * Returns 404 when no match is found.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const hash = searchParams.get("hash")?.trim()
    if (!hash || hash.length !== 64) {
      return NextResponse.json({ error: "Invalid hash" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("media_uploads")
      .select("id, public_url, media_type, mime_type, filename, file_size_mb, ai_tags, ai_description, created_at")
      .eq("brand_id", brand.id)
      .eq("content_hash", hash)
      .limit(1)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data)  return NextResponse.json({ exists: false }, { status: 404 })

    return NextResponse.json({ exists: true, media: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
