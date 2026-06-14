/**
 * Central AI model registry.
 *
 * ONE place to change model strings for the whole app.
 *
 * Two quality tiers exist for USER-FACING, real-time generation only.
 * Background jobs and one-time setup always run on their fixed models —
 * these are tuned per task, not per brand preference.
 *
 * Tiered (vary by brand setting):
 *   caption          — called on every post generation (biggest cost driver)
 *   calendar         — monthly full-calendar generation (large context)
 *
 * Fixed (always the same):
 *   Everything else — either one-time onboarding, background Inngest jobs,
 *   or already cost-optimized for the task type.
 */

export type AiTier = "standard" | "economy"

// ── Fixed models (task-tuned, not brand-configurable) ──────────────────────

export const MODELS = {
  // One-time onboarding — quality matters, infrequent
  toneExtraction:  "claude-sonnet-4-6",
  samplePost:      "claude-sonnet-4-6",
  calibration:     "claude-sonnet-4-6",
  imageExtraction: "claude-sonnet-4-6",
  docExtraction:   "claude-sonnet-4-6",

  // Background Inngest jobs — already individually tuned
  clipAnalyzer:    "claude-haiku-4-5",
  inspireAnalyze:  "claude-opus-4-5",
  nicheResearch:   "claude-opus-4-5",
  toneLoop:        "claude-haiku-4-5",
  trendEmail:      "claude-haiku-4-5",
  trendFilter:     "claude-haiku-4-5",
  mediaTag:        "claude-haiku-4-5",
  clipCaptions:    "claude-haiku-4-5",
  storyCaptions:   "claude-haiku-4-5",
  explanations:    "claude-haiku-4-5",

  // In-app quick actions — focused tasks, Haiku is sufficient
  calendarRegen:   "claude-haiku-4-5",
  formatConvert:   "claude-haiku-4-5",
} as const

// ── Tiered models (vary by brand's ai_tier setting) ────────────────────────

const TIERED: Record<AiTier, { caption: string; calendar: string }> = {
  standard: {
    caption:  "claude-sonnet-4-6",
    calendar: "claude-sonnet-4-6",
  },
  economy: {
    // Haiku 4.5 is capable for focused tasks — captions are prompt-guided
    // and don't need Sonnet's reasoning depth. Significant cost saving.
    caption:  "claude-haiku-4-5",
    // Calendar generation uses a complex multi-rule prompt + JSON schema.
    // Use Sonnet to keep output quality even in economy mode.
    calendar: "claude-sonnet-4-6",
  },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the merged model map for the given tier.
 * Pass `brand.ai_tier` here — defaults to "standard" if missing/null.
 */
export function getModels(tier: AiTier = "standard") {
  return { ...MODELS, ...TIERED[tier] }
}

/**
 * Reads the tier from any object that may have an `ai_tier` field.
 * Gracefully falls back to "standard" when the column doesn't exist yet
 * (before the migration runs, or for brands created before the feature).
 */
export function brandTier(brand: { ai_tier?: string | null }): AiTier {
  return brand.ai_tier === "economy" ? "economy" : "standard"
}
