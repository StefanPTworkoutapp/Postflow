/**
 * Optimal scheduling time suggestions
 *
 * Reads `performance_patterns` for a brand+platform to suggest the best
 * day-of-week + hour to publish. Falls back to industry benchmarks when
 * there isn't enough data.
 *
 * Minimum sample size: 5 posts.
 * Fallback: Tuesday at 09:00 (widely cited B2C benchmark for social media).
 */

import { createClient } from "@/lib/supabase/server"

export interface OptimalTime {
  dayOfWeek:   number   // 0 = Sunday … 6 = Saturday
  hour:        number   // 0–23 (local brand timezone; we store UTC, display as-is)
  confidence:  "data" | "fallback"
  platform:    string
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** Formats an OptimalTime into a human-readable label, e.g. "Tuesday at 09:00" */
export function formatOptimalTime(ot: OptimalTime): string {
  const dayName = DAY_NAMES[ot.dayOfWeek] ?? "Tuesday"
  const hour    = ot.hour.toString().padStart(2, "0")
  return `${dayName} at ${hour}:00`
}

/**
 * Returns the ISO-8601 datetime string for the next occurrence of the optimal
 * day+hour, starting from `now` (defaults to current time).
 *
 * Example: if today is Wednesday 14:00 and optimal is Tuesday 09:00, returns
 * the following Tuesday at 09:00.
 */
export function nextOccurrence(ot: OptimalTime, now = new Date()): string {
  const result = new Date(now)
  // Zero out minutes/seconds for a clean datetime input value
  result.setMinutes(0, 0, 0)

  // Find the next matching day
  const currentDay = result.getDay()
  const targetDay  = ot.dayOfWeek
  let daysAhead    = (targetDay - currentDay + 7) % 7

  // If today is the right day but the hour has passed, go to next week
  if (daysAhead === 0 && now.getHours() >= ot.hour) {
    daysAhead = 7
  }

  result.setDate(result.getDate() + daysAhead)
  result.setHours(ot.hour, 0, 0, 0)

  return result.toISOString()
}

/** Next occurrence as a YYYY-MM-DD string (for the date input in PostEditor) */
export function nextOccurrenceDate(ot: OptimalTime, now = new Date()): string {
  return nextOccurrence(ot, now).split("T")[0]
}

const FALLBACK: Omit<OptimalTime, "platform"> = {
  dayOfWeek:  2,       // Tuesday
  hour:       9,
  confidence: "fallback",
}

/**
 * Fetch the optimal posting time for a brand + platform combination.
 *
 * Returns null if:
 *   - performance_patterns row doesn't exist for this brand+platform
 *   - sample_size < 5 (not enough data) AND fallback is also null
 *
 * Always returns at least the fallback (Tuesday 09:00) when there's insufficient
 * data — callers can check `confidence === "fallback"` to show an asterisk.
 */
export async function getOptimalScheduleTime(
  brandId:  string,
  platform: string,
): Promise<OptimalTime> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("performance_patterns")
      .select("best_days_of_week, best_hours_of_day, sample_size")
      .eq("brand_id", brandId)
      .eq("platform", platform)
      .single()

    if (error || !data || (data.sample_size ?? 0) < 5) {
      return { ...FALLBACK, platform }
    }

    const days  = (data.best_days_of_week  as number[] | null) ?? []
    const hours = (data.best_hours_of_day  as number[] | null) ?? []

    if (!days.length || !hours.length) {
      return { ...FALLBACK, platform }
    }

    return {
      dayOfWeek:  days[0],
      hour:       hours[0],
      confidence: "data",
      platform,
    }
  } catch {
    return { ...FALLBACK, platform }
  }
}
