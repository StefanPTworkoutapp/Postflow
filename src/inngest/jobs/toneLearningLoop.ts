/**
 * Tone learning loop — runs weekly (Monday 07:00 UTC, after trend email).
 *
 * For each brand:
 *   1. Count unapplied tone_feedback rows grouped by feedback_type
 *   2. If any type has 5+ occurrences → generate a suggestion with Claude
 *   3. Store the suggestion on brands.tone_suggestion (we add this column below)
 *   4. Mark those feedback rows as applied_to_future = true
 *
 * The suggestion surfaces in the Brand > Voice tab as a dismissable card.
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { nudgeToken }         from "@/lib/server/brand/nudge-token"
import Anthropic               from "@anthropic-ai/sdk"
import { MODELS }              from "@/lib/ai/models"
import { logAiUsage }          from "@/lib/ai/logUsage"

const FEEDBACK_THRESHOLD = 5

// ── Token adjustment map ───────────────────────────────────────────────────────
// Maps feedback_type → a token nudge instruction.
// These are APPLIED IN ADDITION to the suggestion text, directly updating
// intelligence_tokens so future caption generation is affected immediately.
//
// Feedback signal weight: 0.08 (stronger than analytics 0.04, weaker than calibration 0.20)
// This means: 5 feedbacks = one strong signal; system corrects meaningfully but not abruptly.

const FEEDBACK_DELTA = 0.08
const FEEDBACK_REJECT_DELTA = -0.08  // negative = weaken confidence

interface FeedbackTokenAction {
  tokenKey:  string
  /** Target value — "CURRENT" means keep existing value (only adjust confidence) */
  targetValue: string | "CURRENT"
  delta: number
  /** allowCreate: true = create this token if it doesn't exist yet */
  allowCreate?: boolean
}

const FEEDBACK_TOKEN_MAP: Record<string, FeedbackTokenAction> = {
  // "too_formal" → shift caption_tone toward conversational
  too_formal: {
    tokenKey:    "caption_tone",
    targetValue: "conversational",
    delta:       FEEDBACK_DELTA,
  },
  // "too_casual" → shift caption_tone toward professional
  too_casual: {
    tokenKey:    "caption_tone",
    targetValue: "professional",
    delta:       FEEDBACK_DELTA,
  },
  // "wrong_voice" → reduce confidence on caption_tone (value stays; confidence drops)
  wrong_voice: {
    tokenKey:    "caption_tone",
    targetValue: "CURRENT",
    delta:       FEEDBACK_REJECT_DELTA,
  },
  // "cta_weak" / "weak_cta" → reduce confidence on best_post_goal
  cta_weak: {
    tokenKey:    "best_post_goal",
    targetValue: "CURRENT",
    delta:       FEEDBACK_REJECT_DELTA,
  },
  weak_cta: {
    tokenKey:    "best_post_goal",
    targetValue: "CURRENT",
    delta:       FEEDBACK_REJECT_DELTA,
  },
  // "loved_it" / "great" → reinforce current caption_tone (value unchanged, confidence rises)
  loved_it: {
    tokenKey:    "caption_tone",
    targetValue: "CURRENT",
    delta:       FEEDBACK_DELTA,
  },
  great: {
    tokenKey:    "caption_tone",
    targetValue: "CURRENT",
    delta:       FEEDBACK_DELTA,
  },
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY! })
}

const FEEDBACK_LABELS: Record<string, string> = {
  loved_it:     "loved it",
  too_formal:   "too formal",
  too_casual:   "too casual",
  wrong_voice:  "wrong brand voice",
  weak_cta:     "weak CTA",
}

async function generateToneSuggestion(opts: {
  brandId:      string
  brandName:    string
  currentTone:  string | null
  feedbackType: string
  count:        number
}): Promise<string> {
  const label = FEEDBACK_LABELS[opts.feedbackType] ?? opts.feedbackType
  const msg   = await getAnthropic().messages.create({
    model:      MODELS.toneLoop,
    max_tokens: 250,
    messages: [{
      role:    "user",
      content: `You are a brand voice coach. A social media manager has flagged ${opts.count} recent AI-generated captions as "${label}" for the brand "${opts.brandName}".

Current tone of voice notes: ${opts.currentTone ?? "not specified"}

Write a single short, actionable suggestion (2–3 sentences max) for how to update the brand's tone of voice guidelines to fix this pattern. Be specific and practical. No preamble, no sign-off.`,
    }],
  })
  logAiUsage({ brandId: opts.brandId, model: MODELS.toneLoop, feature: "tone_loop", usage: msg.usage })
  return msg.content[0].type === "text" ? msg.content[0].text.trim() : ""
}

