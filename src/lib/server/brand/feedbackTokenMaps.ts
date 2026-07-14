/**
 * feedbackTokenMaps — shared feedback → intelligence_tokens mappings.
 *
 * Every feedback consumer (tone_feedback / clip_forge_feedback /
 * trend_feedback) ends up doing the same three things:
 *   1. Resolve a token action's target value ("CURRENT" means "read the
 *      existing value, only shift confidence")
 *   2. Call nudgeToken() with that resolved value
 *   3. Not blow up the caller if the nudge fails
 *
 * This module centralises that logic (resolveAndNudge) plus the tag → token
 * maps themselves, so the three loops (tone, clip-forge, trend) stay in sync
 * instead of drifting into three slightly-different copies.
 *
 * Delta scale (matches nudgeToken's confidence semantics, 0–1):
 *   0.08  — full-strength batch signal (tone loop, threshold hit)
 *   0.04  — half-strength immediate per-row signal (see toneLearningLoop.ts
 *           for the double-counting guard this enables)
 *   0.03–0.07 — tag-specific deltas for clip-forge / trend feedback, sized
 *           by how directly the tag implicates a single token
 */

import { createServiceClient } from "@/lib/supabase/service"
import { nudgeToken } from "@/lib/server/brand/nudge-token"
import type { SignalType } from "@/lib/server/brand/nudge-token"

export interface FeedbackTokenAction {
  tokenKey:    string
  /** Target value — "CURRENT" means keep existing value (only adjust confidence) */
  targetValue: string | "CURRENT"
  delta:       number
  /** allowCreate: true = create this token if it doesn't exist yet */
  allowCreate?: boolean
}

// ── Tone feedback (post-level, "great" / "too_formal" / etc.) ────────────────
// Moved here from toneLearningLoop.ts so the immediate per-row nudge (fired
// from the feedback route) and the weekly batch nudge share one definition.

export const TONE_FEEDBACK_DELTA          = 0.08  // full-strength batch signal
export const TONE_FEEDBACK_REJECT_DELTA   = -0.08
export const TONE_FEEDBACK_IMMEDIATE_DELTA = TONE_FEEDBACK_DELTA / 2  // 0.04 — half-strength, applied per row at write time

export const TONE_FEEDBACK_TOKEN_MAP: Record<string, FeedbackTokenAction> = {
  too_formal: {
    tokenKey:    "caption_tone",
    targetValue: "conversational",
    delta:       TONE_FEEDBACK_DELTA,
  },
  too_casual: {
    tokenKey:    "caption_tone",
    targetValue: "professional",
    delta:       TONE_FEEDBACK_DELTA,
  },
  wrong_voice: {
    tokenKey:    "caption_tone",
    targetValue: "CURRENT",
    delta:       TONE_FEEDBACK_REJECT_DELTA,
  },
  cta_weak: {
    tokenKey:    "best_post_goal",
    targetValue: "CURRENT",
    delta:       TONE_FEEDBACK_REJECT_DELTA,
  },
  weak_cta: {
    tokenKey:    "best_post_goal",
    targetValue: "CURRENT",
    delta:       TONE_FEEDBACK_REJECT_DELTA,
  },
  loved_it: {
    tokenKey:    "caption_tone",
    targetValue: "CURRENT",
    delta:       TONE_FEEDBACK_DELTA,
  },
  great: {
    tokenKey:    "caption_tone",
    targetValue: "CURRENT",
    delta:       TONE_FEEDBACK_DELTA,
  },
}

// ── Video feedback (clip-forge + trend) ──────────────────────────────────────
// Both surfaces render video content and reuse the same FeedbackRow tag sets
// (BASE_FEEDBACK_TAGS for tone/caption tags, REEL_FEEDBACK_TAGS for
// video-specific tags — see src/components/shared/FeedbackRow.tsx). Deltas
// are deliberately smaller (0.03–0.07) than the tone loop's batch delta
// because each of these fires per-job rather than after a 3+ occurrence
// batch — see clipForgeFeedbackLoop.ts and the trend feedback route for how
// each caller aggregates/gates before calling in.

