import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"

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

  const originalName = (file as File).name ?? "slide"
  const ext          = originalName.split(".").pop()?.toLowerCase() ?? "bin"
  const safeName     = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath  = `${brand.id}/slides/${postId}/${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await supabase.storage
    .from("media")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert:      false,
    })

  if (uploadErr) {
    console.error("[slide-media] upload error:", uploadErr.message)
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(storagePath)

  return NextResponse.json({ url: publicUrl })
}
