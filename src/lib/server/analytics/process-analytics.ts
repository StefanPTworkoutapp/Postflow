/**
 * processPostAnalytics — Guarantee 2 of the analytics reliability system.
 *
 * Called once per post whenever fresh analytics arrive (from dailyAnalyticsFetch).
 * Derives brand intelligence token signals from the post's performance vs the
 * brand's own baseline, then applies them via nudgeToken().
 *
 * Writes a verification row to postflow.analytics_processed so the /admin
 * dashboard can confirm tokens are actually learning.
 *
 * Design principle: analytics is a weak, continuous signal (confidenceDelta 0.03–0.05).
 * It reinforces the brand's current style when performance is above baseline —
 * it never overrides manual calibration. Underperforming posts do not apply
 * a negative signal (too much noise; use feedback for explicit negative signals).
 *
 * Benchmark source: brand's own performance_patterns (rolling 90-day avg).
 * When Phase TH ships, this can be upgraded to use niche_benchmarks.
 */

import { createServiceClient } from "@/lib/supabase/service"
import { nudgeToken } from "@/lib/server/brand/nudge-token"
import { detectFormat } from "@/lib/server/brand/format-registry"

/**
 * Type-bypass helper for tables not yet in the generated database.types.ts.
 * Remove once migration 20260511000001 runs and types are regenerated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newTables = (client: ReturnType<typeof createServiceClient>) => client as any

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostAnalyticsInput {
  postId:           string
  platform:         string
  templateSlug?:    string | null
  /** Raw analytics metrics — all values optional; omit = unknown */
  metrics: {
    impressions?:        number | null
    reach?:              number | null
    likes?:              number | null
    comments?:           number | null
    shares?:             number | null
    saves?:              number | null
    clicks?:             number | null
    engagement_rate?:    number | null
    click_through_rate?: number | null
    /** Reels/TikTok only */
    completion_rate?:    number | null
    /** Carousel only — swipes / impressions */
    swipe_through_rate?: number | null
  }
}

interface BrandBaseline {
  avg_engagement_rate: number | null
  avg_impressions:     number | null
}

// Threshold: outperform by ≥ 10% to trigger reinforcement signal
const OUTPERFORM_THRESHOLD = 1.10

// Analytics signal deltas — weaker than feedback (0.15) and calibration (0.20)
const DELTA_PRIMARY   = 0.04   // primary metric outperformance
const DELTA_SECONDARY = 0.03   // secondary metric outperformance

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute save rate (saves per impression) from raw metrics */
function saveRate(metrics: PostAnalyticsInput["metrics"]): number | null {
  if (!metrics.saves || !metrics.impressions || metrics.impressions === 0) return null
  return metrics.saves / metrics.impressions
}

/**
 * Derive a plain engagement rate if not provided:
 * (likes + comments + shares + saves) / impressions
 */
function computeEngagementRate(metrics: PostAnalyticsInput["metrics"]): number | null {
  if (metrics.engagement_rate != null) return metrics.engagement_rate
  const { likes = 0, comments = 0, shares = 0, saves = 0, impressions } = metrics
  if (!impressions || impressions === 0) return null
  return ((likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0)) / impressions
}

/**
 * Derive token signals for a reel-format post.
 * Returns a list of (tokenKey, delta) pairs — all reinforcement (positive delta).
 */
function deriveReelSignals(
  metrics: PostAnalyticsInput["metrics"],
  baseline: BrandBaseline,
  currentTokens: Record<string, { value: string | number | string[] }>,
): Array<{ tokenKey: string; newValue: string | number | string[]; delta: number }> {
  const signals: Array<{ tokenKey: string; newValue: string | number | string[]; delta: number }> = []
  const engRate = computeEngagementRate(metrics)

  // Primary: completion rate (reels)
  // No benchmark for completion_rate yet — treat any value > 30% as good
  if (metrics.completion_rate != null && metrics.completion_rate >= 0.30) {
    for (const key of ["hook_style", "pacing", "music_energy"] as const) {
      const current = currentTokens[key]?.value
      if (current != null) signals.push({ tokenKey: key, newValue: current, delta: DELTA_PRIMARY })
    }
  }

  // Secondary: engagement outperformance
  if (
    engRate != null &&
    baseline.avg_engagement_rate != null &&
    engRate >= baseline.avg_engagement_rate * OUTPERFORM_THRESHOLD
  ) {
    for (const key of ["caption_tone", "hashtag_strategy"] as const) {
      const current = currentTokens[key]?.value
      if (current != null) signals.push({ tokenKey: key, newValue: current, delta: DELTA_SECONDARY })
    }
    // Also reinforce hook since overall engagement was high
    const hookCurrent = currentTokens["hook_style"]?.value
    if (hookCurrent != null) signals.push({ tokenKey: "hook_style", newValue: hookCurrent, delta: DELTA_SECONDARY })
  }

  return signals
}

/**
 * Derive token signals for a carousel-format post.
 */
