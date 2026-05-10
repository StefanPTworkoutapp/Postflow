/**
 * bestTemplate — Performance-based template selection.
 *
 * Queries the last 90 days of posts + analytics for a brand+platform,
 * groups by template_slug, and returns the slug with the highest average
 * engagement rate. Falls back to null if there's not enough data (< 3 posts
 * per template) so callers can use their own default.
 *
 * Used by:
 *   - render route (auto-select template when post has none saved)
 *   - calendar generation (inform Claude which formats perform best)
 */

import { createServiceClient } from "@/lib/supabase/service"

export interface TemplatePerformance {
  templateSlug:       string
  avgEngagementRate:  number
  postCount:          number
}

const MIN_POSTS_TO_TRUST = 3
const LOOKBACK_DAYS      = 90

/**
 * Returns an ordered list of templates by avg engagement rate for this
 * brand + platform over the last 90 days. Best performer is first.
 * Returns [] if there's no data yet.
 */
export async function getTemplatePerformance(
  brandId:  string,
  platform: string,
): Promise<TemplatePerformance[]> {
  const supabase = createServiceClient()
  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)

  // Join posts → post_analytics, filter by brand + platform + date
  const { data, error } = await supabase
    .from("posts")
    .select(`
      template_slug,
      post_analytics ( engagement_rate )
    `)
    .eq("brand_id", brandId)
    .eq("platform", platform)
    .eq("status", "posted")
    .not("template_slug", "is", null)
    .gte("posted_at", since.toISOString())

  if (error || !data?.length) return []

  // Aggregate by template_slug
  const byTemplate = new Map<string, number[]>()
  for (const post of data) {
    const slug = post.template_slug
    if (!slug) continue
    const analytics = post.post_analytics as Array<{ engagement_rate: number | null }> | null
    const rate = analytics?.[0]?.engagement_rate ?? null
    if (rate === null) continue
    const arr = byTemplate.get(slug) ?? []
    arr.push(rate)
    byTemplate.set(slug, arr)
  }

  return [...byTemplate.entries()]
    .filter(([, rates]) => rates.length >= MIN_POSTS_TO_TRUST)
    .map(([slug, rates]) => ({
      templateSlug:      slug,
      avgEngagementRate: rates.reduce((a, b) => a + b, 0) / rates.length,
      postCount:         rates.length,
    }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
}

/**
 * Returns the single best template slug for this brand + platform,
 * or null if there's not enough data to be confident.
 */
export async function getBestTemplate(
  brandId:  string,
  platform: string,
): Promise<string | null> {
  const results = await getTemplatePerformance(brandId, platform)
  return results[0]?.templateSlug ?? null
}
