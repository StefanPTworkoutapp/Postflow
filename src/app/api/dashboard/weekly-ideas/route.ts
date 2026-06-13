/**
 * GET /api/dashboard/weekly-ideas?brandId=xxx
 *
 * Generates 3 actionable social media post ideas for the current week,
 * tailored to the brand's voice and goals via Claude.
 *
 * Response: { ideas: Array<{ hook, format, platform, reason }> }
 */

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getBrand } from "@/lib/server/brand/getBrand"
import { logAiUsage } from "@/lib/ai/logUsage"
import { MODELS } from "@/lib/ai/models"

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

export interface WeeklyIdea {
  hook:     string
  format:   string
  platform: string
  reason:   string
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const brand = await getBrand()

    if (!brand) {
      return NextResponse.json({ error: "No brand found" }, { status: 401 })
    }

    // Extract tone description from tone_profile JSON if available
    const toneProfile = brand.tone_profile as Record<string, unknown> | null
    const toneAdjectives = toneProfile?.tone_adjectives
      ? (toneProfile.tone_adjectives as string[]).slice(0, 3).join(", ")
      : null
    const toneSummary = toneAdjectives ?? (toneProfile?.summary as string | undefined) ?? brand.tone_suggestion ?? "professional"

    // Pull extra brand context that makes ideas more specific
    const tagline    = (brand as unknown as Record<string, unknown>).tagline as string | undefined
    const audience   = (brand as unknown as Record<string, unknown>).target_audience_description as string | undefined
    const geoLine    = (brand as unknown as Record<string, unknown>).geographic_location as string | undefined

    const prompt = `You are a social media strategist for a specific brand. Generate ideas that feel personal to THIS brand, not generic industry advice.

Brand: ${brand.name}
${tagline ? `Tagline: ${tagline}` : ""}
Industry: ${brand.industry ?? "General"}
Primary goal: ${brand.primary_goal ?? "Grow audience"}
Voice / tone: ${toneSummary}
${audience ? `Target audience: ${audience}` : ""}
${geoLine ? `Location: ${geoLine}` : ""}

Suggest 3 specific, actionable post ideas for this week that feel tailored to this exact brand — not generic fitness/wellness/PT tips.
Each idea: hook (max 10 words — make it specific to the brand, not a template), format (Reel/Carousel/Single/Story), platform (Instagram/LinkedIn/Facebook), why it works for THIS brand (1 sentence, mention specific brand details).
Return as JSON array with keys: hook, format, platform, reason.
Only return the JSON array, no other text.`

    const message = await client.messages.create({
      model:      MODELS.calendarRegen,
      max_tokens: 512,
      messages:   [{ role: "user", content: prompt }],
    })

    // Log usage (non-blocking)
    logAiUsage({
      brandId: brand.id,
      model:   MODELS.calendarRegen,
      feature: "weekly_ideas",
      usage:   message.usage,
    })

    // Parse Claude's JSON response
    const rawText = message.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()

    let ideas: WeeklyIdea[]
    try {
      // Strip any accidental markdown code fences
      const clean = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      ideas = JSON.parse(clean)
    } catch {
      console.error("[weekly-ideas] Failed to parse Claude response:", rawText)
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
    }

    if (!Array.isArray(ideas) || ideas.length === 0) {
      return NextResponse.json({ error: "No ideas returned" }, { status: 500 })
    }

    return NextResponse.json({ ideas: ideas.slice(0, 3) })
  } catch (err) {
    console.error("[weekly-ideas] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
