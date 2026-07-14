/**
 * selectTemplate — server-side template rotation logic.
 *
 * For each brand + post_type combination, rotates through the brand's saved
 * template slots in `brand_template_preferences`. If no slots are configured,
 * falls back to a deterministic pick from the default template pool.
 *
 * Rotation is deterministic: slot = (published_post_count % slot_count)
 * No mutable state needed — count-based so calendar generation is reproducible.
 */

import { createServiceClient }   from "@/lib/supabase/service"
import { DEFAULT_TEMPLATES }     from "@/lib/shared/posts/templates"
import type { PostTemplate }     from "@/lib/shared/posts/templates"

interface TemplateSlot {
  template_slug: string
  slot_index:    number
  locked:        boolean
}

/**
 * Render template slugs (from the registry at src/lib/server/render/templates/index.ts),
 * grouped by post_type. Used when a brand has no saved template slots — the
 * result of selectTemplate() is stored as posts.template_slug / content_calendar
 * entries, which the render pipeline resolves via getTemplate(slug) from that
 * registry. It must NEVER return a caption-template id (DEFAULT_TEMPLATES
 * below, e.g. "edu-tips") — those live in a different id namespace and would
 * make getTemplate() throw "Unknown template slug".
 */
const RENDER_SLUGS_BY_POST_TYPE: Record<string, string[]> = {
  single_image:      ["photo-overlay", "edu-bold", "quote-card", "dark-statement", "tip-numbered"],
  carousel:          ["carousel-edu", "carousel-myth"],
  reel:              ["reel-cover"],
  reel_cover:        ["reel-cover"],
  story:             ["story-teaser"],
  // No dedicated render template exists for these post types yet — fall back
  // to the safest general-purpose single-image slug rather than throwing.
  text_only:         ["photo-overlay"],
  quote:             ["quote-card"],
  testimonial:       ["photo-overlay"],
  behind_the_scenes: ["photo-overlay"],
}

/** Single-slug fallback per post_type, used when there's no rotation pool to pick from. */
function ultimateFallbackSlug(postType: string): string {
  switch (postType) {
    case "carousel":   return "carousel-edu"
    case "reel":
    case "reel_cover": return "reel-cover"
    case "story":      return "story-teaser"
    case "quote":      return "quote-card"
    default:           return "photo-overlay"
  }
}

/**
 * Dedicated single-platform render templates that should be preferred over
 * the generic multi-platform pool for a given post_type + platform. Added
 * P2b (2026-07-14) — X and LinkedIn single_image posts were previously
 * rendered from the same generic pool as Instagram/Facebook (photo-overlay,
 * edu-bold, etc.), which looks resized rather than native to those
 * platforms. TikTok's entry is for photo-mode/single-image TikTok posts
 * only — NOT actual video reels, which stay on "reel-cover" via
 * RENDER_SLUGS_BY_POST_TYPE["reel"/"reel_cover"] above and are untouched by
 * this map. reel-cover and tiktok-cover coexist for different content:
 * reel-cover = first frame of an uploaded video reel, tiktok-cover = a
 * from-scratch graphic for a single-image TikTok post.
 *
 * This only applies in the no-saved-slots fallback branch below — a
 * brand's saved/locked template_slug always wins, same as every other
 * rotation entry.
 */
const PLATFORM_DEDICATED_SLUG: Record<string, Record<string, string>> = {
  single_image: {
    x:        "x-statement",
    linkedin: "linkedin-insight",
    tiktok:   "tiktok-cover",
  },
}

/**
 * Returns the dedicated render slug for this post_type + platform, if one
 * exists. Returns undefined when there's no platform-specific override —
 * callers fall through to the generic rotation pool.
 */
function getPlatformDedicatedSlug(postType: string, platform?: string): string | undefined {
  if (!platform) return undefined
  return PLATFORM_DEDICATED_SLUG[postType]?.[platform]
}

/**
 * Fetch the brand's niche top-performing template slugs for a platform, from
 * the weekly refreshNicheBenchmarks() output. Was computed and stored with
 * zero readers until P1 (2026-07-14) — see buildWeightedPool() below for how
 * it's used as a rotation tiebreaker. Returns [] (silent fallback) whenever
 * there's no platform, no niche, or no benchmark row yet.
 */
