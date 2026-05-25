/**
 * nudge-analyzer.ts
 *
 * Extracts intelligence token signals from free-text nudge input.
 * Used by the Trend Builder nudge route to update brand tokens
 * when a user describes what they want changed in a rendered video.
 *
 * Kept as a separate module so:
 *   - The keyword→token mapping can be extended without touching the API route.
 *   - Unit tests can exercise the extractor in isolation.
 *   - Future features (caption nudge, template nudge) can reuse the same pattern.
 */

// ── Signal definitions ────────────────────────────────────────────────────────

export interface NudgeSignal {
  keywords: string[]
  tokenKey:  string
  value:     string
  /** Confidence delta applied to the token when this signal fires */
  delta:     number
}

/** All keyword → token signal mappings.
 *  Add new entries here to extend nudge coverage without changing any route. */
export const NUDGE_SIGNALS: NudgeSignal[] = [
  { keywords: ["faster", "faster paced", "more upbeat", "speed up"],         tokenKey: "pacing",             value: "fast",           delta: 0.08 },
  { keywords: ["slower", "slower paced", "calmer", "less rushed"],            tokenKey: "pacing",             value: "slow",           delta: 0.08 },
  { keywords: ["energetic music", "high energy music", "pumping"],            tokenKey: "music_energy",       value: "high",           delta: 0.05 },
  { keywords: ["soft music", "calm music", "quieter music"],                  tokenKey: "music_energy",       value: "low",            delta: 0.05 },
  { keywords: ["less text", "less overlay", "cleaner", "minimal"],            tokenKey: "text_overlay_style", value: "minimal_corner", delta: 0.05 },
  { keywords: ["more text", "bigger text", "bold text"],                      tokenKey: "text_overlay_style", value: "bold_center",    delta: 0.05 },
  { keywords: ["softer hook", "gentler opening", "story hook"],               tokenKey: "hook_style",         value: "story_open",     delta: 0.05 },
  { keywords: ["stronger hook", "bolder hook", "statement hook"],             tokenKey: "hook_style",         value: "bold_statement", delta: 0.05 },
]

// ── Extraction function ───────────────────────────────────────────────────────

export interface ExtractedSignal {
  tokenKey: string
  value:    string
  delta:    number
}

/**
 * Match nudge text against all known signal keywords and return the fired signals.
 *
 * Matching is case-insensitive substring matching.
 * A signal fires if ANY of its keyword phrases appear in the nudge text.
 * Multiple signals can fire from a single nudge text.
 *
 * @param nudgeText - The user's free-text nudge description
 * @returns         Array of matched signals (may be empty)
 */
export function extractNudgeSignals(nudgeText: string): ExtractedSignal[] {
  const lower = nudgeText.toLowerCase()
  const found: ExtractedSignal[] = []

  for (const sig of NUDGE_SIGNALS) {
    if (sig.keywords.some(k => lower.includes(k))) {
      found.push({ tokenKey: sig.tokenKey, value: sig.value, delta: sig.delta })
    }
  }

  return found
}
