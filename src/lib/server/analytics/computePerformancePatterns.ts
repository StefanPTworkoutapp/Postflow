/**
 * Derives performance_patterns from 90-day rolling post_analytics data.
 * Run weekly (e.g. Sunday night after niche_trends are fetched).
 *
 * For each brand+platform combination:
 *   - Computes average engagement_rate, impressions, reach
 *   - Finds best days of week and hours of day
 *   - Identifies best content pillars and post types
 *   - Extracts top hashtags from high-performing posts
 *
 * Upserts one row per brand+platform into postflow.performance_patterns.
 */

import { createServiceClient } from "@/lib/supabase/service"

interface PostWithAnalytics {
  id:              string
  platform:        string
  content_pillar:  string | null
  post_type:       string | null
  hashtags:        string[]
  posted_at:       string | null
  scheduled_for:   string | null
  analytics: {
    engagement_rate:  number | null
    impressions:      number | null
    reach:            number | null
  } | null
}

function dayOfWeek(dateStr: string | null): number | null {
  if (!dateStr) return null
  return new Date(dateStr).getDay()
}

function hourOfDay(dateStr: string | null): number | null {
  if (!dateStr) return null
  return new Date(dateStr).getHours()
}

/** Returns indices of items sorted by their frequency in the array (descending) */
function topByFrequency(items: string[], topN = 5): string[] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([item]) => item)
}

/** Average numbers in an array, ignoring nulls */
function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null)
  if (!valid.length) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

/**
 * Sort day/hour indices by the average engagement rate of posts on that day/hour.
 * Returns ordered array (best first).
 */
function bestByEngagement(
  items: Array<{ key: number; engagementRate: number }>,
  topN = 4,
): number[] {
  const grouped = new Map<number, number[]>()
  for (const item of items) {
    const arr = grouped.get(item.key) ?? []
    arr.push(item.engagementRate)
    grouped.set(item.key, arr)
  }
  return [...grouped.entries()]
    .map(([key, rates]) => ({ key, avg: rates.reduce((a, b) => a + b, 0) / rates.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, topN)
    .map(e => e.key)
}

export async function computePerformancePatterns(brandId: string): Promise<{
  platformsProcessed: string[]
}> {
  const supabase = createServiceClient()

  const since90 = new Date()
  since90.setDate(since90.getDate() - 90)

  // Load all posted posts with analytics for this brand in the last 90 days
  const { data: calEntries } = await supabase
    .from("content_calendar")
    .select("id, content_pillar, post_type")
    .eq("brand_id", brandId)

  const pillarMap = new Map(
    (calEntries ?? []).map(e => [e.id, { content_pillar: e.content_pillar, post_type: e.post_type }])
  )

  const { data: posts } = await supabase
    .from("posts")
    .select("id, platform, hashtags, posted_at, scheduled_for, calendar_entry_id, post_analytics(engagement_rate, impressions, reach)")
    .eq("brand_id", brandId)
    .eq("status", "posted")
    .gte("posted_at", since90.toISOString())

  if (!posts?.length) return { platformsProcessed: [] }

  // Group by platform
  const byPlatform = new Map<string, typeof posts>()
  for (const post of posts) {
    const arr = byPlatform.get(post.platform) ?? []
    arr.push(post)
    byPlatform.set(post.platform, arr)
  }

  const processedPlatforms: string[] = []

  for (const [platform, platformPosts] of byPlatform) {
    const analytics = platformPosts.map(p => {
      const a = (p.post_analytics as unknown as { engagement_rate?: number; impressions?: number; reach?: number } | null)
      const calEntry = pillarMap.get(p.calendar_entry_id as string)
      return {
        engagementRate:  a?.engagement_rate ?? 0,
        impressions:     a?.impressions     ?? null,
        reach:           a?.reach           ?? null,
        hashtags:        (p.hashtags as string[]) ?? [],
        contentPillar:   calEntry?.content_pillar ?? null,
        postType:        calEntry?.post_type      ?? null,
        day:             dayOfWeek(p.posted_at ?? p.scheduled_for),
        hour:            hourOfDay(p.posted_at ?? p.scheduled_for),
      }
    })

    const topByRate  = analytics.filter(a => a.engagementRate > 0).sort((a, b) => b.engagementRate - a.engagementRate)
    const topHalf    = topByRate.slice(0, Math.max(1, Math.ceil(topByRate.length / 2)))

    // Best days + hours (from all posts with engagement data)
    const engagedDays = analytics
      .filter(a => a.day !== null && a.engagementRate > 0)
      .map(a => ({ key: a.day!, engagementRate: a.engagementRate }))
    const engagedHours = analytics
      .filter(a => a.hour !== null && a.engagementRate > 0)
      .map(a => ({ key: a.hour!, engagementRate: a.engagementRate }))

    // Best content pillars (from top half of posts by engagement)
    const pillars   = topHalf.map(a => a.contentPillar).filter((p): p is string => !!p)
    const postTypes = topHalf.map(a => a.postType).filter((p): p is string => !!p)

    // Top hashtags from high-performing posts
    const allHashtags = topHalf.flatMap(a => a.hashtags)

    const { error } = await supabase
      .from("performance_patterns")
      .upsert({
        brand_id:             brandId,
        platform,
        period_days:          90,
        period_start:         since90.toISOString().split("T")[0],
        period_end:           new Date().toISOString().split("T")[0],
        sample_size:          analytics.length,
        best_days_of_week:    bestByEngagement(engagedDays),
        best_hours_of_day:    bestByEngagement(engagedHours, 6),
        best_content_pillars: topByFrequency(pillars, 4),
        best_post_types:      topByFrequency(postTypes, 4),
        top_hashtags:         topByFrequency(allHashtags, 10),
        avg_engagement_rate:  avg(analytics.map(a => a.engagementRate > 0 ? a.engagementRate : null)),
        avg_impressions:      avg(analytics.map(a => a.impressions)),
        avg_reach:            avg(analytics.map(a => a.reach)),
        computed_at:          new Date().toISOString(),
      }, { onConflict: "brand_id,platform" })

    if (!error) processedPlatforms.push(platform)
    else console.error(`[perf-patterns] upsert error for ${platform}:`, error.message)
  }

  return { platformsProcessed: processedPlatforms }
}