async function getNicheTopSlugs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  brandId:  string,
  platform?: string,
): Promise<string[]> {
  if (!platform) return []

  const { data: brand } = await supabase
    .from("brands")
    .select("niche, industry")
    .eq("id", brandId)
    .maybeSingle()
  const nicheTag = brand?.niche ?? brand?.industry ?? "general"

  const { data: benchmark } = await supabase
    .from("niche_benchmarks")
    .select("top_template_slugs")
    .eq("niche_tag", nicheTag)
    .eq("platform", platform)
    .maybeSingle()

  return (benchmark?.top_template_slugs as string[] | null) ?? []
}

/**
 * Weight a rotation pool toward niche top performers by giving each matching
 * slug double representation. Rotation stays deterministic (postCount %
 * pool.length) — this only changes the odds each slug gets picked over many
 * calls, not the reproducibility of any single call. No-op when there's no
 * niche data (nicheTopSlugs is empty), matching this file's "always falls
 * back silently" contract.
 */
function buildWeightedPool(baseSlugs: string[], nicheTopSlugs: string[]): string[] {
  if (!nicheTopSlugs.length) return baseSlugs
  const weighted = baseSlugs.flatMap(slug => nicheTopSlugs.includes(slug) ? [slug, slug] : [slug])
  return weighted.length ? weighted : baseSlugs
}

/**
 * Select the next template slug to use for a brand + post_type combination.
 *
 * @param brandId   - brands.id
 * @param postType  - e.g. "single_image" | "carousel" | "reel" | etc.
 * @param postCount - How many posts of this type have already been published
 *                   by this brand. Used for deterministic round-robin.
 * @param platform  - optional: when provided, the no-saved-slots fallback
 *                   pool is weighted toward this brand's niche top templates
 *                   for that platform (niche_benchmarks.top_template_slugs).
 * @returns The template slug to use (falls back to default if no preferences set).
 */
export async function selectTemplate(
  brandId:   string,
  postType:  string,
  postCount: number,
  platform?: string,
): Promise<string> {
  const supabase = createServiceClient()

  // 1. Load saved slots for this brand + post_type
  const { data: slots } = await supabase
    .from("brand_template_preferences")
    .select("template_slug, slot_index, locked")
    .eq("brand_id", brandId)
    .eq("post_type", postType)
    .order("slot_index", { ascending: true })

  if (slots && slots.length > 0) {
    // Round-robin: pick slot at index (postCount % slotCount)
    const index = postCount % slots.length
    const slot  = (slots as TemplateSlot[])[index]
    return slot.template_slug
  }

  // 2a. Platform-dedicated slug: a platform with its own native render
  // template (X, LinkedIn, TikTok photo-mode) is preferred outright over the
  // generic multi-platform pool — a native look is the correct default here,
  // not just one option in the rotation. Only applies when there's no saved
  // slot (checked above), so a brand that has explicitly picked/locked a
  // different template for this post_type is never overridden.
  const dedicatedSlug = getPlatformDedicatedSlug(postType, platform)
  if (dedicatedSlug) return dedicatedSlug

  // 2b. Fallback: rotate through the render templates valid for this post_type,
  // weighted toward niche top performers when we have that data (all pool
  // entries here are inherently "unlocked" — there's no saved/locked slot to
  // defer to in this branch).
  // (Must return a render slug, not a caption-template id — see
  // RENDER_SLUGS_BY_POST_TYPE above.)
  const renderSlugs = RENDER_SLUGS_BY_POST_TYPE[postType]
  if (!renderSlugs || renderSlugs.length === 0) {
    // Ultimate fallback: no pool for this post_type at all — pick the single
    // best-fit render slug so callers always get something valid.
    return ultimateFallbackSlug(postType)
  }

  const nicheTopSlugs = await getNicheTopSlugs(supabase, brandId, platform)
  const weightedPool  = buildWeightedPool(renderSlugs, nicheTopSlugs)
  return weightedPool[postCount % weightedPool.length]
}

/**
 * Get all slots for a brand + post_type (for the brand editor UI).
 */
export async function getTemplateSlots(
  brandId:  string,
  postType: string,
): Promise<TemplateSlot[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("brand_template_preferences")
    .select("template_slug, slot_index, locked")
    .eq("brand_id", brandId)
    .eq("post_type", postType)
    .order("slot_index", { ascending: true })
  return (data ?? []) as TemplateSlot[]
}

/**
 * Add a template slot for a brand + post_type.
 * Does NOT enforce plan limits — callers must check before calling.
 */
export async function addTemplateSlot(
  brandId:      string,
  postType:     string,
  templateSlug: string,
  slotIndex:    number,
): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from("brand_template_preferences").upsert({
    brand_id:      brandId,
    post_type:     postType,
    template_slug: templateSlug,
    slot_index:    slotIndex,
    locked:        false,
    updated_at:    new Date().toISOString(),
  }, { onConflict: "brand_id,post_type,slot_index" })
}

