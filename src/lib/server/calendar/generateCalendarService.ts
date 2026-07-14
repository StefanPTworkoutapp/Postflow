/**
 * generateCalendarService — shared business logic for monthly calendar
 * generation. Called from BOTH:
 *   - src/inngest/jobs/generateCalendarJob.ts   (background job — the real path)
 *   - (never directly from the route — the route only enqueues)
 *
 * Extracted from the old synchronous /api/calendar/generate route (P4,
 * 2026-07-14) so the one Claude call that can take 20-60s for a whole month
 * never blocks an HTTP request. See docs/features/calendar-generation-jobs.md.
 *
 * Takes a Supabase client so it works with either the service-role client
 * (Inngest, no user session) — callers own auth/ownership checks before
 * invoking this.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/database.types"
import { getBrandContext } from "@/lib/server/brand/getBrandContext"
import { selectTemplate } from "@/lib/server/render/selectTemplate"
import { brandTier } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"
import { getBudgetAwareModels } from "@/lib/server/billing/aiBudget"

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

export interface GenerateCalendarInput {
  year:               number
  month:              number
  platforms:          string[]
  pillars:            string[]
  frequencyOverrides: Record<string, number>
  shootingFrequency?: "weekly" | "monthly"
}

export interface GenerateCalendarResult {
  count:   number
  summary: Record<string, number>
  entries: Array<{ id: string; scheduled_date: string; topic: string; content_pillar: string; platforms: string[]; status: string }>
}

interface SlideContentItem {
  headline:  string
  body?:     string
  is_hook?:  boolean
  is_cta?:   boolean
}

interface CalendarSuggestion {
  date:                string
  platform:            string
  topic:               string
  content_pillar:      string
  goal:                string
  post_type?:          string
  required_media_type?: string
  slide_count?:        number
  media_brief?:        string
  template_slug?:      string
  slide_content?:      SlideContentItem[]
}

function robustJsonParse(raw: string): CalendarSuggestion[] {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
  try { return JSON.parse(clean) } catch {}
  let inString = false, escaped = false, out = ""
  for (const ch of clean) {
    if (escaped) { out += ch; escaped = false; continue }
    if (ch === "\\" && inString) { out += ch; escaped = true; continue }
    if (ch === '"') { inString = !inString; out += ch; continue }
    if (inString && (ch === "\n" || ch === "\r")) { out += "\\n"; continue }
    out += ch
  }
  return JSON.parse(out) as CalendarSuggestion[]
}

const PLATFORM_DEFAULTS: Record<string, number> = {
  instagram: 4,
  linkedin:  2,
  facebook:  3,
  tiktok:    5,
  x:         4,
  threads:   3,
}

function defaultFrequency(platform: string): number {
  return PLATFORM_DEFAULTS[platform] ?? 3
}

/**
 * Generates a month of calendar suggestions for a brand and inserts them
 * into content_calendar. Throws on hard failure — callers (the Inngest job)
 * catch and write job.status = 'failed' + job.error.
 */
export async function generateCalendarForBrand(
  supabase: SupabaseClient<Database>,
  brand:    { id: string; ai_tier?: string | null; account_id: string },
  input:    GenerateCalendarInput,
): Promise<GenerateCalendarResult> {
  const { year, month, platforms, pillars, frequencyOverrides = {}, shootingFrequency = "weekly" } = input

  if (!platforms?.length) throw new Error("Select at least one platform")

  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const to   = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "long" })
  const today = new Date().toISOString().split("T")[0]

  const { data: existing } = await supabase
    .from("content_calendar")
    .select("scheduled_date")
    .eq("brand_id", brand.id)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
  const occupiedDates = new Set((existing ?? []).map(e => e.scheduled_date))

  const ctx = await getBrandContext(brand.id)
  if (!ctx) throw new Error("Brand context unavailable")

  const prompt = `You are an expert social media strategist. Plan a content calendar for ${monthName} ${year}.

Today's date: ${today}. All generated post dates MUST fall within ${from} to ${to}.
Consider what is seasonally relevant, culturally timely, and topically fresh for ${monthName} ${year} specifically.
Topics that worked well last month should be approached from a fresh angle this month.

${ctx.promptBlock}

PLATFORMS TO USE: ${platforms.join(", ")}

CONTENT PILLARS TO COVER: ${pillars.join(", ")}

POSTING FREQUENCY (chosen by user — follow exactly):
${platforms.map(p => `- ${p}: ${frequencyOverrides[p] ?? defaultFrequency(p)}×/week`).join("\n")}

SHOOTING SCHEDULE: ${shootingFrequency === "monthly"
  ? `MONTHLY BATCH — the brand shoots all media in ONE session per month.
