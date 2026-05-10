/**
 * getBrandContext — the single source of truth for brand context in every Claude call.
 *
 * Returns both:
 *   - Structured typed fields (for generateCaption which takes typed params)
 *   - promptBlock string (for calendar/generate, convert-format, regenerate)
 *
 * Rules:
 * - Always fetch live — never cache between renders.
 * - Every Claude API call uses this. No manual brand assembly anywhere.
 * - Includes intelligence_tokens so AI output improves as tokens gain confidence.
 */

import { createServiceClient } from "@/lib/supabase/service"
import type { ToneProfile } from "@/lib/server/ai/extractToneProfile"
import type { PerformanceContext, TrendContext } from "@/lib/server/posts/generateCaption"

export interface BrandContext {
  // ── Structured fields for generateCaption() ──────────────────
  brand_id:        string
  brand_name:      string
  industry:        string
  niche:           string | null
  audience:        string | null
  goals:           string[] | null
  tone_profile:    ToneProfile | null
  /**
   * Short human-readable summary derived from tone_profile fields.
   * Use this in simple prompts that need one line of tone context.
   * generateCaption() gets the full tone_profile object directly.
   */
  tone_summary:    string | null
  do_not_mention:  string[] | null
  emoji_policy:    "never" | "sparingly" | "often"
  emoji_favorites: string | null
  /** Platform-specific performance context — only populated when platform is passed */
  performance:     PerformanceContext | null
  /** This week's niche trends */
  trends:          TrendContext[]
  /** Raw intelligence tokens for callers that need direct access */
  intelligence_tokens: Record<string, { value: unknown; confidence: number }>