function deriveCarouselSignals(
  metrics: PostAnalyticsInput["metrics"],
  baseline: BrandBaseline,
  currentTokens: Record<string, { value: string | number | string[] }>,
): Array<{ tokenKey: string; newValue: string | number | string[]; delta: number }> {
  const signals: Array<{ tokenKey: string; newValue: string | number | string[]; delta: number }> = []
  const engRate = computeEngagementRate(metrics)
  const sr      = saveRate(metrics)

  // Primary: swipe-through rate — any value ≥ 0.40 is strong (industry avg ~0.25–0.35)
  if (metrics.swipe_through_rate != null && metrics.swipe_through_rate >= 0.40) {
    for (const key of ["carousel_hook_style", "carousel_slide_count", "carousel_slide_pacing"] as const) {
      const current = currentTokens[key]?.value
      if (current != null) signals.push({ tokenKey: key, newValue: current, delta: DELTA_PRIMARY })
    }
  }

  // Secondary: save rate — high saves = content worth keeping → validate content mix & goal
  if (sr != null && sr >= 0.05) {  // ≥5% save rate is above average for carousels
    for (const key of ["carousel_content_mix", "carousel_best_goal", "carousel_text_overlay_density"] as const) {
      const current = currentTokens[key]?.value
      if (current != null) signals.push({ tokenKey: key, newValue: current, delta: DELTA_SECONDARY })
    }
  }

  // Secondary: engagement outperformance
  if (
    engRate != null &&
    baseline.avg_engagement_rate != null &&
    engRate >= baseline.avg_engagement_rate * OUTPERFORM_THRESHOLD
  ) {
    for (const key of ["carousel_content_mix", "carousel_vs_reel_preference"] as const) {
      const current = currentTokens[key]?.value
      if (current != null) signals.push({ tokenKey: key, newValue: current, delta: DELTA_SECONDARY })
    }
  }

  return signals
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function processPostAnalytics(
  post:    PostAnalyticsInput,
  brandId: string,
): Promise<{ signalsApplied: number }> {
  const supabase = createServiceClient()

  // ── 1. Get baseline from brand's own performance_patterns ────────────────
  const { data: patterns } = await supabase
    .from("performance_patterns")
    .select("avg_engagement_rate, avg_impressions")
    .eq("brand_id", brandId)
    .eq("platform", post.platform)
    .maybeSingle()

  const baseline: BrandBaseline = {
    avg_engagement_rate: (patterns as { avg_engagement_rate?: number | null } | null)?.avg_engagement_rate ?? null,
    avg_impressions:     (patterns as { avg_impressions?: number | null } | null)?.avg_impressions ?? null,
  }

  // ── 2. Read current brand tokens (to pass current values as newValue) ────
  const { data: brand } = await supabase
    .from("brands")
    .select("intelligence_tokens")
    .eq("id", brandId)
    .maybeSingle()

  const currentTokens = (brand?.intelligence_tokens as Record<string, { value: string | number | string[] }> | null) ?? {}

  // ── 3. Detect format + derive signals ───────────────────────────────────
  const format = detectFormat(post.templateSlug)

  let signals: Array<{
    tokenKey:    string
    newValue:    string | number | string[]
    delta:       number
    allowCreate?: boolean
  }> = []

  if (format === "carousel") {
    signals = deriveCarouselSignals(post.metrics, baseline, currentTokens)
  } else if (format === "reel" || format === null) {
    // Treat unknown format as reel (single-image feed posts use reel tokens)
    signals = deriveReelSignals(post.metrics, baseline, currentTokens)
  }
  // Other formats (story, linkedin_post, tiktok_video) have empty token sets for now
  // — still write the analytics_processed row so we can see they were processed

  // ── CTR signal — platform-agnostic (LinkedIn, TikTok, any platform with clicks) ──
  // A high click-through rate means the caption's CTA motivated action.
  // Threshold: 5% CTR (LinkedIn avg is ~1–3%; 5%+ is strong; 8%+ is excellent).
  // Reinforce caption_tone (the copy drove the click) and best_post_goal (goal alignment worked).
  // Also seed/reinforce a "best_cta_style" token from the current token value if it exists.
  const CTR_THRESHOLD_GOOD      = 0.05   // 5% CTR = good
  const CTR_THRESHOLD_EXCELLENT = 0.08   // 8% CTR = excellent
  if (
    post.metrics.click_through_rate != null &&
    post.metrics.click_through_rate >= CTR_THRESHOLD_GOOD
  ) {
    const ctrDelta = post.metrics.click_through_rate >= CTR_THRESHOLD_EXCELLENT
      ? DELTA_PRIMARY
      : DELTA_SECONDARY

    for (const key of ["caption_tone", "hashtag_strategy"] as const) {
      const current = currentTokens[key]?.value
      if (current != null) {
        signals.push({ tokenKey: key, newValue: current, delta: ctrDelta })
      }
    }
    // Also reinforce best_post_goal — high CTR means goal alignment was correct
    const goalCurrent = currentTokens["best_post_goal"]?.value
    if (goalCurrent != null) {
      signals.push({ tokenKey: "best_post_goal", newValue: goalCurrent, delta: ctrDelta })
    }
  }

  // ── 4. Apply signals via nudgeToken ────────────────────────────────────
  let signalsApplied = 0
  for (const signal of signals) {
    try {
      await nudgeToken(
        brandId,
        signal.tokenKey,
        signal.newValue,
        signal.delta,
        "analytics",
        post.postId,
        {
          platform:   post.platform,
          format:     format ?? "unknown",
          metrics: {
            engagement_rate:    computeEngagementRate(post.metrics),
            completion_rate:    post.metrics.completion_rate,
            swipe_through_rate: post.metrics.swipe_through_rate,
            click_through_rate: post.metrics.click_through_rate,
            saves:              post.metrics.saves,
            impressions:        post.metrics.impressions,
          },
          baseline_engagement: baseline.avg_engagement_rate,
        },
        signal.allowCreate,
      )
      signalsApplied++
    } catch (err) {
      console.error(`[process-analytics] nudgeToken failed for ${signal.tokenKey}:`, err)
      // Don't stop — apply as many signals as possible
    }
  }

  // ── 5. Write analytics_processed verification row ───────────────────────
  await newTables(supabase).from("analytics_processed").insert({
    brand_id:        brandId,
    post_id:         post.postId,
    platform:        post.platform,
    signals_applied: signalsApplied,
  })

  return { signalsApplied }
}
