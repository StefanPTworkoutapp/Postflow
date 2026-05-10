/**
 * Format Registry — declares every content format in PostFlow.
 *
 * Rules (from Part 8A of the spec):
 * - Every format must have an entry here before it ships.
 * - Empty tokens array is acceptable temporarily — missing entry is not.
 * - Never delete entries — only add.
 * - health_weights must not be changed once a format has live data
 *   (changing weights invalidates all existing health score history).
 */

export interface FormatDefinition {
  /** All intelligence_tokens keys that apply to this format */
  tokens:           readonly string[]
  /** The primary metric used for health scoring */
  primary_metric:   string
  /** Supabase/API source for this format's analytics */
  analytics_source: string
  /** Weighting for health score calculation (must sum to 1.0) */
  health_weights:   Record<string, number> | null
  /** Signal weight when this source updates a token (0–1) */
  signal_weight?:   number
}

export const formatRegistry = {
  reel: {
    tokens: [
      "hook_style",
      "hook_duration_seconds",
      "pacing",
      "transition_style",
      "text_overlay_style",
      "music_energy",
      "music_genre",
      "best_content_duration_seconds",
      "caption_tone",
      "hashtag_strategy",
    ],
    primary_metric:   "completion_rate",
    analytics_source: "instagram_reels_insights",
    health_weights:   { completion: 0.50, saves: 0.30, engagement: 0.20 },
  },

  carousel: {
    tokens: [
      "carousel_slide_count",
      "carousel_content_mix",
      "carousel_text_overlay_density",
      "carousel_hook_style",
      "carousel_slide_pacing",
      "carousel_best_goal",
      "carousel_vs_reel_preference",
    ],
    primary_metric:   "swipe_through_rate",
    analytics_source: "instagram_carousel_insights",
    health_weights:   { swipe_through: 0.45, saves: 0.35, engagement: 0.20 },
  },

  // Future formats — tokens TBD when each builder is built. Register entry now.
  story: {
    tokens:           [] as readonly string[], // TODO: define story tokens when story builder ships
    primary_metric:   "exit_rate",
    analytics_source: "instagram_story_insights",
    health_weights:   { completion: 0.60, taps_forward: 0.40 },
  },

  linkedin_post: {
    tokens:           [] as readonly string[], // TODO: define linkedin tokens when linkedin builder ships
    primary_metric:   "click_through_rate",
    analytics_source: "linkedin_post_statistics",
    health_weights:   { ctr: 0.50, engagement: 0.30, impressions: 0.20 },
  },

  tiktok_video: {
    tokens:           [] as readonly string[], // TODO: define tiktok tokens when tiktok builder ships
    primary_metric:   "completion_rate",
    analytics_source: "tiktok_video_stats",
    health_weights:   { completion: 0.55, shares: 0.30, engagement: 0.15 },
  },

  /**
   * inspiration_post — not a content format, but a signal source.
   * Registered here so the wiring standard can track it.
   * Tokens are the ones an inspiration post can influence.
   */
  inspiration_post: {
    tokens: [
      "hook_style",
      "hook_duration_seconds",
      "pacing",
      "text_overlay_style",
      "music_energy",
      "music_genre",
      "caption_tone",
      "hashtag_strategy",
      "carousel_slide_count",
      "carousel_content_mix",
      "carousel_text_overlay_density",
      "carousel_hook_style",
    ],
    primary_metric:   "user_applied",
    analytics_source: "supadata_extraction",
    health_weights:   null,
    signal_weight:    0.10, // lower than feedback (0.15 delta) — external inspiration, not own performance
  },
} as const satisfies Record<string, FormatDefinition>

export type FormatKey = keyof typeof formatRegistry

/** Returns the token keys relevant for a given format. */
export function getFormatTokens(format: FormatKey): readonly string[] {
  return formatRegistry[format].tokens
}

/** Returns the health score weights for a given format, or null if not applicable. */
export function getHealthWeights(format: FormatKey): Record<string, number> | null {
  return formatRegistry[format].health_weights
}

/** Detect format from a post's template_slug. */
export function detectFormat(templateSlug: string | null | undefined): FormatKey | null {
  if (!templateSlug) return null
  if (templateSlug.startsWith("carousel-")) return "carousel"
  if (templateSlug === "reel-cover" || templateSlug === "story-teaser") return "reel"
  return "reel" // default for single-image posts treated as feed content
}
