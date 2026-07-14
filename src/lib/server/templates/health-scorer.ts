/**
 * Template Health Scorer — Part 9 of the feature spec.
 *
 * Computes a health score (0–100) for each template a brand uses, based on
 * post_analytics data compared to niche benchmarks. Format-aware weighting
 * from the format registry is applied (carousel vs reel differ).
 *
 * Interval logic (smart scheduling):
 *   Declining (>10pt drop)  → 3 days
 *   Stable (±5pts)          → 14 days
 *   Rising                  → 21 days
 *   <5 posts                → 7 days  (insufficient data state)
 *
 * Suggestion trigger conditions (all must be true):
 *   health_score < 55
 *   ≥5 posts in last 30 days
 *   Better alternative exists (niche_best > current + 15pts)
 *   Not locked by user
 *   Not suggested in last 14 days
 *   Platform has ≥10 total posts
 *
 * Called from templatePulse Inngest job (every 6h).
 */

import { createServiceClient } from "@/lib/supabase/service"
import { getHealthWeights }    from "@/lib/server/brand/format-registry"
import { allTemplates }        from "@/lib/server/render/templates"

/** slug → render TemplateDefinition, for type/platform compatibility checks. */
const renderRegistry = new Map(allTemplates.map(t => [t.slug, t]))

// ── Types ─────────────────────────────────────────────────────────────────────

interface PostMetrics {
  template_slug:      string
  platform:           string
  engagement_rate:    number | null
  saves:              number | null
  impressions:        number | null
  completion_rate:    number | null
  swipe_through_rate: number | null
  posted_at:          string | null
}

interface NicheBenchmark {
  avg_engagement_rate:             number | null
  avg_save_rate:                   number | null
  avg_completion_rate:             number | null
  avg_carousel_swipe_through_rate: number | null
  avg_carousel_save_rate:          number | null
}

// ── Score computation ─────────────────────────────────────────────────────────

/**
 * Compute a 0–100 health score for a set of posts using a template.
 * The score is relative to the niche benchmark.
 */
function computeHealthScore(
  posts:     PostMetrics[],
  benchmark: NicheBenchmark,
  isCarousel: boolean,
): number {
  if (!posts.length) return 50  // default to neutral when no data

  const avg = (nums: (number | null)[]): number | null => {
    const valid = nums.filter((n): n is number => n !== null && n > 0)
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
  }

  const saveRate = (p: PostMetrics): number | null => {
    if (!p.saves || !p.impressions || p.impressions === 0) return null
    return p.saves / p.impressions
  }

  const engRate  = avg(posts.map(p => p.engagement_rate))
  const savRate  = avg(posts.map(saveRate))

  if (isCarousel) {
    const weights = getHealthWeights("carousel") ?? { swipe_through: 0.45, saves: 0.35, engagement: 0.20 }
    const swipeRate = avg(posts.map(p => p.swipe_through_rate))

    // Each metric is scored 0–100 relative to benchmark (benchmark = 50pts baseline)
    const benchSwipe  = benchmark.avg_carousel_swipe_through_rate ?? 0.30
    const benchSave   = benchmark.avg_carousel_save_rate ?? 0.04
    const benchEngage = benchmark.avg_engagement_rate ?? 0.03

    const swipeScore   = benchSwipe  > 0 && swipeRate  != null ? Math.min(100, (swipeRate  / benchSwipe)  * 50) : 50
    const saveScore    = benchSave   > 0 && savRate    != null ? Math.min(100, (savRate    / benchSave)   * 50) : 50
    const engageScore  = benchEngage > 0 && engRate    != null ? Math.min(100, (engRate    / benchEngage) * 50) : 50

    return Math.round(
      swipeScore  * (weights.swipe_through ?? 0.45) +
      saveScore   * (weights.saves         ?? 0.35) +
      engageScore * (weights.engagement    ?? 0.20)
    )
  } else {
    const weights = getHealthWeights("reel") ?? { completion: 0.50, saves: 0.30, engagement: 0.20 }
    const completRate = avg(posts.map(p => p.completion_rate))

    const benchCompletion = benchmark.avg_completion_rate ?? 0.35
    const benchSave       = benchmark.avg_save_rate ?? 0.03
    const benchEngage     = benchmark.avg_engagement_rate ?? 0.03

    const completionScore = benchCompletion > 0 && completRate != null ? Math.min(100, (completRate / benchCompletion) * 50) : 50
    const saveScore       = benchSave   > 0 && savRate != null ? Math.min(100, (savRate  / benchSave)   * 50) : 50
    const engageScore     = benchEngage > 0 && engRate != null ? Math.min(100, (engRate  / benchEngage) * 50) : 50

    return Math.round(
      completionScore * (weights.completion ?? 0.50) +
      saveScore       * (weights.saves      ?? 0.30) +
      engageScore     * (weights.engagement ?? 0.20)
    )
  }
}

