/**
 * carouselRenderService — shared business logic for carousel rendering.
 *
 * Extracted from the old synchronous POST /api/posts/[id]/render-carousel
 * route (P4, 2026-07-14) so 1-Puppeteer-page-per-slide never blocks an HTTP
 * request. Called from src/inngest/jobs/renderCarouselJob.ts.
 *
 * Body validation (assertCarouselValid) stays in the route — that's cheap
 * and synchronous, so bad input still fails fast with a 400 before a job is
 * ever enqueued. This module only does the expensive part: render + upload
 * + persist.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import { renderCarousel } from "@/lib/server/render/renderPost"
import type { CarouselRenderInput } from "@/lib/server/render/renderPost"

export interface CarouselRenderJobInput {
  postId:       string
  brandId:      string
  templateSlug: string
  slideContent: CarouselRenderInput["slideContent"]
}

export interface CarouselRenderJobResult {
  imageUrls: string[]
}

export async function runCarouselRenderJob(
  supabase: SupabaseClient<Database>,
  input:    CarouselRenderJobInput,
): Promise<CarouselRenderJobResult> {
  const { postId, brandId, templateSlug, slideContent } = input

  // ── Load post ──────────────────────────────────────────────────────────────
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, platform, caption, hashtags, cta")
    .eq("id", postId)
    .eq("brand_id", brandId)
    .maybeSingle()

  if (postErr) throw new Error(postErr.message)
  if (!post)   throw new Error("Post not found")

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

  // ── Render all slides via Puppeteer ───────────────────────────────────────
  const pngBuffers = await renderCarousel({
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
    templateSlug,
    slideContent,
  })

  // ── Upload each slide PNG to Storage ──────────────────────────────────────
  const imageUrls = await Promise.all(
    pngBuffers.map(async (png, idx) => {
      const storagePath = `${brandId}/carousel/${postId}/slide-${String(idx).padStart(2, "0")}.png`
      const { error } = await supabase.storage
        .from("media")
        .upload(storagePath, png, { contentType: "image/png", upsert: true })
      if (error) throw new Error(`Slide ${idx} upload failed: ${error.message}`)
      return supabase.storage.from("media").getPublicUrl(storagePath).data.publicUrl
    })
  )

  // ── Persist slide_content + carousel_image_urls to post ──────────────────
  await supabase
    .from("posts")
    .update({
      template_slug:       templateSlug,
      slide_content:       slideContent,
      carousel_image_urls: imageUrls,
    })
    .eq("id", postId)

  return { imageUrls }
}
