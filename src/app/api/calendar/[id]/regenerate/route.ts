import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getBrandContext } from "@/lib/server/brand/getBrandContext"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"
import type { Json, Database } from "@/types/database.types"

type CalendarUpdate = Database["postflow"]["Tables"]["content_calendar"]["Update"]

/**
 * POST /api/calendar/[id]/regenerate
 *
 * Re-generates the topic, media_brief, slide_content, and template_slug
 * for a single calendar entry using Claude. Keeps the date, platform,
 * post_type, and content_pillar unchanged — only replaces the idea itself.
 *
 * Body: { feedback?: string }  — optional hint ("more engaging", "focus on injury prevention", etc.)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  // Load the entry to regenerate
  const { data: entry } = await supabase
    .from("content_calendar")
    .select("id, brand_id, scheduled_date, platforms, post_type, content_pillar, goal, required_media_type, required_media_count, topic, media_brief, template_slug")
    .eq("id", id)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let feedback = ""
  try {
    const body = await req.json()
    feedback = body?.feedback ?? ""
  } catch { /* no body */ }

  const platform    = (entry.platforms as string[] | null)?.[0] ?? "instagram"
  const postType    = entry.post_type    ?? "single_image"
  const pillar      = entry.content_pillar ?? "education"
  const mediaType   = entry.required_media_type ?? "photo"
  const isCarousel  = postType === "carousel"
  const slideCount  = entry.required_media_count ?? 5
  const dateStr     = entry.scheduled_date

  // Single source of truth for brand context — includes performance + trends
  const ctx = await getBrandContext(brand.id, platform)
  if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

  const templateMap: Record<string, string> = {
    "single_image:education":  "edu-bold",
    "single_image:motivation": "quote-card",
    "single_image:community":  "edu-bold",
    "single_image:promotional":"dark-statement",
    "carousel:education":      "carousel-edu",
    "carousel:motivation":     "carousel-edu",
    "carousel:community":      "carousel-edu",
    "carousel:promotional":    "carousel-myth",
    "reel:":                   "reel-cover",
    "story:":                  "story-teaser",
  }
  const suggestedTemplate = templateMap[`${postType}:${pillar}`] ?? entry.template_slug ?? null

  const prompt = `You are an expert social media strategist. Generate ONE fresh post idea to replace an existing calendar entry.

${ctx.promptBlock}

FIXED (do not change these):
- Date: ${dateStr}
- Platform: ${platform}
- Post type: ${postType}
- Content pillar: ${pillar}
- Media type: ${mediaType}
${isCarousel ? `- Slide count: ${slideCount}` : ""}

CURRENT IDEA (replace this with something different):
${entry.topic ?? "No topic set"}

${feedback ? `USER FEEDBACK: ${feedback}` : "Just generate a fresh, different idea."}

RULES:
- Topic must be SPECIFIC — not generic. Bad: "workout tips". Good: "Why your glutes aren't activating during squats (and how to fix it in 3 moves)"
- Media brief: short, direct, actionable. Max 20 words. Tell them exactly what to shoot/source.
- For "photo" media type: describe a real, photographable moment the brand owner can capture.
- For "stock": describe exactly what to search online.
${isCarousel ? `- Generate slide_content array with exactly ${slideCount} items. First is is_hook:true, last is is_cta:true.` : ""}

Return ONLY valid JSON (no markdown, no explanation):
{
  "topic": "specific post idea",
  "media_brief": "short brief for the visual",
  "template_slug": "${suggestedTemplate ?? "edu-bold"}"${isCarousel ? `,
  "slide_content": [
    { "headline": "...", "is_hook": true },
    { "headline": "...", "body": "..." },
    { "headline": "...", "is_cta": true }
  ]` : ""}
}`

  let result: { topic: string; media_brief: string; template_slug?: string; slide_content?: unknown[] }
  try {
    const anthropic = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY! })
    const msg = await anthropic.messages.create({
      model:      MODELS.calendarRegen,
      max_tokens: 800,
      messages:   [{ role: "user", content: prompt }],
    })
    logAiUsage({ brandId: brand.id, model: MODELS.calendarRegen, feature: "calendar_regen", usage: msg.usage })
    const raw   = msg.content[0].type === "text" ? msg.content[0].text : ""
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
    result = JSON.parse(clean)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error"
    return NextResponse.json({ error: `Regeneration failed: ${msg}` }, { status: 500 })
  }

  // Update the entry in the DB
  const updates: CalendarUpdate = {
    topic:         result.topic ?? entry.topic,
    media_brief:   result.media_brief ?? entry.media_brief,
    template_slug: result.template_slug ?? suggestedTemplate,
    status:        "planned",  // reset status — media + post need redoing
    ...(isCarousel && Array.isArray(result.slide_content)
      ? { slide_content: result.slide_content as Json }
      : {}),
  }

  const { data: updated, error: updateErr } = await supabase
    .from("content_calendar")
    .update(updates)
    .eq("id", id)
    .select("id, scheduled_date, platforms, topic, content_pillar, post_type, goal, required_media_type, required_media_count, media_brief, media_urls, template_slug, slide_content, status")
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  return NextResponse.json({ entry: updated })
}
