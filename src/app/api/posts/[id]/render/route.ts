import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { renderPostCard } from "@/lib/server/render/renderPost"
import { getBestTemplate } from "@/lib/server/render/bestTemplate"

// Allow up to 60 seconds — Puppeteer can be slow on cold starts
export const maxDuration = 60
export const runtime     = "nodejs"

/**
 * POST /api/posts/[id]/render
 * Renders a branded PNG card for the post and saves it to Supabase Storage.
 *
 * Body (optional JSON):
 *   { templateSlug?: string }   — overrides the template stored on the post
 *
 * Returns { image_url: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  // Parse optional body
  let bodyTemplateSlug: string | undefined
  try {
    const body = await req.json()
    bodyTemplateSlug = body?.templateSlug ?? undefined
  } catch {
    // No body or invalid JSON — fine, use post's saved slug
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // ── 1. Load post ────────────────────────────────────────────────────────────
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, platform, caption, hashtags, cta, template_slug, media_ids")
    .eq("id", postId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (postErr) {
    console.error("[render] post query error:", postErr.message)
    return NextResponse.json({ error: `Post query failed: ${postErr.message}` }, { status: 500 })
  }
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  // Template slug priority:
  //   1. Explicit request body (user picked from picker)
  //   2. Saved on the post
  //   3. Best-performing template for this brand+platform (performance learning)
  //   4. photo-overlay as universal fallback
  const learnedTemplate = (!bodyTemplateSlug && !post.template_slug)
    ? await getBestTemplate(brand.id, post.platform)
    : null

  const templateSlug =
    bodyTemplateSlug ??
    post.template_slug ??
    learnedTemplate ??
    "photo-overlay"

  // ── 1b. Resolve first photo URL from media_ids ───────────────────────────────
  let mediaUrl: string | null = null
  const mediaIds = post.media_ids as string[] | null
  if (mediaIds && mediaIds.length > 0) {
    const { data: firstMedia } = await supabase
      .from("media_uploads")
      .select("public_url, media_type")
      .eq("id", mediaIds[0])
      .maybeSingle()

    // Only use photos as background — not videos
    if (firstMedia?.public_url && firstMedia.media_type !== "video") {
      mediaUrl = firstMedia.public_url
    }
  }

  // ── 2. Render PNG via Puppeteer ─────────────────────────────────────────────
  const b = brand as unknown as {
    name:             string
    logo_url?:        string | null
    primary_color?:   string | null
    secondary_color?: string | null
    font_heading?:    string | null
    font_body?:       string | null
    template_style?:  number | null
  }

  let png: Buffer
  try {
    png = await renderPostCard({
      platform:       post.platform,
      caption:        post.caption ?? "",
      hashtags:       (post.hashtags as string[] | null) ?? [],
      cta:            post.cta ?? null,
      brandName:      b.name,
      logoUrl:        b.logo_url ?? null,
      primaryColor:   b.primary_color   ?? "#6366f1",
      secondaryColor: b.secondary_color ?? "#a5b4fc",
      fontHeading:    b.font_heading    ?? "Montserrat",
      fontBody:       b.font_body       ?? "Inter",
      templateStyle:  b.template_style  ?? 50,
      templateSlug,
      mediaUrl,       // ← first attached photo as background
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown render error"
    console.error("[render] Puppeteer error:", msg)
    return NextResponse.json({ error: `Render failed: ${msg}` }, { status: 500 })
  }

  // ── 3. Upload PNG to Storage ────────────────────────────────────────────────
  const storagePath = `${brand.id}/renders/${postId}.png`
  const { error: uploadErr } = await supabase.storage
    .from("media")
    .upload(storagePath, png, { contentType: "image/png", upsert: true })

  if (uploadErr) {
    console.error("[render] storage upload error:", uploadErr.message)
    return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from("media").getPublicUrl(storagePath)
  const imageUrl = urlData.publicUrl

  // ── 4. Save URL + template slug back to post (non-fatal) ────────────────────
  const { error: saveErr } = await supabase
    .from("posts")
    .update({
      generated_image_url: imageUrl,
      ...(templateSlug ? { template_slug: templateSlug } : {}),
    })
    .eq("id", postId)

  if (saveErr) {
    console.warn("[render] could not save post fields:", saveErr.message)
  }

  return NextResponse.json({ image_url: imageUrl })
}
