import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getBrandContext } from "@/lib/server/brand/getBrandContext"
import type { Json } from "@/types/database.types"

/**
 * POST /api/posts/[id]/convert-format
 *
 * Converts the existing caption/content of a post into a new template format.
 * Used when the user switches templates (e.g. single image → carousel).
 *
 * Body: { templateSlug: string }
 *
 * Returns: { slide_content: SlideContentItem[] } for carousel templates,
 *          or { caption: string } adjustments for single-image formats.
 */

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

export const runtime    = "nodejs"
export const maxDuration = 30

interface SlideContentItem {
  headline:  string
  body?:     string
  is_hook?:  boolean
  is_cta?:   boolean
}

function robustJsonParse(raw: string): SlideContentItem[] {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
  try { return JSON.parse(clean) } catch {}
  // Try to fix common JSON issues (unescaped newlines in strings)
  let inString = false, escaped = false, out = ""
  for (const ch of clean) {
    if (escaped) { out += ch; escaped = false; continue }
    if (ch === "\\" && inString) { out += ch; escaped = true; continue }
    if (ch === '"') { inString = !inString; out += ch; continue }
    if (inString && (ch === "\n" || ch === "\r")) { out += "\\n"; continue }
    out += ch
  }
  return JSON.parse(out) as SlideContentItem[]
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const brand = await getBrand()
  if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

  const { templateSlug } = await req.json() as { templateSlug: string }
  if (!templateSlug) return NextResponse.json({ error: "templateSlug required" }, { status: 400 })

  // Load current post content (including slide_content for carousel → single conversion)
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, platform, caption, hashtags, cta, template_slug, slide_content")
    .eq("id", postId)
    .eq("brand_id", brand.id)
    .maybeSingle()

  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

  const caption      = post.caption ?? ""
  const cta          = post.cta     ?? ""
  const isCarouselEdu  = templateSlug === "carousel-edu"
  const isCarouselMyth = templateSlug === "carousel-myth"
  const isCarousel     = isCarouselEdu || isCarouselMyth
  const prevIsCarousel = ["carousel-edu", "carousel-myth"].includes(post.template_slug ?? "")

  // Single source of truth for brand context
  const ctx = await getBrandContext(brand.id)
  if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

  // ── Carousel → single-image: flatten slides back into a caption ──────────────
  if (!isCarousel && prevIsCarousel) {
    const slides = post.slide_content as SlideContentItem[] | null
    if (!slides?.length) {
      // No slides to convert — just update template_slug
      await supabase.from("posts").update({ template_slug: templateSlug }).eq("id", postId)
      return NextResponse.json({ converted: false })
    }

    const slideSummary = slides
      .map(s => [s.headline, s.body].filter(Boolean).join(" — "))
      .join("\n")

    const flattenPrompt = `You are a social media copywriter. Convert these carousel slides into a single cohesive Instagram/LinkedIn post caption.

BRAND: ${ctx.brand_name}
${ctx.tone_summary ? `TONE: ${ctx.tone_summary}` : ""}
PLATFORM: ${post.platform}

CAROUSEL SLIDES:
${slideSummary}

TASK: Write a single flowing caption that covers the same points naturally.
- Open with a strong hook (first slide headline adapted)
- Cover the key points in a natural flow, not as a numbered list unless that fits the platform
- End with a CTA
- Match the brand tone
- ${post.platform === "instagram" ? "2–5 short paragraphs" : "Professional prose, 150–300 words"}

Return JSON: { "caption": "...", "hashtags": ["tag1", "tag2"], "cta": "..." }
No markdown, no explanation.`

    let result: { caption: string; hashtags: string[]; cta: string }
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5", max_tokens: 1024,
        messages: [{ role: "user", content: flattenPrompt }],
      })
      const raw = message.content[0].type === "text" ? message.content[0].text : "{}"
      const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
      result = JSON.parse(clean)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI error"
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    await supabase.from("posts")
      .update({ template_slug: templateSlug, caption: result.caption, cta: result.cta ?? null })
      .eq("id", postId)

    return NextResponse.json({ converted: true, caption: result.caption, hashtags: result.hashtags ?? [], cta: result.cta ?? "" })
  }

  // ── Single-image → single-image: just swap visual style, no AI needed ────────
  if (!isCarousel && !prevIsCarousel) {
    await supabase.from("posts").update({ template_slug: templateSlug }).eq("id", postId)
    return NextResponse.json({ converted: false })
  }

  // ── → Carousel: convert caption (or existing slides) to new carousel format ──
  if (!caption.trim()) {
    return NextResponse.json({ error: "No caption to convert" }, { status: 400 })
  }

  const prompt = isCarouselEdu
    ? `You are a social media expert. Convert this existing post caption into slide content for an educational Instagram/LinkedIn carousel.

BRAND: ${ctx.brand_name}
${ctx.tone_summary ? `TONE: ${ctx.tone_summary}` : ""}
PLATFORM: ${post.platform}

EXISTING CAPTION:
${caption}

CTA: ${cta || "Save this for later!"}

TASK: Break this caption into 5–7 carousel slides:
- Slide 1: Hook (is_hook: true) — one bold opening claim or question that makes people stop. Max 12 words.
- Slides 2–5: Content slides — one key point each. headline = the point (6–12 words), body = 1–2 sentences expanding on it.
- Last slide: CTA (is_cta: true) — one action. Use the CTA above if it fits.

Rules:
- Extract the SUBSTANCE from the caption — don't make things up
- Keep the same tone and voice as the original
- Headlines must be punchy — no full sentences, no numbering
- Body text max 2 sentences
- Return ONLY a JSON array, no markdown, no explanation

Format:
[
  { "headline": "...", "is_hook": true },
  { "headline": "...", "body": "..." },
  { "headline": "...", "is_cta": true }
]`

    : `You are a social media expert. Convert this existing post caption into slide content for a Myth vs Reality Instagram carousel.

BRAND: ${ctx.brand_name}
${ctx.tone_summary ? `TONE: ${ctx.tone_summary}` : ""}
PLATFORM: ${post.platform}

EXISTING CAPTION:
${caption}

CTA: ${cta || "Save this so you never fall for these myths again."}

TASK: Identify 2–3 myth/reality pairs from the caption content:
- Slide 1: Hook (is_hook: true) — bold teaser that frames the myth-busting. Max 12 words.
- Myth slides: Write the myth as people commonly say/believe it
- Reality slides: Write the corrected truth directly after each myth
- Last slide: CTA (is_cta: true)

If the caption doesn't contain clear myths, infer common misconceptions related to the topic that a professional in this field would bust.

Return ONLY a JSON array:
[
  { "headline": "...", "is_hook": true },
  { "headline": "MYTH: ...", "body": "Why people believe this" },
  { "headline": "REALITY: ...", "body": "The truth" },
  { "headline": "...", "is_cta": true }
]`

  let slideContent: SlideContentItem[]
  try {
    const message = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    })
    const raw = message.content[0].type === "text" ? message.content[0].text : "[]"
    slideContent = robustJsonParse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error"
    console.error("[convert-format] AI error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (!Array.isArray(slideContent) || slideContent.length === 0) {
    return NextResponse.json({ error: "AI returned empty slides" }, { status: 500 })
  }

  // Persist slide_content + new template_slug to the post
  await supabase
    .from("posts")
    .update({
      template_slug: templateSlug,
      slide_content: slideContent as unknown as Json,
    })
    .eq("id", postId)

  return NextResponse.json({ converted: true, slide_content: slideContent })
}