/**
 * Remove a template slot.
 */
export async function removeTemplateSlot(
  brandId:   string,
  postType:  string,
  slotIndex: number,
): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from("brand_template_preferences")
    .delete()
    .eq("brand_id", brandId)
    .eq("post_type", postType)
    .eq("slot_index", slotIndex)
}

/**
 * Toggle the locked state of a slot.
 */
export async function toggleSlotLock(
  brandId:   string,
  postType:  string,
  slotIndex: number,
  locked:    boolean,
): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from("brand_template_preferences")
    .update({ locked, updated_at: new Date().toISOString() })
    .eq("brand_id", brandId)
    .eq("post_type", postType)
    .eq("slot_index", slotIndex)
}

/**
 * Return the lowest-scoring unlocked slot to replace (for auto-swap by templatePulse).
 * Returns null if all slots are locked or if there are no slots.
 */
export async function getReplacementSlot(
  brandId:  string,
  postType: string,
  healthScores: Record<string, number>,
): Promise<{ slotIndex: number; currentSlug: string } | null> {
  const slots = await getTemplateSlots(brandId, postType)
  const unlocked = slots.filter(s => !s.locked)
  if (!unlocked.length) return null

  // Find unlocked slot with the lowest health score
  const sorted = unlocked.sort((a, b) =>
    (healthScores[a.template_slug] ?? 0) - (healthScores[b.template_slug] ?? 0)
  )
  const worst = sorted[0]
  return { slotIndex: worst.slot_index, currentSlug: worst.template_slug }
}

/**
 * Get template by slug (for display in the brand editor UI).
 */
export function getTemplateBySlug(slug: string): PostTemplate | undefined {
  return DEFAULT_TEMPLATES.find(t => t.id === slug)
}

export interface TemplateSwapResult {
  applied: boolean
  reason?: string
  swapped: Array<{ post_type: string; slot_index: number }>
}

/**
 * Apply an approved template_suggestion by swapping suggestedSlug into every
 * UNLOCKED brand_template_preferences slot currently running currentSlug.
 * locked_by_user slots (the plan-lock mechanism) are never touched.
 *
 * This is what makes template_suggestions approval actually DO something —
 * previously PATCH /api/templates/suggestions/[id] only flipped
 * status='approved' and getReplacementSlot() below was dead code that
 * nothing called.
 *
 * We match purely on template_slug (not post_type/platform) because
 * template_suggestions only carries `platform`, not `post_type`, and a slug
 * uniquely identifies which slots are running it — querying by
 * (brand_id, template_slug) sidesteps needing a slug→post_type reverse
 * lookup (which would be ambiguous anyway: e.g. "quote-card" is valid for
 * both the "quote" and "single_image" post types).
 */
export async function applyTemplateSuggestionSwap(
  brandId:       string,
  currentSlug:   string,
  suggestedSlug: string,
): Promise<TemplateSwapResult> {
  const supabase = createServiceClient()

  const { data: rows } = await supabase
    .from("brand_template_preferences")
    .select("post_type, slot_index, locked")
    .eq("brand_id", brandId)
    .eq("template_slug", currentSlug)

  const matches = (rows ?? []) as Array<{ post_type: string; slot_index: number; locked: boolean }>

  if (!matches.length) {
    return {
      applied: false,
      reason:  "Brand has no saved template slot using this template — nothing to swap (using default rotation).",
      swapped: [],
    }
  }

  const unlocked = matches.filter(m => !m.locked)
  const locked   = matches.filter(m => m.locked)

  if (!unlocked.length) {
    return {
      applied: false,
      reason:  `All ${matches.length} matching slot${matches.length > 1 ? "s are" : " is"} locked by the user — approved but not applied.`,
      swapped: [],
    }
  }

  const now = new Date().toISOString()
  await Promise.all(
    unlocked.map(m =>
      supabase
        .from("brand_template_preferences")
        .update({ template_slug: suggestedSlug, updated_at: now })
        .eq("brand_id", brandId)
        .eq("post_type", m.post_type)
        .eq("slot_index", m.slot_index)
    )
  )

  return {
    applied: true,
    reason:  locked.length ? `${locked.length} matching slot${locked.length > 1 ? "s" : ""} left untouched (locked).` : undefined,
    swapped: unlocked.map(m => ({ post_type: m.post_type, slot_index: m.slot_index })),
  }
}
