/**
 * GET /api/media/stock-search
 *
 * Search Unsplash for stock photos.
 *
 * Query params:
 *   q           — search query (required)
 *   orientation — "landscape" | "portrait" | "squarish" (optional)
 *   page        — page number (default 1)
 *   per_page    — results per page (default 9, max 30)
 *
 * Returns:
 *   { photos: UnsplashPhoto[], total: number }
 *
 * Attribution note: caller must display author.name + author.link
 * alongside each photo per Unsplash API Terms of Service.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }             from "@/lib/supabase/server"
import { searchPhotos }             from "@/lib/server/media/unsplash"

export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q           = searchParams.get("q")?.trim()
  const orientation = searchParams.get("orientation") as "landscape" | "portrait" | "squarish" | undefined
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const perPage     = Math.min(30, Math.max(1, parseInt(searchParams.get("per_page") ?? "9", 10)))

  if (!q) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
  }

  if (!process.env.UNSPLASH_ACCESS_KEY) {
    return NextResponse.json({ error: "Stock images not configured" }, { status: 503 })
  }

  try {
    const result = await searchPhotos(q, orientation, perPage, page)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed"
    console.error("[stock-search] Unsplash error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
