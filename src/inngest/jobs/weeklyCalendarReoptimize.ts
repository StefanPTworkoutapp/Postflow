/**
 * Weekly calendar re-optimization — runs Monday 04:00 UTC (before
 * weeklyPerformancePatterns' 23:00 Sunday run has a chance to go stale, and
 * well clear of the 05:30/06:00 analytics/feed-import crons).
 *
 * For every brand, re-scores 'planned' content_calendar entries in the next
 * 30 days against two signals — never touches 'drafting'/'ready'/'scheduled'/
 * 'posted'/'archived' entries, only 'planned' ones nobody has started work on:
 *
 *   1. TIMING — if performance_patterns shows a better day-of-week for this
 *      platform (sample_size >= 5, same bar as optimal-time.ts), move the
 *      slot to that weekday WITHIN THE SAME WEEK ONLY (Mon–Sun containing its
 *      current scheduled_date) — never reshuffles across weeks.
 *   2. TEMPLATE — if the entry's template_slug is declining in
 *      template_health (trend='declining', score<45, posts_count>=3) and a
 *      meaningfully better UNLOCKED alternative exists for the same platform,
 *      swap it. Locked slots (brand_template_preferences.locked, same
 *      lock semantics as applyTemplateSuggestionSwap in selectTemplate.ts)
 *      are never touched.
 *
 * Every change is logged to `calendar_optimizations` — nothing here is a
 * silent mutation; the calendar UI surfaces "Calendar optimized — N changes
 * this week" from that table.
 *
 * Pure data — no AI calls, fully deterministic.
 */

import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { getTemplateSlots } from "@/lib/server/render/selectTemplate"

/**
 * Type-bypass helper for tables not yet in the generated database.types.ts.
 * Remove once migration 20260714000010 runs and types are regenerated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newTables = (client: ReturnType<typeof createServiceClient>) => client as any

const HORIZON_DAYS = 30

interface CalendarEntryRow {
  id:             string
  scheduled_date: string
  scheduled_time: string | null
  platforms:      string[] | null
  post_type:      string | null
  template_slug:  string | null
}

interface PatternRow {
  platform:          string
  best_days_of_week: number[] | null
  best_hours_of_day: number[] | null
  sample_size:       number | null
}

interface TemplateHealthRow {
  platform:      string
  template_slug: string
  health_score:  number | null
  trend:         string | null
  posts_count:   number | null
}

/** Moves `currentDate` to `targetDow` within the SAME Mon–Sun week (UTC). */
function moveWithinSameWeek(currentDate: Date, targetDow: number): Date {
  const currentDow = currentDate.getUTCDay()
  const monday = new Date(currentDate)
  const diffToMonday = currentDow === 0 ? -6 : 1 - currentDow
  monday.setUTCDate(monday.getUTCDate() + diffToMonday)

  const dayOffset = targetDow === 0 ? 6 : targetDow - 1
  const result = new Date(monday)
  result.setUTCDate(monday.getUTCDate() + dayOffset)
  return result
}

