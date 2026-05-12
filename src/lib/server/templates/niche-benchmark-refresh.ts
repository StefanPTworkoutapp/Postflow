/**
 * Niche Benchmark Refresh — computes anonymised cross-brand performance
 * aggregates per niche+platform and upserts them into niche_benchmarks.
 *
 * Aggregates post_analytics across all brands in the same niche,
 * anonymising brand-level data so individual brands are not exposed.
 *
 * Called from nicheBenchmarkRefresh Inngest job (weekly).
 */

import { createServiceClient } from "@/lib/supabase/service"

export async function refreshNicheBenchmarks(): Promise<{
  nichesRefreshed: number
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  // ── 1. Collect all distinct niches across brands ──────────────────────────
  const { data: brands } = await supabase
    .from("brands")
    .select("id, niche, industry")

  if (!brands?.length) return { nichesRefreshed: 0 }

  // Map brand_id → niche_tag
  const brandNiche = new Map<string, string>(
    (brands as { id: string; niche: string | null; industry: string | null }[])
      .map(b => [b.id, b.niche ?? b.industry ?? "general"])
  )

  // ── 2. Load post analytics (last 90 days, all brands) ────────────────────
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from("posts")
    .select(`
      brand_id, platform, template_slug,
      post_analytics(engagement_rate, saves, impressions, completion_rate, swipe_through_rate)
    `)
    .eq("status", "posted")
    .gte("posted_at", since90)

  if (!posts?.length) return { nichesRefreshed: 0 }

  // ── 3. Aggregate by niche + platform ────────────────────────────────────
  type Metrics = {
    engagement_rates:    number[]
    save_rates:          number[]
    completion_rates:    number[]
    swipe_through_rates: number[]
    carousel_save_rates: number[]
    template_score_map:  Map<string, number[]>  // slug → engagement_rates
  }

  const groups = new Map<string, Metrics>()

  for (const post of posts) {
    const niche = brandNiche.get(post.brand_id) ?? "general"
    const key   = `${niche}::${post.platform}`
    const a     = (post.post_analytics as Record<string, number | null> | null) ?? {}

    if (!groups.has(key)) {
      groups.set(key, {
        engagement_rates:    [],
        save_rates:          [],
        completion_rates:    [],
        swipe_through_rates: [],
        carousel_save_rates: [],
        template_score_map:  new Map(),
      })
    }

    const g = groups.get(key)!
    const impressions = a.impressions ?? 0

    if (a.engagement_rate != null && a.engagement_rate > 0) g.engagement_rates.push(a.engagement_rate)
    if (a.saves && impressions > 0) {
      const sr = (a.saves as number) / impressions
      if (post.template_slug?.startsWith("carousel-")) {
        g.carousel_save_rates.push(sr)
      } else {
        g.save_rates.push(sr)
      }
    }
    if (a.completion_rate != null && a.completion_rate > 0) g.completion_rates.push(a.completion_rate)
    if (a.swipe_through_rate != null && a.swipe_through_rate > 0) g.swipe_through_rates.push(a.swipe_through_rate)

    // Track template performance for top_template_slugs
    if (post.template_slug && a.engagement_rate != null && a.engagement_rate > 0) {
      const scores = g.template_score_map.get(post.template_slug) ?? []
      scores.push(a.engagement_rate)
      g.template_score_map.set(post.template_slug, scores)
    }
  }

  const avg = (nums: number[]): number | null =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null

  let nichesRefreshed = 0

  for (const [key, metrics] of groups) {
    const [nicheTag, platform] = key.split("::")

    // Top templates by average engagement
    const topSlugs = [...metrics.template_score_map.entries()]
      .map(([slug, rates]) => ({ slug, avg: rates.reduce((a, b) => a + b, 0) / rates.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map(t => t.slug)

    const sampleSize = metrics.engagement_rates.length

    await supabase
      .from("niche_benchmarks")
      .upsert({
        niche_tag:                       nicheTag,
        platform,
        avg_engagement_rate:             avg(metrics.engagement_rates),
        avg_save_rate:                   avg(metrics.save_rates),
        avg_completion_rate:             avg(metrics.completion_rates),
        avg_carousel_swipe_through_rate: avg(metrics.swipe_through_rates),
        avg_carousel_save_rate:          avg(metrics.carousel_save_rates),
        top_template_slugs:              topSlugs,
        sample_size:                     sampleSize,
        calculated_at:                   new Date().toISOString(),
      }, { onConflict: "niche_tag,platform" })

    nichesRefreshed++
  }

  return { nichesRefreshed }
}
