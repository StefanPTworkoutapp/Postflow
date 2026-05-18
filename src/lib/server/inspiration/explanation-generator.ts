/**
 * explanation-generator — Converts raw token signals into a human-readable
 * "How we'll apply it" explanation for the inspiration results screen.
 *
 * Kept separate from analyse-post.ts so it can be independently tested
 * and so the explanation prompt can evolve without touching signal extraction.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { BrandContext }      from "@/lib/server/brand/getBrandContext"
import type { InspirationSignal } from "./analyse-post"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

const claude = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

/**
 * Generate a plain-language explanation of how the extracted signals
 * will be applied to the brand's token profile.
 *
 * @param signals    The signals extracted by analyseInspirationPost()
 * @param brand      Full brand context (for tone, niche, name)
 * @returns          A 2–4 sentence plain-English explanation
 */
export async function generateInspirationExplanation(
  signals:  InspirationSignal[],
  brand:    BrandContext,
  brandId?: string | null,
): Promise<string> {
  if (signals.length === 0) {
    return "No specific patterns were strong enough to apply to your brand profile — but the analysis has been saved for reference."
  }

  const signalList = signals
    .map(s => `• ${s.token_key}: set to "${s.value}" — ${s.observed_pattern}`)
    .join("\n")

  const prompt = `You are PostFlow, a friendly AI content assistant. A user just analysed an inspiring ${brand.industry} post.

Brand: ${brand.brand_name}
Niche: ${brand.niche ?? brand.industry}

The following brand intelligence signals were detected from the inspiration post:
${signalList}

Write a 2–4 sentence plain-English explanation of how PostFlow will apply these learnings to ${brand.brand_name}'s future content.

Rules:
- Address the user directly ("We'll…" / "Your next…" / "PostFlow will…")
- Be specific — mention at least one token change by its friendly name (not the key name)
- Keep it encouraging and concrete — not vague platitudes
- No markdown, no bullet points — flowing prose only
- Do NOT use jargon like "token" or "confidence delta" — speak like a creative director`

  const message = await claude.messages.create({
    model:      MODELS.explanations,
    max_tokens: 256,
    messages:   [{ role: "user", content: prompt }],
  })
  logAiUsage({ brandId: brandId ?? null, model: MODELS.explanations, feature: "explanation", usage: message.usage })

  const text = message.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("")
    .trim()

  return text || "These patterns have been noted and will shape how PostFlow generates your next videos and carousels."
}
