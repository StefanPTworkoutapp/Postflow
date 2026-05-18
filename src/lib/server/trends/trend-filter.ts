/**
 * Trend Filter — generates trend-aligned video concepts and scores them
 * against a brand's intelligence tokens.
 *
 * Brand Fit Score formula (from spec §6.3):
 *   brand_fit_score =
 *     (niche_match × 0.30) + (tone_match × 0.25) + (pacing_match × 0.20) +
 *     (platform_match × 0.15) + (past_perf × 0.10)
 *
 * Each concept returned has:
 *   - A hook/format description (shown in ConceptCard)
 *   - A trending reason line (why it's trending this week)
 *   - A brand_fit_score 0–100
 *   - A format_spec with goal, sections, timing (used by brand-assembler)
 *
 * Version A vs B strategy:
 *   A — Trend-First: trend pacing/hook/structure take precedence, brand kit applied cosmetically
 *   B — Brand-First: brand tokens fully control pacing/hook/structure
 *   Both use the same clip input; the assembler swaps token sets accordingly
 */

import Anthropic from "@anthropic-ai/sdk"
import type { BrandContext } from "@/lib/server/brand/getBrandContext"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

const claude = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrendConcept {
  concept_index:  number
  title:          string
  description:    string
  platform:       string
  niche_trend_id: string | null
  brand_fit_score: number
  hook_text:      string
  trending_reason: string
  sound_vibe:     string
  format_spec: {
    goal:         string
    duration_sec: number
    hook_style:   string
    pacing:       string
    music_energy: string
    cta_text:     string
    sections:     string[]
  }
}

export interface BrandVersionTokens {
  hook_style:   string
  pacing:       string
  music_energy: string
  music_genre:  string
  text_overlay_style: string
  hookText:     string
  ctaText:      string
}

// ── Brand fit scoring ─────────────────────────────────────────────────────────

/**
 * Score how well a concept fits the brand, 0–100.
 *
 * Each dimension is measured vs brand tokens:
 *   niche_match    — does concept platform match brand best_platform?
 *   tone_match     — does concept goal align with brand best_post_goal?
 *   pacing_match   — does concept pacing match brand pacing token?
 *   platform_match — does concept platform match brand's best_platform token?
 *   past_perf      — proxy: brand avg engagement rate (normalised 0–100)
 */
export function scoreBrandFit(
  concept: Pick<TrendConcept, "platform" | "format_spec">,
  ctx:     BrandContext,
): number {
  const tokens = ctx.intelligence_tokens

  const brandPlatform = (tokens.best_platform?.value as string | undefined) ?? "instagram"
  const brandGoal     = (tokens.best_post_goal?.value as string | undefined) ?? "educate"
  const brandPacing   = (tokens.pacing?.value as string | undefined) ?? "medium"

  // niche_match: brand niche exists in concept description
  const nicheMatch = ctx.niche
    ? 1.0  // niche_trends are already filtered to brand niche — always match
    : 0.5

  // tone_match: concept goal alignment (rough match)
  const GOAL_COMPAT: Record<string, string[]> = {
    educate:       ["educate", "build_trust"],
    grow_followers: ["grow_followers", "entertain"],
    showcase:      ["showcase", "sell"],
    entertain:     ["entertain", "grow_followers"],
    drive_sales:   ["sell", "drive_sales", "showcase"],
    build_trust:   ["educate", "build_trust"],
  }
  const toneMatch = (GOAL_COMPAT[brandGoal] ?? [brandGoal]).includes(concept.format_spec.goal) ? 1.0 : 0.5

  // pacing_match
  const PACING_COMPAT: Record<string, string[]> = {
    fast:   ["fast"],
    medium: ["fast", "medium"],
    slow:   ["medium", "slow"],
  }
  const pacingMatch = (PACING_COMPAT[brandPacing] ?? [brandPacing]).includes(concept.format_spec.pacing) ? 1.0 : 0.6

  // platform_match
  const platformMatch = concept.platform === brandPlatform ? 1.0 : 0.4

  // past_perf: use performance data if available (0.5 neutral default)
  const avgEngagement = (ctx.performance?.avg_engagement_rate as number | null) ?? null
  const pastPerf = avgEngagement !== null
    ? Math.min(1.0, avgEngagement * 10)  // 10% engagement = perfect score
    : 0.5

  const raw =
    nicheMatch    * 0.30 +
    toneMatch     * 0.25 +
    pacingMatch   * 0.20 +
    platformMatch * 0.15 +
    pastPerf      * 0.10

  return Math.round(raw * 100)
}

// ── Concept generation ────────────────────────────────────────────────────────

/**
 * Generate 3 trend-aligned video concepts using the brand's niche trends.
 * Returns concepts sorted by brand_fit_score descending.
 */