- Group all photo/video posts so their media briefs reference the SAME shoot session.
- Cluster similar shots together (e.g. "same clinic shoot", "same outdoor shoot").
- Maximise reuse: if two posts need a 'photo at your desk', that's one setup, not two.
- Spread the resulting posts across the month, but the media belongs to one shoot.
- In every media_brief, note "from same batch shoot as [other topic]" when applicable.`
  : `WEEKLY SHOOTS — the brand shoots fresh media each week.
- Spread media requirements evenly so each week has its own distinct shoot.
- Avoid clustering all photo/video posts in the same week.
- Each week's content should feel visually distinct (different locations or setups).`
}

POST TYPE GUIDANCE PER PLATFORM:
- instagram: educational carousels, motivational quotes, myth-busting, behind-the-scenes
- linkedin: thought leadership, case studies, professional insights — quality over quantity
- facebook: community-focused, longer form, link shares
- tiktok: short punchy hooks, trends, quick tips
- threads: conversational, opinions, quick thoughts
- x: short sharp takes, engagement-bait questions

RULES:
- Spread posts evenly across the month — no bunching
- Avoid weekends for LinkedIn (Mon–Fri only)
- Instagram and TikTok can post any day
- Vary post types: myth-busting, how-to, client FAQ, quick tip, stat/fact, personal story angle, before/after concept
- Topics must be SPECIFIC, in THIS brand's own niche (${ctx.niche ?? ctx.industry ?? "their niche"}) — not generic category tips.
  Examples of the level of specificity required (illustrative only — write your own topic in the brand's actual niche):
    fitness: "Why your hip flexors are causing your lower back pain"
    food/restaurant: "The 90-second mistake that makes your pasta water taste flat"
    professional services: "The one line in your contract clients always skip — and why it costs you"
- Each day should have at most one post per platform
- Skip these already-occupied dates: ${[...occupiedDates].join(", ") || "none"}

CONTENT PILLAR DEFINITIONS:
- education: teach anatomy, technique, common mistakes, myth-busting
- motivation: mindset, consistency, transformation stories
- community: Q&A, polls, behind-the-scenes, client shoutouts
- promotional: services, results, testimonials, booking CTAs

MEDIA TYPE RULES — this determines what content the brand owner needs to provide:

"photo" → a personal photo they shoot themselves.
  Use for: behind-the-scenes, clinic shots, portraits, before/after (real people), personal moments.
  NEVER use for: anatomy diagrams, scientific illustrations, anything they can't easily photograph.
  Brief: one sentence — what to shoot, where, how. Max 15 words.
  Example brief: "Photo of you at your desk, relaxed, natural light — warm and approachable."

"video" → a short personal video/reel they film themselves.
  Use for: exercise demos, talking to camera, Q&A, day-in-the-life, client shoutout (muted).
  Brief: what to film + duration. Max 20 words.
  Example briefs (illustrative — write one that fits THIS brand's niche):
    fitness: "30s reel: film yourself demonstrating the hip flexor stretch, no talking, text overlay with step names."
    food: "20s reel: overhead shot plating the dish step by step, text overlay naming each step."
    professional services: "25s reel: talking-head explaining the one contract clause clients miss, text overlay with the key phrase."

"carousel" → multiple slides the brand owner uploads; the app assembles into a branded carousel using the brand template.
  Use for: how-to steps, myth-busting, tips lists, before/after sequences, case study walkthroughs.
  Also set slide_count (3–8).
  Brief: describe each slide's content in one line each — what image/photo goes on each slide, or if a slide is text-only.
  Example brief: "5 slides — 1: hook photo of you at clinic. 2–4: one myth per slide, text only. 5: photo of you with booking CTA."
  Personal photos go on human-focused slides. Text-only slides need no upload. Stock/anatomy goes in stock type instead.

"stock" → visual content that must be sourced online (NOT personal). Use ONLY when the content genuinely cannot be a personal photo.
  Use for: anatomy diagrams, medical illustrations, scientific charts, specific equipment shots.
  Brief: describe exactly what to search for online. Max 20 words.
  Example briefs (illustrative — write one that fits THIS brand's niche):
    fitness: "Search: 'hip flexor anatomy diagram' — clean medical illustration showing psoas and iliacus muscles."
    food: "Search: 'fresh basil pesto ingredients flat lay' — clean overhead shot, natural light."
    professional services: "Search: 'contract review checklist icon set' — clean flat-style business icons."

"none" → text-only. No visual.
  Use for: LinkedIn thought leadership, X/Threads takes, opinion pieces, polls, pure text posts.

IMPORTANT DEFAULTS:
- Most instagram and tiktok posts should be "photo" or "video" — personal content performs best.
- Use "stock" sparingly — only when content is genuinely impossible to photograph personally.
- Carousel posts use "carousel" type, NOT photo/video.
- LinkedIn/X/Threads text posts use "none".

BRIEF LENGTH: Short. Direct. Actionable. No filler words.

TEMPLATE RECOMMENDATION — set template_slug based on post_type:
- single_image education/tips → "edu-bold"
- single_image motivational/quote → "quote-card"
- single_image myth-busting/authority → "dark-statement"
- single_image numbered tip/step → "tip-numbered"
- carousel educational/how-to → "carousel-edu"
- carousel myth-busting → "carousel-myth"
- reel → "reel-cover"
- story → "story-teaser"

SLIDE CONTENT — for EVERY carousel entry, generate a slide_content array.
This is the actual text that will appear on each slide. Write it as if you are the brand.
Tone must match the brand's voice. Keep headlines punchy (6–12 words max).

slide_content rules:
- First item: is_hook: true — bold opening claim or question. No body needed.
- Middle items: headline = the point, body = 1–2 sentence explanation
- Last item: is_cta: true — action-focused. "Save this", "Follow for more", or specific CTA. No body needed.
- slide_count must equal the length of slide_content array.

The JSON shape below is illustrative of STRUCTURE ONLY — the topic/headline/brief
text in this example happens to be a fitness scenario, but that is not a hint about
this brand's niche. Every field you generate must be written for THIS brand's own
niche (${ctx.niche ?? ctx.industry ?? "its niche"}), never copied or adapted from this example.

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "date": "YYYY-MM-DD",
    "platform": "instagram",
    "topic": "specific post idea",
    "content_pillar": "education",
    "goal": "engagement",
    "post_type": "carousel",
    "required_media_type": "carousel",
    "slide_count": 5,
    "template_slug": "carousel-edu",
    "media_brief": "5 slides — 1: photo of you at clinic. 2–4: one tip per slide, text only. 5: photo of you with CTA.",
    "slide_content": [
      { "headline": "Your neck shouldn't hurt after a day at your desk.", "is_hook": true },
      { "headline": "Mistake 1: Monitor too low", "body": "If you look down at your screen, neck muscles work overtime. Eye level = neutral spine." },
      { "headline": "Mistake 2: Chair height wrong", "body": "Feet flat on floor, knees at 90°. Hanging feet compress your hips all day." },
      { "headline": "Mistake 3: Arms reaching forward", "body": "Wrists neutral, elbows at 90°. Reaching forward = chronic shoulder tension." },
      { "headline": "Save this and fix your setup today.", "is_cta": true }
    ]
  },
  {
    "date": "YYYY-MM-DD",
    "platform": "instagram",
    "topic": "single image tip",
    "content_pillar": "education",
    "goal": "engagement",
    "post_type": "single_image",
    "required_media_type": "photo",
    "template_slug": "edu-bold",
    "media_brief": "Photo of you demonstrating correct posture at a desk."
  }
]

Goals: engagement | conversion | brand_awareness | lead_generation
Post types: carousel | single_image | reel | story | text_only
Required media types: photo | video | carousel | stock | none`

  // Budget-aware model selection (P5): forces economy models once the
  // brand's account has crossed its monthly AI spend cap. Never blocks —
  // calendar generation is user-facing. See src/lib/server/billing/aiBudget.ts.
  const { data: account } = await supabase
    .from("accounts")
    .select("subscription_tier")
    .eq("id", brand.account_id)
    .maybeSingle()

  const { models } = await getBudgetAwareModels({
    accountId:   brand.account_id,
    plan:        account?.subscription_tier ?? "free",
    brandAiTier: brandTier(brand as { ai_tier?: string | null }),
  })
  const message = await client.messages.create({
    model:      models.calendar,
    max_tokens: 4096,
    messages:   [{ role: "user", content: prompt }],
  })
  logAiUsage({ brandId: brand.id, model: models.calendar, feature: "calendar", usage: message.usage })

  const raw = message.content[0].type === "text" ? message.content[0].text : ""
  const suggestions = robustJsonParse(raw)

  if (!Array.isArray(suggestions) || !suggestions.length) {
    throw new Error("AI returned no suggestions")
  }

  const filtered = suggestions.filter(s => !occupiedDates.has(s.date) && s.date >= from && s.date <= to)

  const typeCounters: Record<string, number> = {}
  const resolvedTemplates: Record<number, string | null> = {}
  for (let i = 0; i < filtered.length; i++) {
    const s = filtered[i]
    const postType = s.post_type ?? "single_image"
    typeCounters[postType] = (typeCounters[postType] ?? 0) + 1
    try {
      const chosen = await selectTemplate(brand.id, postType, typeCounters[postType], s.platform)
      resolvedTemplates[i] = chosen ?? s.template_slug ?? null
    } catch {
      resolvedTemplates[i] = s.template_slug ?? null
    }
  }

  const toInsert = filtered.map((s, i) => ({
    brand_id:            brand.id,
    scheduled_date:      s.date,
    platforms:           [s.platform],
    topic:               s.topic,
    content_pillar:      s.content_pillar,
    goal:                s.goal,
    post_type:           s.post_type            ?? null,
    required_media_type: s.required_media_type  ?? null,
    media_brief:         s.media_brief          ?? null,
    required_media_count: s.slide_count         ?? (s.required_media_type === "carousel" ? 5 : 1),
    template_slug:       resolvedTemplates[i]   ?? null,
    slide_content:       (s.slide_content        ?? null) as Json | null,
    status:              "planned",
  }))

  const { data: inserted, error: insertErr } = await supabase
    .from("content_calendar")
    .insert(toInsert)
    .select("id, scheduled_date, topic, content_pillar, platforms, status")

  if (insertErr) {
    throw new Error(insertErr.message)
  }

  const summary: Record<string, number> = {}
  for (const s of suggestions) {
    summary[s.platform] = (summary[s.platform] ?? 0) + 1
  }

  return {
    count:   (inserted ?? []).length,
    summary,
    entries: (inserted ?? []) as GenerateCalendarResult["entries"],
  }
}
