import Anthropic from "@anthropic-ai/sdk"
import type { PostTemplate } from "@/lib/shared/posts/templates"
import type { ToneProfile } from "@/lib/server/ai/extractToneProfile"
import { MODELS, getModels } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

export interface PerformanceContext {
  platform:             string
  avg_engagement_rate?: number | null
  best_days_of_week?:   number[] | null
  best_hours_of_day?:   number[] | null
  best_content_pillars?: string[] | null
  best_post_types?:     string[] | null
  top_hashtags?:        string[] | null
}

export interface TrendContext {
  topic:    string
  source:   string
  headline?: string | null
}

export interface CaptionInput {
  brand_name: string
  industry: string
  platform: string
  template: PostTemplate
  topic: string
  audience?: string
  goals?: string[] | null        // ordered: [0] = primary, [1] = secondary…
  tone_profile?: ToneProfile | null
  do_not_mention?: string[] | null
  previous_feedback?: string
  emoji_policy?:    "never" | "sparingly" | "often" | null
  emoji_favorites?: string | null
  /** Optional: brand's performance patterns for this platform (from post_analytics) */
  performance?: PerformanceContext | null
  /** Optional: this week's trending topics (from niche_trends) */
  trends?: TrendContext[] | null
  /** Override the model used — pass getModels(brandTier(brand)).caption from the calling route. */
  model?: string
  /** Brand ID for usage logging — pass brand.id from the calling route. */
  brand_id?: string | null
}

export interface GeneratedCaption {
  caption: string
  hashtags: string[]
  cta: string
}

/**
 * JSON.parse that handles Claude occasionally emitting literal newlines/tabs
 * inside string values (which is technically invalid JSON but common in practice).
 * Walks the raw string character-by-character and escapes control chars only
 * when inside a JSON string value.
 */
function robustJsonParse(raw: string): GeneratedCaption {
  // Zero: strip markdown code fences Claude occasionally adds despite instructions
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()

  // First: try a straight parse — works most of the time
  try { return JSON.parse(stripped) } catch { /* fall through to sanitiser */ }

  // Second: sanitise literal control characters inside JSON string values
  let inString = false
  let escaped  = false
  let out      = ""

  for (const ch of stripped) {
    if (escaped) {
      out     += ch
      escaped  = false
      continue
    }
    if (ch === "\\" && inString) { out += ch; escaped = true; continue }
    if (ch === '"')              { inString = !inString; out += ch; continue }

    if (inString) {
      if      (ch === "\n") { out += "\\n";  continue }
      else if (ch === "\r") { out += "\\r";  continue }
      else if (ch === "\t") { out += "\\t";  continue }
    }

    out += ch
  }

  return JSON.parse(out) as GeneratedCaption
}

