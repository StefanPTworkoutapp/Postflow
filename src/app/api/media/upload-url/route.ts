import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getBrand } from "@/lib/server/brand/getBrand"
import { checkStorageLimit } from "@/lib/server/billing/limits"

/**
 * POST /api/media/upload-url
 * Returns a signed Supabase Storage upload URL for a media file.
 * Client uploads directly; calls /api/media/confirm after.
 * Body: { filename: string; contentType: string; size: number }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const { filename, contentType, size } = await request.json() as {
      filename: string
      contentType: string
      size: number
    }

    if (!filename || !contentType) {
      return NextResponse.json({ error: "filename and contentType required" }, { status: 400 })
    }

    // MIME type allowlist — accept images, videos, and PDFs only.
    // Rejects executables, scripts, and other unsafe types.
    // SVG is explicitly excluded even though it matches "image/" — an SVG stored
    // in the public media bucket executes inline <script> when opened directly
    // at its public URL (stored XSS). This route hands out a signed upload URL
    // for a DIRECT client-to-storage upload, so the server never sees the file
    // bytes and cannot magic-byte-sniff them — the MIME allowlist is the only
    // server-side gate here.
    const ALLOWED_MIME_PREFIXES = ["image/", "video/", "application/pdf"]
    const BLOCKED_MIME_TYPES    = ["image/svg+xml"]
    if (BLOCKED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `File type "${contentType}" is not allowed (SVG can contain executable content).` },
        { status: 400 },
      )
    }
    if (!ALLOWED_MIME_PREFIXES.some(prefix => contentType.startsWith(prefix))) {
      return NextResponse.json(
        { error: `File type "${contentType}" is not allowed. Upload images, videos, or PDFs only.` },
        { status: 400 },
      )
    }

    // Max 50 MB via Supabase Storage
    if (size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 })
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

    const ext  = filename.split(".").pop() ?? "bin"
    const path = `${brand.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Sign with the service client: the storage.objects INSERT policy (managed
    // in the dashboard) doesn't match our `${brand.id}/…` path prefix, so a
    // user-scoped createSignedUploadUrl fails RLS ("new row violates row-level
    // security policy") for accounts the policy shape doesn't cover.
    // Authorization is enforced ABOVE in code: session user + brand ownership
    // (getBrand scopes to the caller's account) + MIME + size + storage quota.
    const service = createServiceClient()
    const { data, error } = await service.storage
      .from("media")
      .createSignedUploadUrl(path)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const publicUrl = service.storage.from("media").getPublicUrl(path).data.publicUrl

    return NextResponse.json({ signedUrl: data.signedUrl, path, publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
