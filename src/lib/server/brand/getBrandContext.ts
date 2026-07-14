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
  brand_id:            string
  brand_name:          string
  industry:            string
  niche:               string | null
  audience:            string | null
  goals:               string[] | null
  /** Brand tagline — short statement injected into caption prompts to anchor brand voice */
  tagline:             string | null
  /** Brand website URL — included in CTA guidance when available */
  website_url:         string | null
  /** Target age range (e.g. "25–40") — informs tone and vocabulary in captions */
  target_age_range:    string | null
  /** Geographic location focus — informs localisation and regional references */
  geographic_location: string | null
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
  /** Raw example posts used for tone extraction — injected as few-shot samples at generation time */
  tone_examples: string[] | null
  /** User-written custom constraints: "always do X" — injected as absolute rules in every caption */
  custom_do_rules: string | null
  /** User-written custom constraints: "never do Y" — injected as absolute rules in every caption */
  custom_dont_rules: string | null

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

interface TemplateHealthEntry {
  template_slug:   string
  health_score:    number
  trend:           string | null
  posts_count:     number
}

interface TemplateSuggestionEntry {
  current_slug:   string
  suggested_slug: string
  reason:         string | null
}

interface NicheBenchmarkEntry {
  platform:           string
  top_template_slugs: string[] | null
}

interface ImportedPostRow {
  platform:   string
  caption:    string | null
  posted_at:  string | null
  media_type: string | null
  engagement: Record<string, number | null> | null
}

export interface ColdStartBaseline {
  platform:       string
  bestDaysOfWeek: number[]
  bestHoursOfDay: number[]
  topMediaType:   string | null
  sampleSize:     number
}

/**
 * Cold-start baseline (P3, 2026-07-14) — when a brand-new (or newly-connected)
 * account has no PostFlow-native performance_patterns yet (sample_size < 5,
 * see optimal-time.ts / this file's `filteredPatterns` filter), derive a
 * PROVISIONAL best-day/best-hour/top-format signal from the account's own
 * imported (pre-existing) published posts instead of falling back to a
 * generic industry default. Simple + deterministic — no AI call:
 *   1. Score each imported post: likes + comments×2 + shares×3
 *      (weights match the emphasis already used elsewhere: comments/shares
 *      are heavier engagement signals than a like).
 *   2. Take the top 30% (min 3) highest-scoring posts.
 *   3. Tabulate day-of-week + hour-of-day from their posted_at, media_type
 *      frequency — return the top 2 days/hours and the modal media_type.
 * Requires >=5 imported posts for a platform to produce a baseline at all
 * (same sample-size bar as native patterns) — otherwise silently omitted.
 */
export function deriveColdStartBaselines(imported: ImportedPostRow[]): ColdStartBaseline[] {
  const byPlatform = new Map<string, ImportedPostRow[]>()
  for (const p of imported) {
    if (!p.posted_at) continue
    const list = byPlatform.get(p.platform) ?? []
    list.push(p)
    byPlatform.set(p.platform, list)
  }

  const baselines: ColdStartBaseline[] = []
  for (const [platform, posts] of byPlatform) {
    if (posts.length < 5) continue

    const scored = posts
      .map(p => {
        const e = p.engagement ?? {}
        const score = (e.likes ?? 0) + (e.comments ?? 0) * 2 + (e.shares ?? 0) * 3
        return { ...p, score }
      })
      .sort((a, b) => b.score - a.score)

    const topSlice = scored.slice(0, Math.max(3, Math.ceil(scored.length * 0.3)))

    const dayCounts   = new Map<number, number>()
    const hourCounts  = new Map<number, number>()
    const mediaCounts = new Map<string, number>()
    for (const p of topSlice) {
      const d = new Date(p.posted_at!)
      if (Number.isNaN(d.getTime())) continue
      dayCounts.set(d.getUTCDay(),   (dayCounts.get(d.getUTCDay())   ?? 0) + 1)
      hourCounts.set(d.getUTCHours(), (hourCounts.get(d.getUTCHours()) ?? 0) + 1)
      if (p.media_type) mediaCounts.set(p.media_type, (mediaCounts.get(p.media_type) ?? 0) + 1)
    }

    const topN = (m: Map<number, number>, n: number) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)

    const topMediaType = [...mediaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    baselines.push({
      platform,
      bestDaysOfWeek: topN(dayCounts, 2),
      bestHoursOfDay: topN(hourCounts, 2),
      topMediaType,
      sampleSize: posts.length,
    })
  }
  return baselines
}

