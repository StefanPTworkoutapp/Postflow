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
 * Select the next template slug to use for a brand + post_type combination.
 *
 * @param brandId   - brands.id
 * @param postType  - e.g. "single_image" | "carousel" | "reel" | etc.
 * @param postCount - How many posts of this type have already been published
 *                   by this brand. Used for deterministic round-robin.
 * @returns The template slug to use (falls back to default if no preferences set).
 */
export async function selectTemplate(
  brandId:   string,
  postType:  string,
  postCount: number,
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

  // 2. Fallback: rotate through the render templates valid for this post_type.
  // (Must return a render slug, not a caption-template id — see
  // RENDER_SLUGS_BY_POST_TYPE above.)
  const renderSlugs = RENDER_SLUGS_BY_POST_TYPE[postType]
  if (!renderSlugs || renderSlugs.length === 0) {
    // Ultimate fallback: no pool for this post_type at all — pick the single
    // best-fit render slug so callers always get something valid.
    return ultimateFallbackSlug(postType)
  }
  return renderSlugs[postCount % renderSlugs.length]
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
