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
import Anthropic               from "@anthropic-ai/sdk"
import { MODELS }              from "@/lib/ai/models"
import { logAiUsage }          from "@/lib/ai/logUsage"

const FEEDBACK_THRESHOLD = 5

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
      brands.map((brand: { id: string; name: string; tone_examples: string[] | null; tone_profile: unknown }) =>
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

          // Build a plain-text summary of the brand's current tone notes
          const currentTone = brand.tone_examples?.join("; ") ?? null

          const suggestion = await generateToneSuggestion({
            brandId:      brand.id,
            brandName:    brand.name,
            currentTone,
            feedbackType,
            count:        feedbackIds.length,
          })

          if (!suggestion) return { brandId: brand.id, skipped: true, reason: "no suggestion generated" }

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
            count: feedbackIds.length,
          }
        })
      )
    )

    return { success: true, results }
  }
)
