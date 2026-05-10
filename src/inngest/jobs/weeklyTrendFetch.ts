/**
 * Weekly trend fetch — runs Sunday 22:00 UTC.
 */

import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { storeTrendsForBrand } from "@/lib/server/trends/storeTrends"

export const weeklyTrendFetch = inngest.createFunction(
  {
    id:       "weekly-trend-fetch",
    name:     "Weekly Trend Fetch",
    triggers: [{ cron: "0 22 * * 0" }],
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
        step.run(`trends-${brandId}`, () => storeTrendsForBrand(brandId))
      )
    )

    return {
      success: true,
      results: results.map((r, i) => ({ brandId: brandIds[i], ...r })),
    }
  }
)