async function reoptimizeBrand(brandId: string): Promise<{ timingChanges: number; templateChanges: number }> {
  const supabase = createServiceClient()

  const today   = new Date()
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000)
  const from    = today.toISOString().split("T")[0]
  const to      = horizon.toISOString().split("T")[0]

  const { data: entries } = await supabase
    .from("content_calendar")
    .select("id, scheduled_date, scheduled_time, platforms, post_type, template_slug")
    .eq("brand_id", brandId)
    .eq("status", "planned")
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)

  if (!entries?.length) return { timingChanges: 0, templateChanges: 0 }

  const { data: patterns } = await supabase
    .from("performance_patterns")
    .select("platform, best_days_of_week, best_hours_of_day, sample_size")
    .eq("brand_id", brandId)

  const { data: templateHealth } = await supabase
    .from("template_health")
    .select("platform, template_slug, health_score, trend, posts_count")
    .eq("brand_id", brandId)

  const patternRows       = (patterns ?? []) as PatternRow[]
  const templateHealthRows = (templateHealth ?? []) as TemplateHealthRow[]

  let timingChanges    = 0
  let templateChanges  = 0

  for (const entry of (entries as CalendarEntryRow[])) {
    const platform = entry.platforms?.[0]
    if (!platform) continue

    // ── Timing re-score ──────────────────────────────────────────────────
    const pattern = patternRows.find(p => p.platform === platform)
    if (pattern && (pattern.sample_size ?? 0) >= 5 && pattern.best_days_of_week?.length) {
      const targetDow  = pattern.best_days_of_week[0]
      const currentDate = new Date(`${entry.scheduled_date}T00:00:00Z`)

      if (currentDate.getUTCDay() !== targetDow) {
        const newDate    = moveWithinSameWeek(currentDate, targetDow)
        const newDateStr = newDate.toISOString().split("T")[0]
        const newTime    = pattern.best_hours_of_day?.length
          ? `${String(pattern.best_hours_of_day[0]).padStart(2, "0")}:00:00`
          : entry.scheduled_time

        if (newDateStr !== entry.scheduled_date || newTime !== entry.scheduled_time) {
          const { error } = await supabase
            .from("content_calendar")
            .update({ scheduled_date: newDateStr, scheduled_time: newTime })
            .eq("id", entry.id)

          if (!error) {
            await newTables(supabase).from("calendar_optimizations").insert({
              brand_id:    brandId,
              entry_id:    entry.id,
              change_type: "timing",
              from_value:  `${entry.scheduled_date} ${entry.scheduled_time ?? ""}`.trim(),
              to_value:    `${newDateStr} ${newTime ?? ""}`.trim(),
              reason:      `${platform} performs best on day ${targetDow}${pattern.best_hours_of_day?.length ? ` around ${pattern.best_hours_of_day[0]}:00` : ""} (${pattern.sample_size} posts of data)`,
            })
            timingChanges++
          } else {
            console.error(`[weekly-calendar-reoptimize] timing update failed for entry ${entry.id}:`, error.message)
          }
        }
      }
    }

    // ── Template re-score ─────────────────────────────────────────────────
    if (entry.template_slug) {
      const currentHealth = templateHealthRows.find(
        t => t.platform === platform && t.template_slug === entry.template_slug
      )

      const isDeclining = currentHealth
        && currentHealth.trend === "declining"
        && (currentHealth.health_score ?? 100) < 45
        && (currentHealth.posts_count ?? 0) >= 3

      if (isDeclining) {
        const postType = entry.post_type ?? "single_image"
        // Never touch a locked slot — same semantics as
        // applyTemplateSuggestionSwap() in selectTemplate.ts.
        const slots = await getTemplateSlots(brandId, postType)
        const matchingSlot = slots.find(s => s.template_slug === entry.template_slug)

        if (!matchingSlot?.locked) {
          const alternative = templateHealthRows
            .filter(t =>
              t.platform === platform &&
              t.template_slug !== entry.template_slug &&
              (t.posts_count ?? 0) >= 3 &&
              (t.health_score ?? 0) >= (currentHealth!.health_score ?? 0) + 15
            )
            .sort((a, b) => (b.health_score ?? 0) - (a.health_score ?? 0))[0]

          if (alternative) {
            const { error } = await supabase
              .from("content_calendar")
              .update({ template_slug: alternative.template_slug })
              .eq("id", entry.id)

            if (!error) {
              await newTables(supabase).from("calendar_optimizations").insert({
                brand_id:    brandId,
                entry_id:    entry.id,
                change_type: "template",
                from_value:  entry.template_slug,
                to_value:    alternative.template_slug,
                reason:      `${entry.template_slug} declining (score ${currentHealth!.health_score}) — ${alternative.template_slug} scoring ${alternative.health_score}`,
              })
              templateChanges++
            } else {
              console.error(`[weekly-calendar-reoptimize] template update failed for entry ${entry.id}:`, error.message)
            }
          }
        }
      }
    }
  }

  return { timingChanges, templateChanges }
}

export const weeklyCalendarReoptimize = inngest.createFunction(
  {
    id:       "weekly-calendar-reoptimize",
    name:     "Weekly Calendar Re-optimization",
    triggers: [{ cron: "0 4 * * 1" }],
    concurrency: { limit: 3 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    const brandIds: string[] = await step.run("get-brand-ids", async () => {
      const { data } = await supabase.from("brands").select("id")
      return (data ?? []).map((b: { id: string }) => b.id)
    })

    const results = await Promise.all(
      brandIds.map(brandId => step.run(`reoptimize-${brandId}`, () => reoptimizeBrand(brandId)))
    )

    const totals = results.reduce(
      (acc, r) => ({ timing: acc.timing + r.timingChanges, template: acc.template + r.templateChanges }),
      { timing: 0, template: 0 }
    )

    return { success: true, brandsProcessed: brandIds.length, ...totals }
  }
)
