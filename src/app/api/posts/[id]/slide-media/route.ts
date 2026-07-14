import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { checkStorageLimit } from "@/lib/server/billing/limits"

/** Server-side MIME allowlist — accept images and videos only. Mirrors the
 * allowlist in /api/calendar/[id]/upload-media and /api/media/upload-url. */
const ALLOWED_MIME_PREFIXES = ["image/", "video/"]

/**
 * POST /api/posts/[id]/slide-media
 *
 * Uploads a photo/video for use as a per-slide background in a carousel.
 * Stores in: media/{brand_id}/slides/{post_id}/{timestamp}.{ext}
 * Returns: { url: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // Verify post belongs to this brand
  const { data: post } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  // Per-file size guard (50 MB max, same limit as the calendar upload route)
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 })
  }

  // Server-side MIME allowlist — never trust the client's declared type alone,
  // but this is the best signal we have without sniffing bytes.
  const contentType = file.type || "application/octet-stream"
  if (!ALLOWED_MIME_PREFIXES.some(prefix => contentType.startsWith(prefix))) {
    return NextResponse.json(
      { error: `File type "${contentType}" is not allowed. Upload images or videos only.` },
      { status: 400 },
    )
  }

  // Plan storage quota check (shared across all brands on the account)
  const fileSizeMb = file.size / (1024 * 1024)
  const storageCheck = await checkStorageLimit(brand.id, fileSizeMb)
  if (!storageCheck.allowed) {
    return NextResponse.json(
      { error: storageCheck.reason, upgradeHint: storageCheck.upgradeHint },
      { status: 402 },
    )
  }

  const originalName = (file as File).name ?? "slide"
  const ext          = originalName.split(".").pop()?.toLowerCase() ?? "bin"
  const safeName     = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath  = `${brand.id}/slides/${postId}/${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await supabase.storage
    .from("media")
    .upload(storagePath, arrayBuffer, {
      contentType,
      upsert:      false,
    })

  if (uploadErr) {
    console.error("[slide-media] upload error:", uploadErr.message)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(storagePath)

  return NextResponse.json({ url: publicUrl })
}