function buildPromptBlock(opts: {
  brand:                Record<string, unknown>
  tokens:               Record<string, { value: unknown; confidence: number }>
  patterns:             Array<Record<string, unknown>>
  trends:               TrendContext[]
  toneSummary:          string | null
  platform?:            string
  contentLanguage:      string | null
  templateHealth?:      TemplateHealthEntry[]
  templateSuggestions?: TemplateSuggestionEntry[]
  nicheBenchmarks?:     NicheBenchmarkEntry[]
  coldStartBaselines?:  ColdStartBaseline[]
  recentTopics?:        string[]
}): string {
  const { brand, tokens, patterns, trends, toneSummary, platform, contentLanguage, templateHealth, templateSuggestions, nicheBenchmarks, coldStartBaselines, recentTopics } = opts
  const b = brand as {
    name: string; industry?: string; niche?: string; primary_goal?: string
    goals?: string[]; do_not_mention?: string[]
    target_audience_description?: string
    tagline?: string | null
    website_url?: string | null
    target_age_range?: string | null
    geographic_location?: string | null
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

  // ── Cold-start baseline block ───────────────────────────────────────────
  // Only surfaced for a platform that has NO sufficient native pattern
  // (filteredPatterns above) — a brand's own real 90-day data always wins
  // once it exists; this is purely a bridge for day-one accounts.
  const platformsWithPatterns = new Set(filteredPatterns.map(p => p.platform as string))
  const coldStartLines = (coldStartBaselines ?? [])
    .filter(cs => !platformsWithPatterns.has(cs.platform) && (!platform || cs.platform === platform))
    .map(cs => {
      const days  = cs.bestDaysOfWeek.map(d => DAY_NAMES[d]).join(",")
      const hours = cs.bestHoursOfDay.map(h => `${h}:00`).join(",")
      return `  ${cs.platform} (PROVISIONAL — from ${cs.sampleSize} imported posts, no native data yet): best days=${days} | best hours=${hours}${cs.topMediaType ? ` | top format=${cs.topMediaType}` : ""}`
    })
  const coldStartBlock = coldStartLines.length
    ? `\nCOLD-START BASELINE (provisional, derived from this account's pre-existing published posts — treat as directional only, native data supersedes it once available):\n${coldStartLines.join("\n")}`
    : ""

  // ── Recently published dedupe block ─────────────────────────────────────
  const recentTopicsBlock = recentTopics?.length
    ? `\nRECENTLY PUBLISHED ON THIS ACCOUNT (do not repeat these topics — find a fresh angle or a different subject):\n${recentTopics.map(t => `  - ${t}`).join("\n")}`
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

  // ── Style volatility preference block ───────────────────────────────────────
  // Tells Claude how much to experiment vs. stay on-brand.
  const styleVolToken = tokens["style_volatility_preference"]
  const styleVol      = (styleVolToken?.value as string | null) ?? "mixed"
  const STYLE_VOL_GUIDE: Record<string, string> = {
    steady:       "This brand prioritises consistency. Stay tightly on-brand: use proven formats, established tone, minimal surprises. Any given content calendar should be ~80% proven formats, ~20% carefully tested variations.",
    mixed:        "This brand balances identity with experimentation. ~65% proven formats that reinforce brand identity; ~35% purposeful experiments to discover new high-performers.",
    experimental: "This brand actively experiments. ~45% proven formats to anchor identity; ~55% varied formats, tones, and styles to find what resonates. Be bold but coherent.",
  }
  const styleGuide = STYLE_VOL_GUIDE[styleVol] ?? STYLE_VOL_GUIDE.mixed
  const styleVolBlock = `\nCONTENT STYLE BALANCE: ${styleVol.toUpperCase()}\n  ${styleGuide}`

  // ── Template performance block ───────────────────────────────────────────────
  // Informs Claude which content formats are working so it can align copywriting
  // to the right template's strengths and avoid laboured copy for declining ones.
  let templateBlock = ""
  if (templateHealth && templateHealth.length > 0) {
    const goodTemplates = templateHealth
      .filter(t => t.health_score >= 55 && t.posts_count >= 3)
      .sort((a, b) => b.health_score - a.health_score)
      .slice(0, 3)

    const decliningTemplates = templateHealth
      .filter(t => t.trend === "declining" && t.posts_count >= 3)

    const lines: string[] = []
    if (goodTemplates.length) {
      lines.push(`  High-performing formats: ${goodTemplates.map(t => `${t.template_slug} (score ${t.health_score}${t.trend === "rising" ? ", rising ↑" : ""})`).join(", ")}`)
    }
    if (decliningTemplates.length) {
      lines.push(`  Declining formats: ${decliningTemplates.map(t => `${t.template_slug} (score ${t.health_score})`).join(", ")} — write especially compelling copy if forced to use these.`)
    }
    if (templateSuggestions && templateSuggestions.length > 0) {
      const s = templateSuggestions[0]
      lines.push(`  Recommendation: replace ${s.current_slug} with ${s.suggested_slug} (${s.reason ?? "better niche fit"})`)
    }
    if (lines.length) {
      templateBlock = `\nTEMPLATE PERFORMANCE:\n${lines.join("\n")}`
    }
  }

  // ── Niche winning-formats block ───────────────────────────────────────────
  // niche_benchmarks.top_template_slugs is computed weekly by
  // refreshNicheBenchmarks() but had zero readers until P1 (2026-07-14).
  // Surfacing it here closes that gap: Claude sees what's working for other
  // brands in the same niche, not just this brand's own (often sparse) data.
  // Silently omitted when the niche has no benchmark rows yet.
  const relevantBenchmarks = platform
    ? (nicheBenchmarks ?? []).filter(nb => nb.platform === platform)
    : (nicheBenchmarks ?? [])
  const nicheFormatLines = relevantBenchmarks
    .filter(nb => nb.top_template_slugs?.length)
    .map(nb => `  ${nb.platform}: ${nb.top_template_slugs!.slice(0, 3).join(", ")}`)
  const nicheFormatsBlock = nicheFormatLines.length
    ? `\nFORMATS PERFORMING BEST IN YOUR NICHE:\n${nicheFormatLines.join("\n")}`
    : ""

  return [
    `BRAND: ${b.name}`,
    b.tagline              ? `Tagline: "${b.tagline}"` : "",
    b.industry             ? `Industry: ${b.industry}` : "",
    b.niche                ? `Niche: ${b.niche}` : "",
    b.target_audience_description ? `Audience: ${b.target_audience_description}` : "",
    b.target_age_range     ? `Target age range: ${b.target_age_range}` : "",
    b.geographic_location  ? `Geographic focus: ${b.geographic_location}` : "",
    b.website_url          ? `Website: ${b.website_url} (you may reference it in CTAs when relevant)` : "",
    goalsLine,
    toneSummary ? `Tone: ${toneSummary}` : "",
    contentLanguage ? `Content language: ${contentLanguage} — ALL generated text must be in ${contentLanguage}.` : "",
    b.do_not_mention?.length ? `Never mention: ${b.do_not_mention.join(", ")}` : "",
    styleVolBlock,
    performanceBlock,
    coldStartBlock,
    recentTopicsBlock,
    trendBlock,
    templateBlock,
    nicheFormatsBlock,
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
    tagline?: string | null
    website_url?: string | null
    target_age_range?: string | null
    geographic_location?: string | null
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

  // Build platform filter clause for template_health
  const templateHealthQuery = supabase
    .from("template_health")
    .select("template_slug,health_score,trend,posts_count")
    .eq("brand_id", brandId)
    .gte("posts_count", 3)
    .order("health_score", { ascending: false })
    .limit(8)

  const templateSuggestionsQuery = supabase
    .from("template_suggestions")
    .select("current_slug,suggested_slug,reason")
    .eq("brand_id", brandId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)

  const nicheTag = (b.niche as string | null) ?? (b.industry as string | null) ?? "general"
  const nicheBenchmarksQuery = supabase
    .from("niche_benchmarks")
    .select("platform,top_template_slugs")
    .eq("niche_tag", nicheTag)

  // imported_posts is not yet in generated database.types.ts pre-migration —
  // same type-bypass idiom as dailyAnalyticsFetch.ts's `newTables()` helper.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importedPostsQuery = (supabase as any)
    .from("imported_posts")
    .select("platform,caption,posted_at,media_type,engagement")
    .eq("brand_id", brandId)
    .order("posted_at", { ascending: false })
    .limit(200)

  // PostFlow's own recently-published posts — for the dedupe block, so the
  // "don't repeat this" list covers both pre-existing (imported) AND
  // PostFlow-generated history, not just one source.
  const ownRecentPostsQuery = supabase
    .from("posts")
    .select("caption")
    .eq("brand_id", brandId)
    .eq("status", "posted")
    .order("posted_at", { ascending: false })
    .limit(20)

  const [
    patternsResult, trendsResult, templateHealthResult, templateSuggestionsResult,
    nicheBenchmarksResult, importedPostsResult, ownRecentPostsResult,
  ] = await Promise.allSettled([
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
    templateHealthQuery,
    templateSuggestionsQuery,
    nicheBenchmarksQuery,
    importedPostsQuery,
    ownRecentPostsQuery,
  ])

  const allPatterns = patternsResult.status === "fulfilled"
    ? (patternsResult.value.data ?? []) as Array<Record<string, unknown>>
    : []

  const trends = (trendsResult.status === "fulfilled"
    ? (trendsResult.value.data ?? [])
    : []) as TrendContext[]

  const templateHealth = (templateHealthResult.status === "fulfilled"
    ? (templateHealthResult.value.data ?? [])
    : []) as TemplateHealthEntry[]

  const templateSuggestions = (templateSuggestionsResult.status === "fulfilled"
    ? (templateSuggestionsResult.value.data ?? [])
    : []) as TemplateSuggestionEntry[]

  const nicheBenchmarks = (nicheBenchmarksResult.status === "fulfilled"
    ? (nicheBenchmarksResult.value.data ?? [])
    : []) as NicheBenchmarkEntry[]

  const importedPosts = (importedPostsResult.status === "fulfilled"
    ? ((importedPostsResult.value as { data: unknown[] | null }).data ?? [])
    : []) as Array<{ platform: string; caption: string | null; posted_at: string | null; media_type: string | null; engagement: Record<string, number | null> | null }>

  const ownRecentPosts = (ownRecentPostsResult.status === "fulfilled"
    ? (ownRecentPostsResult.value.data ?? [])
    : []) as Array<{ caption: string | null }>

  // ── Dedupe block: recently-published topics (imported + PostFlow-own) ────
  const truncate = (s: string) => (s.length > 80 ? `${s.slice(0, 77).trim()}…` : s)
  const recentTopics = [
    ...importedPosts.slice(0, 30).map(p => p.caption).filter((c): c is string => !!c?.trim()),
    ...ownRecentPosts.map(p => p.caption).filter((c): c is string => !!c?.trim()),
  ]
    .map(truncate)
    .filter((c, i, arr) => arr.indexOf(c) === i)   // dedupe
    .slice(0, 40)

  const coldStartBaselines = deriveColdStartBaselines(importedPosts)

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
    brand:                b as Record<string, unknown>,
    tokens,
    patterns:             allPatterns,
    trends,
    toneSummary,
    platform,
    contentLanguage:      toneProfile?.content_language ?? null,
    templateHealth:       templateHealth.length ? templateHealth : undefined,
    templateSuggestions:  templateSuggestions.length ? templateSuggestions : undefined,
    nicheBenchmarks:      nicheBenchmarks.length ? nicheBenchmarks : undefined,
    coldStartBaselines:   coldStartBaselines.length ? coldStartBaselines : undefined,
    recentTopics:         recentTopics.length ? recentTopics : undefined,
  })

  return {
    brand_id:            b.id,
    brand_name:          b.name,
    industry:            (b.industry as string) ?? "",
    niche:               (b.niche as string | null) ?? null,
    audience:            (b.target_audience_description as string | null) ?? null,
    tagline:             (b.tagline as string | null) ?? null,
    website_url:         (b.website_url as string | null) ?? null,
    target_age_range:    (b.target_age_range as string | null) ?? null,
    geographic_location: (b.geographic_location as string | null) ?? null,
    goals,
    tone_profile:        toneProfile,
    tone_summary:        toneSummary,
    do_not_mention:      (b.do_not_mention as string[] | null) ?? null,
    emoji_policy:        ((b.emoji_policy as string) ?? "sparingly") as "never" | "sparingly" | "often",
    emoji_favorites:     (b.emoji_favorites as string | null) ?? null,
    performance,
    trends,
    intelligence_tokens: tokens,
    tone_examples:       (b.tone_examples as string[] | null) ?? null,
    custom_do_rules:     (b.custom_do_rules as string | null) ?? null,
    custom_dont_rules:   (b.custom_dont_rules as string | null) ?? null,
    promptBlock,
  }
}
