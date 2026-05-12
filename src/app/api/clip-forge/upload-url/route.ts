/**
 * POST /api/clip-forge/upload-url
 *
 * Returns a signed Supabase Storage upload URL for a video clip.
 * Client uploads the clip directly to postflow-clips bucket,
 * then includes the returned path in POST /api/clip-forge/create.
 *
 * Bucket: postflow-clips (private, 500 MB per-file limit)
 * Access: signed URLs for upload; service-client for public read during render
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand }     from "@/lib/server/brand/getBrand"

const MAX_CLIP_BYTES = 500 * 1024 * 1024  // 500 MB

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const { filename, contentType, size } = await req.json() as {
      filename:    string
      contentType: string
      size:        number
    }

    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 })
    }

    if (!contentType.startsWith("video/")) {
      return NextResponse.json({ error: "Only video files are accepted" }, { status: 400 })
    }

    if (size > MAX_CLIP_BYTES) {
      return NextResponse.json({ error: "File too large (max 500 MB)" }, { status: 400 })
    }

    const ext  = filename.split(".").pop() ?? "mp4"
    const path = `${brand.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { data, error } = await supabase.storage
      .from("postflow-clips")
      .createSignedUploadUrl(path)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ signedUrl: data.signedUrl, path })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