  // ── Pre-formatted prompt block for simple prompt injection ────
  /** Drop this string directly into any Claude prompt. Always fetch live. */
  promptBlock: string
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function pct(confidence: number) {
  return `${Math.round(confidence * 100)}%`
}

/** Derives a short tone description string from a ToneProfile object. */
function buildToneSummary(tp: ToneProfile): string {
  const parts: string[] = []
  if (tp.personality_traits.length) parts.push(tp.personality_traits.join(", "))
  if (tp.tone_level)                parts.push(`tone level ${tp.tone_level}/10`)
  if (tp.expertise_level)           parts.push(tp.expertise_level)
  if (tp.writing_style?.sentence_length) parts.push(`${tp.writing_style.sentence_length} sentences`)
  if (tp.cta_style)                 parts.push(`CTA: ${tp.cta_style}`)
  return parts.join(" · ")
}

function buildPromptBlock(opts: {
  brand:       Record<string, unknown>
  tokens:      Record<string, { value: unknown; confidence: number }>
  patterns:    Array<Record<string, unknown>>
  trends:      TrendContext[]
  toneSummary: string | null
  platform?:   string
}): string {
  const { brand, tokens, patterns, trends, toneSummary, platform } = opts
  const b = brand as {
    name: string; industry?: string; niche?: string; primary_goal?: string
    goals?: string[]; do_not_mention?: string[]
    target_audience_description?: string
  }

  const GOAL_LABELS: Record<string, string> = {
    lead_generation: "Get more clients",
    brand_awareness: "Build brand awareness",
    engagement:      "Educate / engage the audience",
    showcase:        "Showcase work / results",
    sales:           "Drive sales",
  }

  const goals = b.goals?.length
    ? b.goals
    : b.primary_goal ? [b.primary_goal] : []

  const goalsLine = goals.length
    ? `Goals (priority order): ${goals.map((g, i) => `${i === 0 ? "★" : `${i + 1}.`} ${GOAL_LABELS[g] ?? g}`).join(" | ")}`
    : ""

  // ── Performance block ─────────────────────────────────────────
  const relevantPatterns = platform
    ? patterns.filter(p => p.platform === platform)
    : patterns
  const filteredPatterns = relevantPatterns.filter(p => (p.sample_size as number) >= 5)

  const perfLines = filteredPatterns.map(p => {
    const pp = p as {
      platform: string; best_post_types?: string[]; best_content_pillars?: string[]
      best_days_of_week?: number[]; best_hours_of_day?: number[]
      avg_engagement_rate?: number; top_hashtags?: string[]
    }
    const parts = [`${pp.platform}:`]
    if (pp.best_post_types?.length)      parts.push(`formats=${pp.best_post_types.join(",")}`)
    if (pp.best_content_pillars?.length) parts.push(`pillars=${pp.best_content_pillars.join(",")}`)
    if (pp.best_days_of_week?.length)    parts.push(`best days=${pp.best_days_of_week.map(d => DAY_NAMES[d]).join(",")}`)
    if (pp.best_hours_of_day?.length)    parts.push(`best hours=${pp.best_hours_of_day.map(h => `${h}:00`).join(",")}`)
    if (pp.avg_engagement_rate)          parts.push(`avg engagement=${(pp.avg_engagement_rate * 100).toFixed(1)}%`)
    if (pp.top_hashtags?.length)         parts.push(`top hashtags=${pp.top_hashtags.slice(0, 5).join(",")}`)
    return `  ${parts.join(" | ")}`
  })
  const performanceBlock = perfLines.length
    ? `\nPERFORMANCE DATA (90-day real results — weight heavily):\n${perfLines.join("\n")}`
    : ""

  // ── Trends block ──────────────────────────────────────────────
  const trendBlock = trends.length
    ? `\nTRENDING IN YOUR NICHE THIS WEEK (use if relevant):\n${trends.slice(0, 5).map(t => `  - ${t.topic}${t.headline ? ` ("${t.headline}")` : ""}`).join("\n")}`
    : ""

  // ── Intelligence tokens block ─────────────────────────────────
  const videoTokenKeys = [
    "hook_style", "pacing", "caption_tone", "text_overlay_style",
    "music_energy", "best_post_goal", "best_content_duration_seconds",
    "hashtag_strategy",
  ]
  const carouselTokenKeys = [
    "carousel_slide_count", "carousel_content_mix", "carousel_text_overlay_density",
    "carousel_hook_style", "carousel_slide_pacing", "carousel_best_goal",
    "carousel_vs_reel_preference",
  ]

  const videoTokenLines = videoTokenKeys
    .map(k => tokens[k])
    .filter(t => t && t.confidence > 0)
    .map((t, i) => `  ${videoTokenKeys[i]}: ${t.value} (${pct(t.confidence)} confidence)`)
    .filter(Boolean)

  const carouselTokenLines = carouselTokenKeys
    .map(k => tokens[k])
    .filter(t => t && t.confidence > 0)
    .map((t, i) => `  ${carouselTokenKeys[i]}: ${t.value} (${pct(t.confidence)} confidence)`)
    .filter(Boolean)

  const tokenBlock = [
    videoTokenLines.length   ? `\nBRAND INTELLIGENCE — VIDEO/REEL:\n${videoTokenLines.join("\n")}` : "",
    carouselTokenLines.length ? `\nBRAND INTELLIGENCE — CAROUSEL:\n${carouselTokenLines.join("\n")}\n  (Where confidence < 60%, fall back to niche benchmark defaults.)` : "",
  ].filter(Boolean).join("\n")

  return [
    `BRAND: ${b.name}`,
    b.industry   ? `Industry: ${b.industry}` : "",
    b.niche      ? `Niche: ${b.niche}` : "",
    b.target_audience_description ? `Audience: ${b.target_audience_description}` : "",
    goalsLine,
    toneSummary ? `Tone: ${toneSummary}` : "",
    b.do_not_mention?.length ? `Never mention: ${b.do_not_mention.join(", ")}` : "",
    performanceBlock,
    trendBlock,
    tokenBlock,
  ].filter(Boolean).join("\n")
}

/**
 * Fetch full brand context for a given brandId.
 *
 * @param brandId  - brands.id UUID
 * @param platform - optional: if provided, performance context is filtered to this platform
 */
export async function getBrandContext(
  brandId:   string,
  platform?: string
): Promise<BrandContext | null> {
  const supabase = createServiceClient()

  // 1. Fetch brand
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single()

  if (brandError || !brand) {
    console.error(`getBrandContext: brand ${brandId} not found:`, brandError?.message)
    return null
  }

  const b = brand as unknown as Record<string, unknown> & {
    id: string; name: string; industry?: string; niche?: string
    primary_goal?: string; goals?: string[]
    tone_profile?: ToneProfile | null
    do_not_mention?: string[]
    target_audience_description?: string
    emoji_policy?: string; emoji_favorites?: string
    intelligence_tokens?: Record<string, { value: unknown; confidence: number }>
  }

  const tokens = (b.intelligence_tokens ?? {}) as Record<string, { value: unknown; confidence: number }>

  // 2. Fetch performance patterns (all platforms, filter later)
  const weekStart = (() => {
    const d   = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().split("T")[0]
  })()

  const [patternsResult, trendsResult] = await Promise.allSettled([
    supabase
      .from("performance_patterns")
      .select("platform,avg_engagement_rate,best_days_of_week,best_hours_of_day,best_content_pillars,best_post_types,top_hashtags,sample_size")
      .eq("brand_id", brandId)
      .order("computed_at", { ascending: false }),
    supabase
      .from("niche_trends")
      .select("topic,source,headline")
      .eq("brand_id", brandId)
      .eq("week_of", weekStart)
      .order("relevance_score", { ascending: false })
      .limit(10),
  ])

  const allPatterns = patternsResult.status === "fulfilled"
    ? (patternsResult.value.data ?? []) as Array<Record<string, unknown>>
    : []

  const trends = (trendsResult.status === "fulfilled"
    ? (trendsResult.value.data ?? [])
    : []) as TrendContext[]

  // 3. Build platform-specific performance context (for generateCaption)
  const platformPattern = platform
    ? allPatterns.find(p => p.platform === platform) ?? null
    : null

  const performance: PerformanceContext | null = platformPattern
    ? {
        platform:              platform!,
        avg_engagement_rate:   platformPattern.avg_engagement_rate as number | null,
        best_days_of_week:     platformPattern.best_days_of_week as number[] | null,
        best_hours_of_day:     platformPattern.best_hours_of_day as number[] | null,
        best_content_pillars:  platformPattern.best_content_pillars as string[] | null,
        best_post_types:       platformPattern.best_post_types as string[] | null,
        top_hashtags:          platformPattern.top_hashtags as string[] | null,
      }
    : null

  // 4. Resolve goals
  const goals: string[] | null =
    (b.goals as string[] | undefined)?.length
      ? (b.goals as string[])
      : b.primary_goal
      ? [b.primary_goal as string]
      : null

  // 5. Derive tone summary (used in promptBlock + simple prompts)
  const toneProfile = (b.tone_profile as ToneProfile | null) ?? null
  const toneSummary = toneProfile ? buildToneSummary(toneProfile) : null

  // 6. Build prompt block
  const promptBlock = buildPromptBlock({
    brand:       b as Record<string, unknown>,
    tokens,
    patterns:    allPatterns,
    trends,
    toneSummary,
    platform,
  })

  return {
    brand_id:            b.id,
    brand_name:          b.name,
    industry:            (b.industry as string) ?? "",
    niche:               (b.niche as string | null) ?? null,
    audience:            (b.target_audience_description as string | null) ?? null,
    goals,
    tone_profile:        toneProfile,
    tone_summary:        toneSummary,
    do_not_mention:      (b.do_not_mention as string[] | null) ?? null,
    emoji_policy:        ((b.emoji_policy as string) ?? "sparingly") as "never" | "sparingly" | "often",
    emoji_favorites:     (b.emoji_favorites as string | null) ?? null,
    performance,
    trends,
    intelligence_tokens: tokens,
    promptBlock,
  }
}