export const VIDEO_FEEDBACK_TAG_MAP: Record<string, FeedbackTokenAction> = {
  // Shared with tone tags (caption/CTA signals also apply to video captions)
  too_formal:  { tokenKey: "caption_tone",   targetValue: "conversational", delta: 0.06 },
  too_casual:  { tokenKey: "caption_tone",   targetValue: "professional",  delta: 0.06 },
  wrong_voice: { tokenKey: "caption_tone",   targetValue: "CURRENT",       delta: -0.06 },
  cta_weak:    { tokenKey: "best_post_goal", targetValue: "CURRENT",       delta: -0.05 },
  great:       { tokenKey: "caption_tone",   targetValue: "CURRENT",       delta: 0.05 },
  too_long:    { tokenKey: "best_content_duration_seconds", targetValue: "CURRENT", delta: -0.04 },
  too_short:   { tokenKey: "best_content_duration_seconds", targetValue: "CURRENT", delta: -0.04 },

  // Video-specific (REEL_FEEDBACK_TAGS)
  great_hook:       { tokenKey: "hook_style",   targetValue: "CURRENT", delta: 0.06 },
  bad_music:        { tokenKey: "music_energy", targetValue: "CURRENT", delta: -0.05 },
  too_fast:         { tokenKey: "pacing",       targetValue: "slower",  delta: 0.06 },
  too_slow:         { tokenKey: "pacing",       targetValue: "faster",  delta: 0.06 },
  wrong_length:     { tokenKey: "best_content_duration_seconds", targetValue: "CURRENT", delta: -0.05 },
  doesnt_fit_brand: { tokenKey: "caption_tone", targetValue: "CURRENT", delta: -0.07 },
}

/** Blanket rating-only signal — used when a rating has no (mapped) tags to go with it. */
export const VIDEO_RATING_APPROVE_ACTION: FeedbackTokenAction = {
  tokenKey: "best_post_goal", targetValue: "CURRENT", delta: 0.03,
}
export const VIDEO_RATING_REJECT_ACTION: FeedbackTokenAction = {
  tokenKey: "best_post_goal", targetValue: "CURRENT", delta: -0.03,
}

/**
 * Resolve a FeedbackTokenAction's "CURRENT" target value against the brand's
 * live intelligence_tokens, then apply it via nudgeToken(). Never throws —
 * a failed nudge is logged and reported back as `false`, the caller (feedback
 * route or batch job) decides whether that's fatal (it never is: the raw
 * feedback row itself is retained either way).
 */
export async function resolveAndNudge(
  brandId:    string,
  action:     FeedbackTokenAction,
  signalType: SignalType,
  sourceId?:  string,
  detail?:    Record<string, unknown>,
): Promise<boolean> {
  let resolvedValue: string | number | string[] = action.targetValue

  if (action.targetValue === "CURRENT") {
    const supabase = createServiceClient()
    const { data: brandTokens } = await supabase
      .from("brands")
      .select("intelligence_tokens")
      .eq("id", brandId)
      .maybeSingle()
    const tks = (brandTokens?.intelligence_tokens as Record<string, { value: unknown }> | null) ?? {}
    const currentVal = tks[action.tokenKey]?.value
    resolvedValue = currentVal !== undefined
      ? (currentVal as string | number | string[])
      : "conversational"  // safe neutral default when the token doesn't exist yet
  }

  try {
    await nudgeToken(
      brandId,
      action.tokenKey,
      resolvedValue,
      action.delta,
      signalType,
      sourceId,
      detail,
      action.allowCreate,
    )
    return true
  } catch (err) {
    console.error(`resolveAndNudge: nudgeToken failed for brand ${brandId} token "${action.tokenKey}":`, err)
    return false
  }
}
