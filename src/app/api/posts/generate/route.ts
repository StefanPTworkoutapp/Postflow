import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { generateCaption } from "@/lib/server/posts/generateCaption"
import { getTemplate } from "@/lib/shared/posts/templates"

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

    const b = brand as unknown as { goals?: string[]; emoji_policy?: string; emoji_favorites?: string }

    // Load performance patterns + this week's trends in parallel (non-fatal if missing)
    const weekStart = (() => {
      const d = new Date()
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      return d.toISOString().split("T")[0]
    })()

    const [perfResult, trendsResult] = await Promise.allSettled([
      supabase
        .from("performance_patterns")
        .select("platform,avg_engagement_rate,best_days_of_week,best_hours_of_day,best_content_pillars,best_post_types,top_hashtags")
        .eq("brand_id", brand.id)
        .eq("platform", platform)
        .maybeSingle(),
      supabase
        .from("niche_trends")
        .select("topic,source,headline")
        .eq("brand_id", brand.id)
        .eq("week_of", weekStart)
        .order("relevance_score", { ascending: false })
        .limit(5),
    ])

    const performance = perfResult.status === "fulfilled" ? perfResult.value.data : null
    const trends      = trendsResult.status === "fulfilled" ? trendsResult.value.data : null

    const result = await generateCaption({
      brand_name:        brand.name,
      industry:          brand.industry ?? "",
      platform,
      template,
      topic:             topic.trim(),
      audience:          brand.target_audience_description ?? undefined,
      goals:             b.goals?.length ? b.goals : brand.primary_goal ? [brand.primary_goal] : null,
      tone_profile:      brand.tone_profile as Parameters<typeof generateCaption>[0]["tone_profile"],
      do_not_mention:    brand.do_not_mention,
      previous_feedback,
      emoji_policy:      (b.emoji_policy as "never" | "sparingly" | "often") ?? "sparingly",
      emoji_favorites:   b.emoji_favorites ?? null,
      performance,
      trends,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
