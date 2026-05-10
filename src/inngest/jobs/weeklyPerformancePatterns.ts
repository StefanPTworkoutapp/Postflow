/**
 * Weekly performance patterns — runs Sunday 23:00 UTC.
 */

import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { computePerformancePatterns } from "@/lib/server/analytics/computePerformancePatterns"

export const weeklyPerformancePatterns = inngest.createFunction(
  {
    id:       "weekly-performance-patterns",
    name:     "Weekly Performance Patterns",
    triggers: [{ cron: "0 23 * * 0" }],
    concurrency: { limit: 3 },
  },
  async ({ step }) => {
    const brandIds: string[] = await step.run("get-brand-ids", async () => {
      const supabase = createServiceClient()
      const { data } = await supabase.from("brands").select("id")
      return (data ?? []).map((b: { id: string }) => b.id)
    })

    const results = await Promise.all(
      brandIds.map((brandId: string) =>
        step.run(`patterns-${brandId}`, () => computePerformancePatterns(brandId))
      )
    )

    return {
      success: true,
      results: results.map((r, i) => ({ brandId: brandIds[i], ...r })),
    }
  }
)
