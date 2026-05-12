/**
 * Template Pulse — runs every 6 hours.
 *
 * For each brand, scores templates that are due for a check (next_check_at ≤ NOW).
 * Uses smart interval scheduling so active/declining templates check more often.
 *
 * Part 9 of the feature spec (Template Health Engine).
 */

import { inngest }                from "../client"
import { createServiceClient }    from "@/lib/supabase/service"
import { scoreTemplatesForBrand } from "@/lib/server/templates/health-scorer"

export const templatePulse = inngest.createFunction(
  {
    id:       "template-pulse",
    name:     "Template Pulse",
    triggers: [{ cron: "0 */6 * * *" }],  // every 6 hours
    concurrency: { limit: 5 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    // ── 1. Get brand IDs that have templates due for a check ───────────────
    const brandIds: string[] = await step.run("get-due-brands", async () => {
      const now = new Date().toISOString()

      // Brands with at least one template_health row due for checking
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: due } = await (supabase as any)
        .from("template_health")
        .select("brand_id")
        .lte("next_check_at", now)
        .eq("locked_by_user", false)

      // Also include all brands (new brands won't have template_health rows yet)
      const { data: allBrands } = await supabase
        .from("brands")
        .select("id")

      const dueBrandIds  = new Set((due ?? []).map((r: { brand_id: string }) => r.brand_id))
      const allBrandIds  = (allBrands ?? []).map((b: { id: string }) => b.id)

      // Union: due brands + any brand that has no health rows yet
      return [...new Set([...dueBrandIds, ...allBrandIds])]
    })

    if (!brandIds.length) return { success: true, brandsChecked: 0 }

    // ── 2. Score templates for each brand ──────────────────────────────────
    const results = await Promise.all(
      brandIds.map((brandId: string) =>
        step.run(`score-templates-${brandId}`, async () => {
          try {
            const result = await scoreTemplatesForBrand(brandId)
            return { brandId, ...result, error: null }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[template-pulse] scoreTemplates failed for ${brandId}:`, msg)
            return { brandId, templatesScored: 0, suggestionsCreated: 0, error: msg }
          }
        })
      )
    )

    const totalTemplates   = results.reduce((s, r) => s + r.templatesScored, 0)
    const totalSuggestions = results.reduce((s, r) => s + r.suggestionsCreated, 0)

    return {
      success:            true,
      brandsChecked:      brandIds.length,
      totalTemplatesScored:    totalTemplates,
      totalSuggestionsCreated: totalSuggestions,
    }
  }
)
