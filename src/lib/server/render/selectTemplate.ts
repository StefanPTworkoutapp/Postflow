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

  // 2. Fallback: pick a default template for this post_type
  const defaults = DEFAULT_TEMPLATES.filter(t => t.post_type === postType)
  if (defaults.length === 0) {
    // Ultimate fallback: any template
    return DEFAULT_TEMPLATES[postCount % DEFAULT_TEMPLATES.length]?.id ?? "edu-tips"
  }
  return defaults[postCount % defaults.length].id
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