/**
 * Compute trend from previous score → new score.
 */
function computeTrend(
  prevScore:  number,
  newScore:   number,
  postsCount: number,
): string {
  if (postsCount < 5) return "insufficient_data"
  const delta = newScore - prevScore
  if (delta > 10)  return "rising"
  if (delta < -10) return "declining"
  return "stable"
}

/**
 * Compute days until next check based on trend and post count.
 */
function nextCheckDays(trend: string, postsCount: number): number {
  if (postsCount < 5)        return 7
  if (trend === "declining")  return 3
  if (trend === "rising")     return 21
  return 14  // stable
}

// ── Main scorer ───────────────────────────────────────────────────────────────

/**
 * Score all templates for a brand and upsert into template_health.
 * Returns summary of templates scored.
 */
export async function scoreTemplatesForBrand(brandId: string): Promise<{
  templatesScored: number
  suggestionsCreated: number
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  // ── 1. Get brand niche ────────────────────────────────────────────────────
  const { data: brand } = await supabase
    .from("brands")
    .select("niche, industry")
    .eq("id", brandId)
    .maybeSingle()

  const nicheTag = brand?.niche ?? brand?.industry ?? "general"

  // ── 2. Get posts with analytics (last 90 days) ───────────────────────────
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from("posts")
    .select(`
      id, platform, template_slug, posted_at,
      post_analytics(engagement_rate, saves, impressions, completion_rate, swipe_through_rate)
    `)
    .eq("brand_id", brandId)
    .eq("status", "posted")
    .gte("posted_at", since90)
    .not("template_slug", "is", null)

  if (!posts?.length) return { templatesScored: 0, suggestionsCreated: 0 }

  // ── 3. Group by platform + template_slug ─────────────────────────────────
  const groups = new Map<string, PostMetrics[]>()
  for (const post of posts) {
    if (!post.template_slug) continue
    const key = `${post.platform}::${post.template_slug}`
    const a = (post.post_analytics as Record<string, number | null> | null) ?? {}
    const item: PostMetrics = {
      template_slug:      post.template_slug,
      platform:           post.platform,
      engagement_rate:    a.engagement_rate  ?? null,
      saves:              a.saves            ?? null,
      impressions:        a.impressions      ?? null,
      completion_rate:    a.completion_rate  ?? null,
      swipe_through_rate: a.swipe_through_rate ?? null,
      posted_at:          post.posted_at,
    }
    const arr = groups.get(key) ?? []
    arr.push(item)
    groups.set(key, arr)
  }

  let templatesScored     = 0
  let suggestionsCreated  = 0

  for (const [key, templatePosts] of groups) {
    const [platform, templateSlug] = key.split("::")
    const isCarousel = templateSlug.startsWith("carousel-")

    // ── 4. Get niche benchmark ─────────────────────────────────────────────
    const { data: benchmark } = await supabase
      .from("niche_benchmarks")
      .select("avg_engagement_rate, avg_save_rate, avg_completion_rate, avg_carousel_swipe_through_rate, avg_carousel_save_rate")
      .eq("niche_tag", nicheTag)
      .eq("platform", platform)
      .maybeSingle()

    const bench: NicheBenchmark = benchmark ?? {
      avg_engagement_rate:             0.03,
      avg_save_rate:                   0.03,
      avg_completion_rate:             0.35,
      avg_carousel_swipe_through_rate: 0.30,
      avg_carousel_save_rate:          0.04,
    }

    // ── 5. Compute new score ───────────────────────────────────────────────
    const newScore = computeHealthScore(templatePosts, bench, isCarousel)

    // ── 6. Get previous score for trend ───────────────────────────────────
    const { data: existing } = await supabase
      .from("template_health")
      .select("health_score, trend, locked_by_user")
      .eq("brand_id", brandId)
      .eq("platform", platform)
      .eq("template_slug", templateSlug)
      .maybeSingle()

    const prevScore   = existing?.health_score ?? 50
    const isLocked    = existing?.locked_by_user ?? false
    const trend       = computeTrend(prevScore, newScore, templatePosts.length)
    const nextCheckAt = new Date(Date.now() + nextCheckDays(trend, templatePosts.length) * 24 * 60 * 60 * 1000)

    // Compute averages for storage
    const avgOf = (nums: (number | null)[]): number | null => {
      const valid = nums.filter((n): n is number => n !== null && n > 0)
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
    }
    const savRate = avgOf(templatePosts.map(p =>
      p.saves && p.impressions && p.impressions > 0 ? p.saves / p.impressions : null
    ))

    // ── 7. Upsert template_health ──────────────────────────────────────────
    await supabase
      .from("template_health")
      .upsert({
        brand_id:            brandId,
        platform,
        template_slug:       templateSlug,
        health_score:        newScore,
        posts_count:         templatePosts.length,
        avg_completion_rate: avgOf(templatePosts.map(p => p.completion_rate)),
        avg_save_rate:       savRate,
        avg_engagement_rate: avgOf(templatePosts.map(p => p.engagement_rate)),
        trend,
        last_checked_at:     new Date().toISOString(),
        next_check_at:       nextCheckAt.toISOString(),
      }, { onConflict: "brand_id,platform,template_slug" })

    templatesScored++

    // ── 8. Generate suggestion if criteria met ────────────────────────────
    if (
      !isLocked &&
      newScore < 55 &&
      templatePosts.length >= 5
    ) {
      // Check total platform posts ≥10
      const { count: totalCount } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId)
        .eq("platform", platform)
        .eq("status", "posted")

      if ((totalCount ?? 0) >= 10) {
        // Check not already suggested in last 14 days
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        const { count: recentSuggestions } = await supabase
          .from("template_suggestions")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brandId)
          .eq("current_slug", templateSlug)
          .eq("platform", platform)
          .eq("status", "pending")
          .gte("created_at", fourteenDaysAgo)

        // Check not dismissed twice
        const { data: dismissedSugg } = await supabase
          .from("template_suggestions")
          .select("dismissed_count")
          .eq("brand_id", brandId)
          .eq("current_slug", templateSlug)
          .eq("platform", platform)
          .eq("status", "dismissed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        const timesDismmissed = dismissedSugg?.dismissed_count ?? 0

        if ((recentSuggestions ?? 0) === 0 && timesDismmissed < 2) {
          // Find the best alternative template for this platform. A suggestion
          // must stay within the same render type — template_health is keyed by
          // (brand, platform, slug) only, so without this filter a single_image
          // template could be "replaced" by a higher-scoring carousel-only one,
          // and since suggestions now auto-apply on approval (P1), that would
          // put a wrong-type slug into the brand's slot rotation.
          const { data: alternativeRows } = await supabase
            .from("template_health")
            .select("template_slug, health_score")
            .eq("brand_id", brandId)
            .eq("platform", platform)
            .neq("template_slug", templateSlug)
            .gt("health_score", newScore + 15)
            .order("health_score", { ascending: false })
            .limit(10)

          const currentDef = renderRegistry.get(templateSlug)
          const bestAlternative = (alternativeRows ?? []).find((row: { template_slug: string; health_score: number }) => {
            const altDef = renderRegistry.get(row.template_slug)
            if (!altDef || !currentDef || altDef.type !== currentDef.type) return false
            return altDef.platforms === null || altDef.platforms.includes(platform)
          }) ?? null

          if (bestAlternative) {
            const reason = trend === "declining"
              ? `This template's performance has been declining. ${bestAlternative.template_slug} is performing ${bestAlternative.health_score - newScore} points better.`
              : `This template is underperforming. ${bestAlternative.template_slug} is performing significantly better for your niche.`

            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

            await supabase
              .from("template_suggestions")
              .insert({
                brand_id:        brandId,
                current_slug:    templateSlug,
                suggested_slug:  bestAlternative.template_slug,
                platform,
                reason,
                current_score:   newScore,
                suggested_score: bestAlternative.health_score,
                expires_at:      expiresAt.toISOString(),
              })

            suggestionsCreated++
          }
        }
      }
    }
  }

  return { templatesScored, suggestionsCreated }
}
