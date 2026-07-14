import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { checkStorageLimit } from "@/lib/server/billing/limits"

/** Server-side MIME allowlist — accept images and videos only. Mirrors the
 * allowlist in /api/posts/[id]/slide-media and /api/media/upload-url. */
const ALLOWED_MIME_PREFIXES = ["image/", "video/"]

/**
 * POST /api/calendar/[id]/upload-media
 *
 * Accepts multipart/form-data with:
 *   - file: the uploaded file
 *   - slotIndex?: number — if provided, sets media_urls[slotIndex] = url (slot-based for carousel)
 *                          if omitted, appends to array (single photo/video entries)
 *
 * Slot-based storage means media_urls[i] corresponds to slide i.
 * Slots that have no upload are stored as empty string "".
 *
 * Returns { url, mediaUrls }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: entryId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // Verify the entry belongs to this brand
  const { data: entry, error: entryErr } = await supabase
    .from("content_calendar")
    .select("id, media_urls")
    .eq("id", entryId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 400 })
  if (!entry)   return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  // Parse multipart form
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

  // Per-file size guard (50 MB max for calendar uploads)
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

  // Plan storage quota check
  const fileSizeMb = file.size / (1024 * 1024)
  const storageCheck = await checkStorageLimit(brand.id, fileSizeMb)
  if (!storageCheck.allowed) {
    return NextResponse.json(
      { error: storageCheck.reason, upgradeHint: storageCheck.upgradeHint },
      { status: 402 },
    )
  }

  // Optional slot index for carousel per-slide uploads
  const slotIndexRaw = formData.get("slotIndex")
  const slotIndex    = slotIndexRaw !== null ? parseInt(String(slotIndexRaw), 10) : null

  // Sanitise filename
  const originalName = (file as File).name ?? "upload"
  const ext          = originalName.split(".").pop()?.toLowerCase() ?? "bin"
  const safeName     = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath  = `${brand.id}/calendar/${entryId}/${safeName}`

  // Upload to Supabase Storage bucket "media"
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await supabase.storage
    .from("media")
    .upload(storagePath, arrayBuffer, {
      contentType,
      upsert:      false,
    })

  if (uploadErr) {
    console.error("[upload-media] storage error:", uploadErr.message)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("media")
    .getPublicUrl(storagePath)

  // Build updated media_urls array
  const existingUrls: string[] = Array.isArray(entry.media_urls) ? entry.media_urls : []
  let mediaUrls: string[]

  if (slotIndex !== null && !isNaN(slotIndex)) {
    // Slot-based: set position slotIndex, pad shorter arrays with ""
    mediaUrls = [...existingUrls]
    while (mediaUrls.length <= slotIndex) mediaUrls.push("")
    mediaUrls[slotIndex] = publicUrl
  } else {
    // Append mode: standard single photo/video
    mediaUrls = [...existingUrls, publicUrl]
  }

  const { error: updateErr } = await supabase
    .from("content_calendar")
    .update({ media_urls: mediaUrls, status: "media_pending" })
    .eq("id", entryId)
    .eq("brand_id", brand.id)

  if (updateErr) {
    console.error("[upload-media] db update error:", updateErr.message)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ url: publicUrl, mediaUrls })
}

/**
 * DELETE /api/calendar/[id]/upload-media
 * Body: { url: string }
 * Removes a URL from media_urls (replaces with "" for slot-based) and deletes from storage.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: entryId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  const { url } = await request.json() as { url?: string }
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 })

  const { data: entry } = await supabase
    .from("content_calendar")
    .select("id, media_urls")
    .eq("id", entryId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  // Replace the URL with "" to preserve slot positions (don't splice)
  const mediaUrls = (entry.media_urls ?? []).map((u: string) => u === url ? "" : u)
  // Trim trailing empty strings
  while (mediaUrls.length > 0 && mediaUrls[mediaUrls.length - 1] === "") mediaUrls.pop()

  // Extract storage path and delete from bucket
  try {
    const urlObj = new URL(url)
    const marker = "/object/public/media/"  // bucket = "media"
    const idx    = urlObj.pathname.indexOf(marker)
    if (idx !== -1) {
      const storagePath = decodeURIComponent(urlObj.pathname.slice(idx + marker.length))
      await supabase.storage.from("media").remove([storagePath])
    }
  } catch { /* ignore storage delete errors */ }

  const hasAny   = mediaUrls.some(u => u !== "")
  const newStatus = hasAny ? "media_pending" : "planned"

  await supabase
    .from("content_calendar")
    .update({ media_urls: mediaUrls, status: newStatus })
    .eq("id", entryId)
    .eq("brand_id", brand.id)

  return NextResponse.json({ mediaUrls })
}
