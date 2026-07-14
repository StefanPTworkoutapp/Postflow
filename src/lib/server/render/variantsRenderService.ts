/**
 * variantsRenderService — shared business logic for the 3-up variant render.
 *
 * Extracted from the old synchronous POST /api/posts/[id]/render-variants
 * route (P4, 2026-07-14) so 3 Puppeteer renders never block an HTTP request.
 * Called from src/inngest/jobs/renderVariantsJob.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { renderMultiplePostCards } from "@/lib/server/render/renderPost"
import { getTemplatePerformance } from "@/lib/server/render/bestTemplate"

export interface VariantsRenderJobInput {
  postId:         string
  brandId:        string
  templateSlugs?: string[]
}

export interface RenderedVariant {
  templateSlug: string
  templateName: string
  imageUrl:     string
}

export interface VariantsRenderJobResult {
  variants: RenderedVariant[]
}

// Default variant order — photo-overlay first when a photo is attached
const SINGLE_IMAGE_TEMPLATES = [
  "photo-overlay",
  "dark-statement",
  "edu-bold",
]

const TEMPLATE_NAMES: Record<string, string> = {
  "photo-overlay":  "Photo with Caption",
  "edu-bold":       "Education Bold",
  "quote-card":     "Quote Card",
  "dark-statement": "Dark Statement",
  "tip-numbered":   "Tip Numbered",
  "reel-cover":     "Reel Cover",
  "story-teaser":   "Story Teaser",
}

export async function runVariantsRenderJob(
  supabase: SupabaseClient<Database>,
  input:    VariantsRenderJobInput,
): Promise<VariantsRenderJobResult> {
  const { postId, brandId, templateSlugs: requestedSlugs } = input

  // ── Load post ──────────────────────────────────────────────────────────────
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, platform, caption, hashtags, cta, media_ids")
    .eq("id", postId)
    .eq("brand_id", brandId)
    .maybeSingle()

  if (postErr || !post) throw new Error("Post not found")

  // ── Resolve first photo URL for background templates ──────────────────────
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

  // ── Load brand ────────────────────────────────────────────────────────────
  const { data: brand, error: brandErr } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .maybeSingle()

  if (brandErr || !brand) throw new Error("Brand not found")

  const b = brand as unknown as {
    name:             string
    logo_url?:        string | null
    primary_color?:   string | null
    secondary_color?: string | null
    accent_color?:    string | null
    font_heading?:    string | null
    font_body?:       string | null
    template_style?:  number | null
  }

  // ── Pick which 3 template slugs to render ─────────────────────────────────
  let slugs: string[]
  if (requestedSlugs) {
    slugs = requestedSlugs.slice(0, 3)
  } else {
    const performance = await getTemplatePerformance(brandId, post.platform)
    const rankedSlugs = performance.map(p => p.templateSlug)
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
    accentColor:    b.accent_color    ?? b.secondary_color ?? "#a5b4fc",
    fontHeading:    b.font_heading    ?? "Montserrat",
    fontBody:       b.font_body       ?? "Inter",
    templateStyle:  b.template_style  ?? 50,
    mediaUrl,
  }

  const renderInputs = slugs.map(slug => ({ ...renderInput, templateSlug: slug }))

  // Render all 3 in a SINGLE browser instance (sequential pages) — avoids OOM
  const pngs = await renderMultiplePostCards(renderInputs)

  // ── Upload all PNGs to storage ────────────────────────────────────────────
  const ts = Date.now()
  const variants = await Promise.all(
    slugs.map(async (slug, i) => {
      const storagePath = `${brandId}/variants/${postId}/${slug}.png`
      const { error: uploadErr } = await supabase.storage
        .from("media")
        .upload(storagePath, pngs[i], { contentType: "image/png", upsert: true })
      if (uploadErr) throw new Error(`Upload failed for ${slug}: ${uploadErr.message}`)

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(storagePath)
      return { templateSlug: slug, imageUrl: `${urlData.publicUrl}?t=${ts}` }
    })
  )

  return {
    variants: variants.map(v => ({
      ...v,
      templateName: TEMPLATE_NAMES[v.templateSlug] ?? v.templateSlug,
    })),
  }
}
