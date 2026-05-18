import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getBrandContext } from "@/lib/server/brand/getBrandContext"
import { generateCaption } from "@/lib/server/posts/generateCaption"
import { getTemplate } from "@/lib/shared/posts/templates"
import { getModels, brandTier } from "@/lib/ai/models"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await request.json()
    const { template_id, platform, topic, previous_feedback } = body

    if (!template_id || !platform || !topic?.trim()) {
      return NextResponse.json({ error: "template_id, platform, and topic are required" }, { status: 400 })
    }

    const template = getTemplate(template_id)
    if (!template) return NextResponse.json({ error: "Unknown template" }, { status: 400 })

    // Single source of truth for brand context — includes performance + trends
    const ctx = await getBrandContext(brand.id, platform)
    if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

    const models = getModels(brandTier(brand as { ai_tier?: string | null }))

    const result = await generateCaption({
      brand_name:        ctx.brand_name,
      industry:          ctx.industry,
      platform,
      template,
      topic:             topic.trim(),
      audience:          ctx.audience ?? undefined,
      goals:             ctx.goals,
      tone_profile:      ctx.tone_profile,
      do_not_mention:    ctx.do_not_mention,
      previous_feedback,
      emoji_policy:      ctx.emoji_policy,
      emoji_favorites:   ctx.emoji_favorites,
      performance:       ctx.performance,
      trends:            ctx.trends,
      model:             models.caption,
      brand_id:          brand.id,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
