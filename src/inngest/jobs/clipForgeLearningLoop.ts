/**
 * Clip Forge Learning Loop — runs weekly (Monday 08:00 UTC, after the tone
 * loop). For each brand, aggregates unprocessed clip_forge_feedback and
 * nudges relevant intelligence_tokens. See
 * src/lib/server/brand/clipForgeFeedbackLoop.ts for the aggregation/threshold
 * logic — this file is just the Inngest wiring, same shape as
 * toneLearningLoop.ts.
 *
 * Invisible Code Guard:
 *   - Health: every nudge writes a brand_token_events row (source ids
 *     prefixed "clip_forge_feedback_batch_"/"clip_forge_feedback_rating_"),
 *     visible in /admin under "Brand Token Activity" — same surface the tone
 *     loop already uses.
 *   - Orphan detection: the admin dashboard's Feedback Learning Loops section
 *     flags brands with unprocessed clip_forge_feedback rows older than 10
 *     days (see src/app/(app)/admin/page.tsx) — if this job stops running,
 *     that count grows and the panel goes amber.
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { processClipForgeFeedbackForBrand } from "@/lib/server/brand/clipForgeFeedbackLoop"

export const clipForgeLearningLoop = inngest.createFunction(
  {
    id:       "clip-forge-learning-loop",
    name:     "Clip Forge Learning Loop",
    triggers: [{ cron: "0 8 * * 1" }],
    concurrency: { limit: 5 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    const brands = await step.run("get-brands", async () => {
      const { data } = await supabase.from("brands").select("id")
      return data ?? []
    })

    if (!brands.length) return { success: true, brandsChecked: 0, results: [] }

    const results = await Promise.all(
      brands.map(brand =>
        step.run(`clip-forge-loop-${brand.id}`, () => processClipForgeFeedbackForBrand(brand.id))
      )
    )

    return { success: true, brandsChecked: brands.length, results }
  }
)
