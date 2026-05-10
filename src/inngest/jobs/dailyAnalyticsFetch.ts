/**
 * Daily analytics fetch — runs at 06:00 UTC every day.
 * Fan-out: one step per active brand, per connected platform.
 */

import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { fetchAndStoreMetaAnalytics } from "@/lib/server/analytics/fetchMetaAnalytics"
import { fetchAndStoreLinkedInAnalytics } from "@/lib/server/analytics/fetchLinkedInAnalytics"

export const dailyAnalyticsFetch = inngest.createFunction(
  {
    id:       "daily-analytics-fetch",
    name:     "Daily Analytics Fetch",
    triggers: [{ cron: "0 6 * * *" }],
    concurrency: { limit: 5 },
  },
  async ({ step }) => {
    // 1. Get all active brand IDs
    const brandIds: string[] = await step.run("get-brand-ids", async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase.from("brands").select("id")
      if (error) throw new Error(`Failed to load brands: ${error.message}`)
      return (data ?? []).map((b: { id: string }) => b.id)
    })

    // 2. Fan out per brand
    await Promise.all(
      brandIds.map((brandId: string) =>
        step.run(`fetch-analytics-${brandId}`, async () => {
          const [meta, linkedin] = await Promise.all([
            fetchAndStoreMetaAnalytics(brandId),
            fetchAndStoreLinkedInAnalytics(brandId),
          ])
          return { brandId, instagram: meta, linkedin }
        })
      )
    )

    return { success: true, brandsProcessed: brandIds.length }
  }
)