export const toneLearningLoop = inngest.createFunction(
  {
    id:       "tone-learning-loop",
    name:     "Tone Learning Loop",
    triggers: [{ cron: "0 7 * * 1" }],
    concurrency: { limit: 2 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    const brands = await step.run("get-brands", async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name, tone_examples, tone_profile")
      return data ?? []
    })

    const results = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      brands.map((brand: any) =>
        step.run(`tone-loop-${brand.id}`, async () => {
          // Load unapplied feedback for this brand
          const { data: feedbacks } = await supabase
            .from("tone_feedback")
            .select("id, feedback_type")
            .eq("brand_id", brand.id)
            .eq("applied_to_future", false)
            .not("feedback_type", "is", null)

          if (!feedbacks?.length) return { brandId: brand.id, skipped: true }

          // Count by type (exclude "loved_it" — positive feedback doesn't need action)
          const counts = new Map<string, string[]>()
          for (const f of feedbacks) {
            if (!f.feedback_type || f.feedback_type === "loved_it") continue
            const arr = counts.get(f.feedback_type) ?? []
            arr.push(f.id)
            counts.set(f.feedback_type, arr)
          }

          // Find the type that has hit threshold
          const triggered = [...counts.entries()]
            .filter(([, ids]) => ids.length >= FEEDBACK_THRESHOLD)
            .sort((a, b) => b[1].length - a[1].length)

          if (!triggered.length) return { brandId: brand.id, skipped: true, reason: "below threshold" }

          const [feedbackType, feedbackIds] = triggered[0]

          // Build a structured tone summary from tone_profile (NOT tone_examples which are raw posts)
          const tp = brand.tone_profile
          const currentTone = tp
            ? [
                tp.personality_traits?.length ? `Personality: ${tp.personality_traits.join(", ")}` : null,
                tp.tone_level != null ? `Tone level: ${tp.tone_level}/10` : null,
                tp.expertise_level ? `Expertise: ${tp.expertise_level}` : null,
              ].filter(Boolean).join(" · ")
            : null

          const suggestion = await generateToneSuggestion({
            brandId:      brand.id,
            brandName:    brand.name,
            currentTone,
            feedbackType,
            count:        feedbackIds.length,
          })

          if (!suggestion) return { brandId: brand.id, skipped: true, reason: "no suggestion generated" }

          // ── Token nudge — apply feedback as a direct signal to intelligence_tokens ──
          // This closes the feedback → token gap: explicit user feedback now trains
          // the system, not just surfaces a text suggestion for the user to act on.
          let tokenNudged = false
          const action = FEEDBACK_TOKEN_MAP[feedbackType]
          if (action) {
            // Resolve "CURRENT" to the actual current token value
            let resolvedValue: string | number | string[] = action.targetValue
            if (action.targetValue === "CURRENT") {
              const { data: brandTokens } = await supabase
                .from("brands")
                .select("intelligence_tokens")
                .eq("id", brand.id)
                .maybeSingle()
              const tks = (brandTokens?.intelligence_tokens as Record<string, { value: unknown }> | null) ?? {}
              const currentVal = tks[action.tokenKey]?.value
              if (currentVal !== undefined) {
                resolvedValue = currentVal as string | number | string[]
              } else {
                // Token doesn't exist — only create for positive signals
                if (action.delta > 0 && action.allowCreate) {
                  resolvedValue = "conversational"  // safe default for caption_tone
                } else {
                  resolvedValue = "conversational"  // fallback; allowCreate=false prevents write
                }
              }
            }

            try {
              const signalType = action.delta < 0 ? "reject" : "feedback"
              await nudgeToken(
                brand.id,
                action.tokenKey,
                resolvedValue,
                action.delta,
                signalType,
                `tone_feedback_batch_${feedbackType}`,
                {
                  feedback_type:   feedbackType,
                  feedback_count:  feedbackIds.length,
                  batch_processed: new Date().toISOString(),
                },
                action.allowCreate,
              )
              tokenNudged = true
            } catch (nudgeErr) {
              console.error(`[tone-learning-loop] nudgeToken failed for brand ${brand.id}:`, nudgeErr)
              // Non-fatal — suggestion still stored; token nudge is bonus
            }
          }

          // Store suggestion and mark feedbacks as applied
          await Promise.all([
            supabase
              .from("brands")
              .update({
                tone_suggestion:      suggestion,
                tone_suggestion_type: feedbackType,
                tone_suggestion_at:   new Date().toISOString(),
              })
              .eq("id", brand.id),

            supabase
              .from("tone_feedback")
              .update({ applied_to_future: true })
              .in("id", feedbackIds),
          ])

          return {
            brandId: brand.id,
            suggestion,
            feedbackType,
            count:       feedbackIds.length,
            tokenNudged,
          }
        })
      )
    )

    return { success: true, results }
  }
)
