/**
 * Niche Benchmark Refresh — runs weekly on Wednesday at 03:00 UTC.
 *
 * Computes anonymised cross-brand performance aggregates per niche+platform
 * and upserts into niche_benchmarks. These benchmarks are used by the
 * Template Health Engine to contextualise template performance.
 *
 * Part 9 of the feature spec (Template Health Engine).
 */

import { inngest }                  from "../client"
import { refreshNicheBenchmarks }   from "@/lib/server/templates/niche-benchmark-refresh"

export const nicheBenchmarkRefresh = inngest.createFunction(
  {
    id:       "niche-benchmark-refresh",
    name:     "Niche Benchmark Refresh",
    // Wednesday 03:00 UTC — offset from nicheResearchSync (Monday) to spread load
    triggers: [{ cron: "0 3 * * 3" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const result = await step.run("refresh-benchmarks", async () => {
      return await refreshNicheBenchmarks()
    })

    return {
      success:        true,
      nichesRefreshed: result.nichesRefreshed,
    }
  }
)
