import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { renderCarousel } from "@/lib/server/render/renderPost"
import type { CarouselRenderInput } from "@/lib/server/render/renderPost"

// Carousel renders can take a while (1 Puppeteer instance per slide, parallelised)
export const maxDuration = 120
export const runtime     = "nodejs"

/**
 * POST /api/posts/[id]/render-carousel
 *
 * Body:
 *   {
 *     templateSlug: string,
 *     slideContent: Array<{ headline: string, body?: string, isCTA?: boolean, isHook?: boolean, mediaUrl?: string | null }>
 *   }
 *
 * Returns:
 *   { imageUrls: string[] }  — ordered, one URL per slide
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // ── 1. Parse body ────────────────────────────────────────────────────────────
  let templateSlug: string
  let slideContent: CarouselRenderInput["slideContent"]

  try {
    const body = await req.json()
    templateSlug = body.templateSlug
    slideContent = body.slideContent
    if (!templateSlug) throw new Error("templateSlug required")
    if (!Array.isArray(slideContent) || slideContent.length === 0) {
      throw new Error("slideContent array required")
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid request body"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // ── 2. Load post ────────────────────────────────────────────────────────────
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, platform, caption, hashtags, cta")
    .eq("id", postId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 })
  if (!post)   return NextResponse.json({ error: "Post not found" }, { status: 404 })

  // ── 3. Render all slides via Puppeteer ───────────────────────────────────────
  const b = brand as unknown as {
    name:             string
    logo_url?:        string | null
    primary_color?:   string | null
    secondary_color?: string | null
    font_heading?:    string | null
    font_body?:       string | null
    template_style?:  number | null
  }

  let pngBuffers: Buffer[]
  try {
    pngBuffers = await renderCarousel({
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
      slideContent,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Render error"
    console.error("[render-carousel] Puppeteer error:", msg)
    return NextResponse.json({ error: `Render failed: ${msg}` }, { status: 500 })
  }

  // ── 4. Upload each slide PNG to Storage ──────────────────────────────────────
  const uploadPromises = pngBuffers.map((png, idx) => {
    const storagePath = `${brand.id}/carousel/${postId}/slide-${String(idx).padStart(2, "0")}.png`
    return supabase.storage
      .from("media")
      .upload(storagePath, png, { contentType: "image/png", upsert: true })
      .then(({ error }) => {
        if (error) throw new Error(`Slide ${idx} upload failed: ${error.message}`)
        return supabase.storage.from("media").getPublicUrl(storagePath).data.publicUrl
      })
  })

  let imageUrls: string[]
  try {
    imageUrls = await Promise.all(uploadPromises)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Storage upload error"
    console.error("[render-carousel] upload error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Add cache-busting timestamps
  const ts = Date.now()
  const cacheBustedUrls = imageUrls.map(url => `${url}?t=${ts}`)

  // ── 5. Persist slide_content + carousel_image_urls to post ──────────────────
  await supabase
    .from("posts")
    .update({
      template_slug:        templateSlug,
      slide_content:        slideContent,
      carousel_image_urls:  imageUrls,
    })
    .eq("id", postId)

  return NextResponse.json({ imageUrls: cacheBustedUrls })
}