export async function generateCaption(input: CaptionInput): Promise<GeneratedCaption> {
  const {
    brand_name,
    industry,
    platform,
    template,
    topic,
    audience,
    goals,
    tone_profile,
    do_not_mention,
    previous_feedback,
    emoji_policy,
    emoji_favorites,
    performance,
    trends,
  } = input

  const EMOJI_RULES: Record<string, string> = {
    never:     "NEVER use emojis — not even one. The brand voice is purely text.",
    sparingly: emoji_favorites?.trim()
      ? `Use emojis sparingly: 1–2 max. ONLY use emojis from this set: ${emoji_favorites.trim()} — no others.`
      : "Use emojis sparingly: 1–2 max, only when they genuinely add meaning.",
    often:     "Emojis are welcome throughout the post.",
  }
  const emojiRule = EMOJI_RULES[emoji_policy ?? "sparingly"]

  const toneDesc = tone_profile
    ? `
Tone profile:
- Personality: ${tone_profile.personality_traits.join(", ")}
- Tone level: ${tone_profile.tone_level}/10 (1=very formal, 10=very casual)
- Expertise: ${tone_profile.expertise_level}
- Sentences: ${tone_profile.writing_style.sentence_length}, ${tone_profile.writing_style.vocabulary} vocabulary
- CTA style: ${tone_profile.cta_style}
${tone_profile.signature_phrases.length ? `- Signature phrases to use naturally: ${tone_profile.signature_phrases.join(", ")}` : ""}
${tone_profile.do_not_use.length ? `- Never use: ${tone_profile.do_not_use.join(", ")}` : ""}`
    : ""

  const GOAL_LABELS: Record<string, string> = {
    lead_generation: "Get more clients",
    brand_awareness: "Build brand awareness",
    engagement: "Educate / engage the audience",
    showcase: "Showcase work / results",
    sales: "Drive sales",
  }
  const goalsDesc = goals?.length
    ? `Content goals (in priority order):
${goals.map((g, i) => `  ${i === 0 ? "★ Primary" : `  ${i + 1}.`} ${GOAL_LABELS[g] ?? g}`).join("\n")}
The post must primarily serve the PRIMARY goal above all others.`
    : ""

  const dnm = do_not_mention?.length
    ? `\nNever mention: ${do_not_mention.join(", ")}`
    : ""

  const feedbackLine = previous_feedback
    ? `\nPrevious version was rejected. User feedback: "${previous_feedback}". Fix this in the new version.`
    : ""

  const platformGuidance: Record<string, string> = {
    instagram: "Use line breaks between paragraphs. Include 8–15 hashtags at the end.",
    linkedin: "Professional but personal tone. Short paragraphs. 3–5 hashtags max.",
    facebook: "Conversational. Moderate length. 3–8 hashtags.",
    tiktok: "Very short, punchy, casual. 5–10 hashtags.",
    x: "Under 280 characters for the core post. 1–3 hashtags.",
    threads: "Conversational. 1–3 short paragraphs. 0–5 hashtags.",
  }

  // ── Performance + trend context ──────────────────────────────────────────────
  const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  const perfContext = performance
    ? `
BRAND PERFORMANCE INSIGHTS (based on last 90 days of real data — use this to write better):
- Average engagement rate on ${platform}: ${performance.avg_engagement_rate ? `${(performance.avg_engagement_rate * 100).toFixed(2)}%` : "no data yet"}
- Best days to post: ${(performance.best_days_of_week ?? []).map(d => DAY_NAMES[d]).join(", ") || "not enough data"}
- Best posting hours: ${(performance.best_hours_of_day ?? []).map(h => `${h}:00`).join(", ") || "not enough data"}
- Top-performing content pillars: ${(performance.best_content_pillars ?? []).join(", ") || "not enough data"}
- High-performance hashtags to consider: ${(performance.top_hashtags ?? []).slice(0, 8).join(", ") || "none yet"}`
    : ""

  const trendContext = trends?.length
    ? `
THIS WEEK'S TRENDING TOPICS IN YOUR NICHE (weave relevance naturally if it fits):
${trends.slice(0, 5).map(t => `- ${t.topic}${t.headline ? ` ("${t.headline}")` : ""}`).join("\n")}`
    : ""

  const contentLang = tone_profile?.content_language
  const langInstruction = contentLang
    ? `\nIMPORTANT: Write the entire post in ${contentLang}. Never switch languages.`
    : ""

  const prompt = `You are a social media copywriter for ${brand_name}, a ${industry} brand.${langInstruction}

Write a ${platform} post using the "${template.name}" format.

Topic: ${topic}
${audience ? `Target audience: ${audience}` : ""}
${goalsDesc}
${toneDesc}
Emoji rule (STRICT — override everything else): ${emojiRule}
${dnm}
${feedbackLine}
${perfContext}
${trendContext}

Template guidance: ${template.prompt_hint}
Platform guidance: ${platformGuidance[platform] ?? "Adapt to the platform norms."}

Return ONLY valid JSON in this exact shape:
{
  "caption": "the full post caption with line breaks as \\n",
  "hashtags": ["hashtag1", "hashtag2"],
  "cta": "the call-to-action sentence only"
}

Rules:
- hashtags: no # prefix, lowercase, no spaces
- caption should NOT include hashtags (they go in the hashtags array)
- cta is the last sentence of the caption extracted separately
- Do not add any explanation outside the JSON`

  const usedModel = input.model ?? getModels("standard").caption
  const message = await client.messages.create({
    model: usedModel,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })
  logAiUsage({ brandId: input.brand_id, model: usedModel, feature: "caption", usage: message.usage })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON in Claude response")

  return robustJsonParse(jsonMatch[0])
}
