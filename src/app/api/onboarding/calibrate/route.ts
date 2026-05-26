import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getBrandContext } from "@/lib/server/brand/getBrandContext"
import Anthropic from "@anthropic-ai/sdk"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

/**
 * POST /api/onboarding/calibrate
 *
 * Generates 3 calibration sample posts using brand context:
 *   A — Educational / value-led
 *   B — Brand / trust building
 *   C — Niche-specific trending format
 *
 * Returns:
 *   { posts: CalibrationPost[] }
 */

export interface CalibrationPost {
  id: "A" | "B" | "C"
  type: string
  typeLabel: string
  caption: string
  hashtags: string[]
  explanation: string
}

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

const POST_TYPES: Array<{ id: "A" | "B" | "C"; type: string; typeLabel: string; directive: string }> = [
  {
    id: "A",
    type: "educational",
    typeLabel: "Educational / Value-led",
    directive:
      "Write an educational post that teaches the audience something genuinely useful. Lead with a strong hook, deliver real value, and end with a soft CTA. This post builds authority and trust through expertise.",
  },
  {
    id: "B",
    type: "brand",
    typeLabel: "Brand / Trust Building",
    directive:
      "Write a brand-story post that humanises this business. Share a belief, a behind-the-scenes moment, a result, or a mission statement. This post builds emotional connection and trust.",
  },
  {
    id: "C",
    type: "trending",
    typeLabel: "Niche Trending Format",
    directive:
      "Write a post in a trending format for this niche — e.g. a myth-bust, a hot take, a 'nobody talks about this' reveal, or a list format. The hook must be scroll-stopping. This post maximises reach.",
  },
]

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Parse body first — it may contain brand_id (passed by the wizard)
    // and optional refine instructions.
    const body = await request.json().catch(() => ({})) as {
      brand_id?: string | null
      refine?:   { postId: "A" | "B" | "C"; adjustment: string }
    }

    // Resolve brand: prefer explicit brand_id (wizard always passes it) so
    // we never lose the brand even if getBrand()'s account_id lookup varies
    // between request contexts.
    let brand = null
    if (body.brand_id) {
      const { data } = await supabase
        .from("brands")
        .select("*")
        .eq("id", body.brand_id)
        .eq("account_id", user.id)   // ownership check
        .single()
      brand = data
    }
    if (!brand) brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 })

    const ctx = await getBrandContext(brand.id)
    if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

    // Refine a single post, or generate all 3
    if (body.refine) {
      const def = POST_TYPES.find(p => p.id === body.refine!.postId)
      if (!def) return NextResponse.json({ error: "Unknown post id" }, { status: 400 })

      const post = await generateCalibrationPost(ctx, def, body.refine.adjustment)
      return NextResponse.json({ posts: [post] })
    }

    // Otherwise generate all 3 in parallel
    const posts = await Promise.all(
      POST_TYPES.map(def => generateCalibrationPost(ctx, def, undefined, brand.id))
    )

    return NextResponse.json({ posts })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("POST /api/onboarding/calibrate:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function generateCalibrationPost(
  ctx: Awaited<ReturnType<typeof getBrandContext>> & object,
  def: typeof POST_TYPES[number],
  adjustment?: string,
  brandId?: string,
): Promise<CalibrationPost> {
  const adjustmentLine = adjustment
    ? `\nUSER REQUESTED ADJUSTMENT: ${adjustment}\nAddress this adjustment in the regenerated post.\n`
    : ""

  const prompt = `You are generating a calibration post for PostFlow's First Post Calibration step.

BRAND CONTEXT:
${ctx!.promptBlock}

POST TYPE: ${def.typeLabel}
DIRECTIVE: ${def.directive}
${adjustmentLine}

Write the post. Then explain in 1–2 sentences WHY this format was chosen for this brand specifically.

Return ONLY valid JSON — no explanation outside the JSON:
{
  "caption": "the full caption text",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "explanation": "1-2 sentence explanation of why this format works for this brand"
}`

  const response = await client.messages.create({
    model: MODELS.calibration,
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
  })
  logAiUsage({ brandId: brandId ?? null, model: MODELS.calibration, feature: "calibration", usage: response.usage })

  const raw   = response.content[0].type === "text" ? response.content[0].text : ""
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()

  let parsed: { caption: string; hashtags: string[]; explanation: string }
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`Failed to parse Claude response for post ${def.id}: ${clean.slice(0, 200)}`)
  }

  return {
    id:          def.id,
    type:        def.type,
    typeLabel:   def.typeLabel,
    caption:     parsed.caption,
    hashtags:    parsed.hashtags,
    explanation: parsed.explanation,
  }
}
