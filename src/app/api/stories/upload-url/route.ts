/**
 * POST /api/stories/upload-url
 *
 * Returns a signed Supabase Storage upload URL for a story/reel media file.
 * Supports both photos (JPEG/PNG/WEBP) and short videos (MP4/MOV/WEBM).
 *
 * Bucket: postflow-clips (reusing existing private bucket)
 * Access: signed URLs for upload; service-client for later read
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getBrand }     from "@/lib/server/brand/getBrand"
import { checkStorageLimit } from "@/lib/server/billing/limits"

const MAX_PHOTO_BYTES = 25  * 1024 * 1024   // 25 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024   // 200 MB

const ACCEPTED_PHOTO = ["image/jpeg", "image/png", "image/webp"]
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"]

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await req.json() as {
      filename:    string
      contentType: string
      size:        number
    }

    const { filename, contentType, size } = body

    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType are required" }, { status: 400 })
    }

    const isPhoto = ACCEPTED_PHOTO.includes(contentType)
    const isVideo = ACCEPTED_VIDEO.includes(contentType)

    if (!isPhoto && !isVideo) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPEG, PNG, WEBP, MP4, MOV, or WEBM." },
        { status: 400 }
      )
    }

    const maxBytes = isPhoto ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES
    if (size > maxBytes) {
      const limit = isPhoto ? "25 MB" : "200 MB"
      return NextResponse.json({ error: `File too large (max ${limit})` }, { status: 400 })
    }

    // Plan storage quota check
    const fileSizeMb = size / (1024 * 1024)
    const storageCheck = await checkStorageLimit(brand.id, fileSizeMb)
    if (!storageCheck.allowed) {
      return NextResponse.json(
        { error: storageCheck.reason, upgradeHint: storageCheck.upgradeHint },
        { status: 402 },
      )
    }

    const ext  = filename.split(".").pop() ?? (isPhoto ? "jpg" : "mp4")
    const path = `stories/${brand.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Sign with the service client — storage RLS policies (dashboard-managed)
    // don't reliably cover our brand-scoped path prefixes for user-scoped
    // clients. Authorization is already enforced above in code (session user,
    // brand ownership, MIME/size/quota checks).
    const service = createServiceClient()
    const { data, error } = await service.storage
      .from("postflow-clips")
      .createSignedUploadUrl(path)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path,
      mediaType: isPhoto ? "photo" : "video",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
