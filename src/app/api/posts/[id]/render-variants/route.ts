import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { renderMultiplePostCards } from "@/lib/server/render/renderPost"
import { getTemplatePerformance } from "@/lib/server/render/bestTemplate"

// 3 variants rendered in parallel — allow extra time
export const maxDuration = 120
export const runtime     = "nodejs"

/**
 * POST /api/posts/[id]/render-variants
 *
 * Renders 3 branded card variants using different single-image templates.
 * Returns ordered URLs so the UI can show a 3-up picker.
 *
 * Body (optional): { templateSlugs?: string[] }  — override the 3 templates to try.
 * If omitted, the route picks the best 3 single-image templates for the platform.
 *
 * Returns: { variants: Array<{ templateSlug: string; templateName: string; imageUrl: string }> }
 */

// Default variant order — photo-overlay first when a photo is attached
const SINGLE_IMAGE_TEMPLATES = [
  "photo-overlay",
  "dark-statement",
  "edu-bold",
]

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  let requestedSlugs: string[] | undefined
  try {
    const body = await req.json()
    requestedSlugs = Array.isArray(body?.templateSlugs) ? body.templateSlugs : undefined
  } catch { /* no body */ }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // Load post
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, platform, caption, hashtags, cta, media_ids")
    .eq("id", postId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (postErr || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  // Resolve first photo URL for background templates
  let mediaUrl: string | null = null
  const mediaIds = post.media_ids as string[] | null
  if (mediaIds && mediaIds.length > 0) {
    const { data: firstMedia } = await supabase
      .from("media_uploads")
      .select("public_url, media_type")
      .eq("id", mediaIds[0])
      .maybeSingle()
    if (firstMedia?.public_url && firstMedia.media_type !== "video") {
      mediaUrl = firstMedia.public_url
    }
  }

  const b = brand as unknown as {
    name:             string
    logo_url?:        string | null
    primary_color?:   string | null
    secondary_color?: string | null
    font_heading?:    string | null
    font_body?:       string | null
    template_style?:  number | null
  }

  // Pick which 3 template slugs to render.
  // If the user didn't specify, sort by actual performance for this brand+platform
  // so the best-performing template is always shown first (leftmost).
  let slugs: string[]
  if (requestedSlugs) {
    slugs = requestedSlugs.slice(0, 3)
  } else {
    const performance = await getTemplatePerformance(brand.id, post.platform)
    const rankedSlugs = performance.map(p => p.templateSlug)
    // Fill up to 3 with defaults for any slots not covered by performance data
    const fallback = SINGLE_IMAGE_TEMPLATES.filter(s => !rankedSlugs.includes(s))
    slugs = [...rankedSlugs, ...fallback].slice(0, 3)
  }

  const renderInput = {
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
    mediaUrl,
  }

  // Render all 3 in a SINGLE browser instance (sequential pages) — avoids OOM
  const renderInputs = slugs.map(slug => ({ ...renderInput, templateSlug: slug }))

  let pngs: Buffer[]
  try {
    pngs = await renderMultiplePostCards(renderInputs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Render error"
    console.error("[render-variants] render error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Upload all PNGs to storage
  const ts = Date.now()
  let variants: { templateSlug: string; imageUrl: string }[]
  try {
    variants = await Promise.all(
      slugs.map(async (slug, i) => {
        const storagePath = `${brand.id}/variants/${postId}/${slug}.png`
        const { error: uploadErr } = await supabase.storage
          .from("media")
          .upload(storagePath, pngs[i], { contentType: "image/png", upsert: true })

        if (uploadErr) throw new Error(`Upload failed for ${slug}: ${uploadErr.message}`)

        const { data: urlData } = supabase.storage.from("media").getPublicUrl(storagePath)
        return { templateSlug: slug, imageUrl: `${urlData.publicUrl}?t=${ts}` }
      })
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload error"
    console.error("[render-variants] upload error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Friendly names for the UI
  const TEMPLATE_NAMES: Record<string, string> = {
    "photo-overlay":  "Photo with Caption",
    "edu-bold":       "Education Bold",
    "quote-card":     "Quote Card",
    "dark-statement": "Dark Statement",
    "tip-numbered":   "Tip Numbered",
    "reel-cover":     "Reel Cover",
    "story-teaser":   "Story Teaser",
  }

  return NextResponse.json({
    variants: variants.map(v => ({
      ...v,
      templateName: TEMPLATE_NAMES[v.templateSlug] ?? v.templateSlug,
    })),
  })
}
