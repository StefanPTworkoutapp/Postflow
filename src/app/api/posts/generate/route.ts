import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getBrandContext } from "@/lib/server/brand/getBrandContext"
import { generateCaption } from "@/lib/server/posts/generateCaption"
import { getTemplate } from "@/lib/shared/posts/templates"
import { brandTier } from "@/lib/ai/models"
import { getBudgetAwareModels } from "@/lib/server/billing/aiBudget"
import { createServiceClient } from "@/lib/supabase/service"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await request.json()
    const { template_id, platform, topic, previous_feedback, target_language, post_type } = body

    if (!template_id || !platform || !topic?.trim()) {
      return NextResponse.json({ error: "template_id, platform, and topic are required" }, { status: 400 })
    }

    // Look up the caption template. For reel/story types that have no dedicated
    // caption template, fall back to the best-matching alternative so the type guidance
    // still gets applied via the post_type field below.
    const template = getTemplate(template_id) ?? getTemplate("edu-tips")!
    if (!template) return NextResponse.json({ error: "Unknown template" }, { status: 400 })

    // Single source of truth for brand context — includes performance + trends
    const ctx = await getBrandContext(brand.id, platform)
    if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

    // Budget-aware model selection (P5): forces economy models once the
    // brand's account has crossed its monthly AI spend cap — never blocks
    // user-facing generation outright. See src/lib/server/billing/aiBudget.ts.
    const service = createServiceClient()
    const { data: account } = await service
      .from("accounts")
      .select("subscription_tier")
      .eq("id", (brand as { account_id: string }).account_id)
      .maybeSingle()

    const { models } = await getBudgetAwareModels({
      accountId:   (brand as { account_id: string }).account_id,
      plan:        account?.subscription_tier ?? "free",
      brandAiTier: brandTier(brand as { ai_tier?: string | null }),
    })

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
      tone_examples:     ctx.tone_examples,
      custom_do_rules:   ctx.custom_do_rules,
      custom_dont_rules: ctx.custom_dont_rules,
      model:             models.caption,
      brand_id:          brand.id,
      // Language override — when set and different from brand's content_language,
      // the caption will be generated in the requested language
      target_language:   typeof target_language === "string" ? target_language : undefined,
      // Content-type guidance — triggers reel/story/carousel-specific prompt blocks
      post_type:         typeof post_type === "string" ? post_type : undefined,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
