/**
 * Tone learning loop — runs weekly (Monday 07:00 UTC, after trend email).
 *
 * For each brand:
 *   1. Count unapplied tone_feedback rows grouped by feedback_type
 *   2. If any type has 3+ occurrences → generate a suggestion with Claude
 *   3. Store the suggestion on brands.tone_suggestion (we add this column below)
 *   4. Mark those feedback rows as applied_to_future = true
 *
 * The suggestion surfaces in the Brand > Voice tab as a dismissable card.
 *
 * ── P1 changes (2026-07-14) ─────────────────────────────────────────────────
 * Threshold dropped 5 → 3 (both for the suggestion text AND the token nudge)
 * so the loop reacts faster. To make a single correction matter even before
 * hitting the batch threshold, POST /api/posts/[id]/feedback now applies an
 * immediate HALF-delta nudge per row at write time (see
 * feedbackTokenMaps.ts::TONE_FEEDBACK_IMMEDIATE_DELTA).
 *
 * DOUBLE-COUNTING GUARD: because rows may already carry their own immediate
 * nudge, this batch job must not blindly re-apply a full delta on top. The
 * rule: only rows where immediate_nudge_applied = false still need a nudge
 * from here (their immediate nudge never landed — write-time failure, or the
 * feature was off when they were created). If EVERY triggered row already
 * got its immediate nudge, this loop skips the token nudge entirely (the
 * signal was already applied) but still generates + stores the suggestion
 * text, since that's independent of the token math. If SOME rows are
 * unnudged, we apply exactly one catch-up nudge at the immediate (half)
 * delta — not the full batch delta — since a full delta on top of any
 * already-applied immediate deltas would over-correct.
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import Anthropic               from "@anthropic-ai/sdk"
import { MODELS }              from "@/lib/ai/models"
import { logAiUsage }          from "@/lib/ai/logUsage"
import {
  TONE_FEEDBACK_TOKEN_MAP as FEEDBACK_TOKEN_MAP,
  TONE_FEEDBACK_IMMEDIATE_DELTA,
  resolveAndNudge,
} from "@/lib/server/brand/feedbackTokenMaps"

const FEEDBACK_THRESHOLD = 3

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: feedbacks } = await (supabase as any)
            .from("tone_feedback")
            .select("id, feedback_type, immediate_nudge_applied")
            .eq("brand_id", brand.id)
            .eq("applied_to_future", false)
            .not("feedback_type", "is", null)

          if (!feedbacks?.length) return { brandId: brand.id, skipped: true }

          // Count by type (exclude "loved_it" — positive feedback doesn't need action)
          interface FeedbackRow { id: string; feedback_type: string; immediate_nudge_applied: boolean }
          const counts = new Map<string, FeedbackRow[]>()
          for (const f of feedbacks as FeedbackRow[]) {
            if (!f.feedback_type || f.feedback_type === "loved_it") continue
            const arr = counts.get(f.feedback_type) ?? []
            arr.push(f)
            counts.set(f.feedback_type, arr)
          }

          // Find the type that has hit threshold
          const triggered = [...counts.entries()]
            .filter(([, rows]) => rows.length >= FEEDBACK_THRESHOLD)
            .sort((a, b) => b[1].length - a[1].length)

          if (!triggered.length) return { brandId: brand.id, skipped: true, reason: "below threshold" }

          const [feedbackType, feedbackRows] = triggered[0]
          const feedbackIds = feedbackRows.map(r => r.id)

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
          //
          // Double-counting guard (see file header): rows may already carry their own
          // immediate half-delta nudge from the feedback route. Only rows where that
          // never landed (immediate_nudge_applied = false) still need a nudge from here,
          // and even then we apply the HALF delta (catch-up), never the full batch delta —
          // applying full on top of any already-applied immediate deltas would double-count.
          let tokenNudged = false
          let tokenNudgeSkippedReason: string | null = null
          const action = FEEDBACK_TOKEN_MAP[feedbackType]
          const unnudgedRows = feedbackRows.filter(r => !r.immediate_nudge_applied)

          if (action && unnudgedRows.length > 0) {
            const catchUpAction = { ...action, delta: Math.sign(action.delta) * TONE_FEEDBACK_IMMEDIATE_DELTA }
            const signalType = action.delta < 0 ? "reject" : "feedback"
            const ok = await resolveAndNudge(
              brand.id,
              catchUpAction,
              signalType,
              `tone_feedback_batch_catchup_${feedbackType}`,
              {
                feedback_type:  feedbackType,
                feedback_count: feedbackIds.length,
                catchup_count:  unnudgedRows.length,
                batch_processed: new Date().toISOString(),
              },
            )
            tokenNudged = ok
            if (ok) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any)
                .from("tone_feedback")
                .update({ immediate_nudge_applied: true })
                .in("id", unnudgedRows.map(r => r.id))
            }
          } else if (action) {
            tokenNudgeSkippedReason = "all rows already carried an immediate nudge — skipping to avoid double-counting"
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
            tokenNudgeSkippedReason,
          }
        })
      )
    )

    return { success: true, results }
  }
)