export async function generateTrendConcepts(
  ctx:       BrandContext,
  platform:  string,
  brandId?:  string | null,
): Promise<TrendConcept[]> {
  const tokens  = ctx.intelligence_tokens
  const trends  = ctx.trends.slice(0, 5)  // top 5 trends for the brand's niche

  const trendBlock = trends.length
    ? trends.map((t, i) => `${i + 1}. "${t.topic}"${t.headline ? ` — headline: "${t.headline}"` : ""}`).join("\n")
    : "No specific trend data — use general niche content patterns."

  const brandPacing = (tokens.pacing?.value as string | undefined) ?? "medium"
  const brandGoal   = (tokens.best_post_goal?.value as string | undefined) ?? "educate"

  const prompt = `${ctx.promptBlock}

---
TASK: Generate 3 short-form video concepts for ${platform} that ride current trends.

TRENDING TOPICS IN THIS NICHE RIGHT NOW:
${trendBlock}

For each concept, pick the most compelling trend angle and design a video format.
Consider:
- What hooks are getting 3–5× normal reach this week?
- What format (fast montage, educational reel, showcase, etc.) fits the trend?
- How does this brand's tone and expertise add value to this trend?

Respond with a JSON array of EXACTLY 3 concept objects. Each object:
{
  "title": "Short punchy concept title (max 8 words)",
  "description": "1 sentence: what this video is and why it will perform (max 20 words)",
  "platform": "${platform}",
  "hook_text": "The exact opening line for this video (under 8 words, scroll-stopping)",
  "trending_reason": "Why this is getting traction right now (1 sentence, factual)",
  "sound_vibe": "Music/sound description (e.g. 'upbeat electronic', 'lo-fi chill', 'trending audio')",
  "format_spec": {
    "goal": "${brandGoal}",
    "duration_sec": 20,
    "hook_style": "fast_question|bold_statement|shock_stat|story_open",
    "pacing": "${brandPacing}",
    "music_energy": "low|medium|medium_high|high",
    "cta_text": "Short CTA for end of video (under 6 words)",
    "sections": ["Opening hook", "Main content", "CTA"]
  }
}

Vary the concepts: different angles, different hooks, different vibes.
Sort them by likely performance — best first.
Respond with ONLY the JSON array. No markdown, no extra text.`

  try {
    const response = await claude.messages.create({
      model:      MODELS.trendFilter,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })
    logAiUsage({ brandId: brandId ?? null, model: MODELS.trendFilter, feature: "trend_filter", usage: response.usage })

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()

    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    const raw  = JSON.parse(json) as Partial<TrendConcept>[]

    const concepts: TrendConcept[] = raw.slice(0, 3).map((c, i) => {
      const concept: TrendConcept = {
        concept_index:   i,
        title:           c.title        ?? `Trending concept ${i + 1}`,
        description:     c.description  ?? "",
        platform,
        niche_trend_id:  null,
        hook_text:       c.hook_text    ?? "",
        trending_reason: c.trending_reason ?? "",
        sound_vibe:      c.sound_vibe   ?? "upbeat electronic",
        brand_fit_score: 0,  // computed below
        format_spec: {
          goal:         c.format_spec?.goal         ?? brandGoal,
          duration_sec: c.format_spec?.duration_sec ?? 20,
          hook_style:   c.format_spec?.hook_style   ?? "fast_question",
          pacing:       c.format_spec?.pacing       ?? brandPacing,
          music_energy: c.format_spec?.music_energy ?? "medium_high",
          cta_text:     c.format_spec?.cta_text     ?? "Follow for more",
          sections:     c.format_spec?.sections     ?? ["Hook", "Content", "CTA"],
        },
      }
      concept.brand_fit_score = scoreBrandFit(concept, ctx)
      return concept
    })

    // Sort best fit first
    return concepts.sort((a, b) => b.brand_fit_score - a.brand_fit_score)

  } catch (err) {
    console.error("[trend-filter] concept generation failed:", err)
    // Return safe fallback concepts
    return fallbackConcepts(ctx, platform)
  }
}

function fallbackConcepts(ctx: BrandContext, platform: string): TrendConcept[] {
  const goal    = (ctx.intelligence_tokens.best_post_goal?.value as string | undefined) ?? "educate"
  const pacing  = (ctx.intelligence_tokens.pacing?.value as string | undefined)         ?? "medium"

  return [0, 1, 2].map(i => ({
    concept_index:   i,
    title:           `Trending concept ${i + 1}`,
    description:     `A trend-aligned ${goal} video for ${platform}`,
    platform,
    niche_trend_id:  null,
    hook_text:       "Did you know this?",
    trending_reason: "Trending in your niche this week",
    sound_vibe:      "upbeat electronic",
    brand_fit_score: 70 - i * 5,
    format_spec: {
      goal,
      duration_sec: 20,
      hook_style:   "fast_question",
      pacing,
      music_energy: "medium_high",
      cta_text:     "Follow for more",
      sections:     ["Hook", "Content", "CTA"],
    },
  }))
}

// ── Version token sets ────────────────────────────────────────────────────────

/**
 * Returns the token set for Version A (trend-first) and Version B (brand-first).
 * The brand-assembler uses these to build two different render specs.
 */
export function getVersionTokens(
  concept: TrendConcept,
  ctx:     BrandContext,
): { versionA: BrandVersionTokens; versionB: BrandVersionTokens } {
  const tokens = ctx.intelligence_tokens

  // Version A — trend drives all content decisions
  const versionA: BrandVersionTokens = {
    hook_style:         concept.format_spec.hook_style,
    pacing:             concept.format_spec.pacing,
    music_energy:       concept.format_spec.music_energy,
    music_genre:        (tokens.music_genre?.value as string | undefined) ?? "modern_electronic",
    text_overlay_style: (tokens.text_overlay_style?.value as string | undefined) ?? "bold_center",
    hookText:           concept.hook_text,
    ctaText:            concept.format_spec.cta_text,
  }

  // Version B — brand tokens drive all content decisions
  const versionB: BrandVersionTokens = {
    hook_style:         (tokens.hook_style?.value as string | undefined)         ?? concept.format_spec.hook_style,
    pacing:             (tokens.pacing?.value as string | undefined)             ?? concept.format_spec.pacing,
    music_energy:       (tokens.music_energy?.value as string | undefined)       ?? concept.format_spec.music_energy,
    music_genre:        (tokens.music_genre?.value as string | undefined)        ?? "modern_electronic",
    text_overlay_style: (tokens.text_overlay_style?.value as string | undefined) ?? "bold_center",
    hookText:           concept.hook_text,
    ctaText:            (tokens.best_performing_cta?.value as string | undefined) ?? concept.format_spec.cta_text,
  }

  return { versionA, versionB }
}
