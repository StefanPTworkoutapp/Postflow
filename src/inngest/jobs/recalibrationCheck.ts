/**
 * Recalibration check — runs weekly (Sunday 06:00 UTC).
 *
 * For each brand, checks whether re-calibration is due:
 *   1. calibration_done_at > 90 days ago (brand knowledge is stale)
 *   2. OR health_score < 45 on 2+ platforms in template_health (brand is underperforming)
 *
 * When triggered: sets brands.calibration_status = 'due'.
 * The dashboard reads this and shows a banner linking to /onboarding.
 *
 * Re-calibration resets calibration_done_at and status → 'complete'.
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"

const STALE_DAYS          = 90
const HEALTH_THRESHOLD    = 45
const POOR_PLATFORM_COUNT = 2

export const recalibrationCheck = inngest.createFunction(
  {
    id:       "recalibration-check",
    name:     "Weekly Recalibration Check",
    triggers: [{ cron: "0 6 * * 0" }], // Sunday 06:00 UTC
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    // ── Fetch all active brands ──────────────────────────────
    const brands = await step.run("get-brands", async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, calibration_done_at, calibration_status")
        .not("calibration_done_at", "is", null)

      if (error) throw new Error(`recalibrationCheck: ${error.message}`)
      return data ?? []
    })

    if (!brands.length) return { checked: 0, markedDue: 0 }

    const now         = new Date()
    const staleCutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000)

    let markedDue = 0

    for (const brand of brands) {
      // Skip brands already marked as due (avoid repeated writes)
      if (brand.calibration_status === "due") continue

      let isDue = false
      let reason = ""

      // ── Check 1: staleness ──────────────────────────────────
      const calibratedAt = brand.calibration_done_at
        ? new Date(brand.calibration_done_at)
        : null

      if (calibratedAt && calibratedAt < staleCutoff) {
        isDue = true
        const ageDays = Math.floor((now.getTime() - calibratedAt.getTime()) / (24 * 60 * 60 * 1000))
        reason = `calibration is ${ageDays} days old (threshold: ${STALE_DAYS} days)`
      }

      // ── Check 2: template health per platform ───────────────
      if (!isDue) {
        await step.run(`check-health-${brand.id}`, async () => {
          const { data: rows } = await supabase
            .from("template_health")
            .select("platform, health_score")
            .eq("brand_id", brand.id)
            .lt("health_score", HEALTH_THRESHOLD)

          if (!rows?.length) return

          // Count distinct platforms with poor health
          const poorPlatforms = [...new Set(rows.map(r => r.platform))]
          if (poorPlatforms.length >= POOR_PLATFORM_COUNT) {
            isDue = true
            reason = `health score < ${HEALTH_THRESHOLD} on ${poorPlatforms.length} platforms: ${poorPlatforms.join(", ")}`
          }
        })
      }

      if (!isDue) continue

      // ── Mark as due ─────────────────────────────────────────
      await step.run(`mark-due-${brand.id}`, async () => {
        const { error } = await supabase
          .from("brands")
          .update({ calibration_status: "due", updated_at: now.toISOString() })
          .eq("id", brand.id)

        if (error) throw new Error(`recalibrationCheck mark-due: ${error.message}`)
        markedDue++
      })

      step.sendEvent(`log-${brand.id}`, {
        name: "postflow/recalibration.due",
        data: { brandId: brand.id, reason },
      })
    }

    return { checked: brands.length, markedDue }
  },
)
