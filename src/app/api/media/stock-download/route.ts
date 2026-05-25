/**
 * POST /api/media/stock-download
 *
 * Triggers the Unsplash "download" event for a selected photo.
 * Required by Unsplash API Terms of Service when a user selects/uses a photo.
 *
 * Body: { url: string }  — the download_location from the Unsplash API response
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }             from "@/lib/supabase/server"
import { triggerUnsplashDownload }  from "@/lib/server/media/unsplash"

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Accept download_location URL via query param (avoids body parsing on GET-style redirect)
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")

  if (!url) {
    // Also try JSON body
    try {
      const body = await req.json() as { url?: string }
      if (body.url) {
        await triggerUnsplashDownload(body.url)
        return NextResponse.json({ ok: true })
      }
    } catch { /* fall through */ }
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  await triggerUnsplashDownload(url)
  return NextResponse.json({ ok: true })
}
