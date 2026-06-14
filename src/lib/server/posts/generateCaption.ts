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
  /**
   * Optional language override (BCP 47 code, e.g. "nl", "en", "de", "fr").
   * When set and different from tone_profile.content_language, the caption
   * will be generated in this language instead of the brand's default.
   */
  target_language?: string
  /**
   * Raw example posts from onboarding — used as 1–2 few-shot samples to calibrate voice.
   * Select longest examples (most signal). Truncated to 400 chars each in the prompt.
   */
  tone_examples?: string[] | null
  /**
   * User-written "always do X" rules — injected as absolute constraints.
   * These override any inferred style behaviour.
   */
  custom_do_rules?: string | null
  /**
   * User-written "never do Y" rules — injected as absolute constraints.
   * These override any inferred style behaviour.
   */
  custom_dont_rules?: string | null
  /**
   * Content type — controls how the caption is written.
   * - "reel":        needs a strong hook in the first 2–3 words; watch-time language; shorter
   * - "story":       very short; often just a CTA or question; no hashtags (stories show them poorly)
   * - "carousel":    each slide teased in order; caption builds anticipation; swipe prompt
   * - "single_image": standard feed post
   * - "text_only":   no visual; strong opening line; relies purely on writing
   * If omitted, treated as single_image.
   */
  post_type?: string | null
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
    target_language,
    tone_examples,
    custom_do_rules,
    custom_dont_rules,
    post_type,
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
TONE PROFILE:
- Personality: ${tone_profile.personality_traits.join(", ")}
- Tone level: ${tone_profile.tone_level}/10 (1=very formal, 10=very casual)
- Expertise: ${tone_profile.expertise_level}
- Sentences: ${tone_profile.writing_style.sentence_length}, ${tone_profile.writing_style.vocabulary} vocabulary
- CTA style: ${tone_profile.cta_style}
${tone_profile.do_use.length ? `\nWRITING PATTERNS TO ACTIVELY USE (apply these throughout the post):\n${tone_profile.do_use.map(p => `- ${p}`).join("\n")}` : ""}
${tone_profile.do_not_use.length ? `\nNEVER USE (absolute — these will make the brand cringe):\n${tone_profile.do_not_use.map(p => `- ${p}`).join("\n")}` : ""}
${tone_profile.signature_phrases.length ? `\nSIGNATURE PHRASES — use EXACTLY ONE per post, woven in naturally. Do not force multiple:\n${tone_profile.signature_phrases.map(p => `- "${p}"`).join("\n")}` : ""}`
    : ""

  // Few-shot examples: pick up to 2 longest examples (most linguistic signal)
  const fewShotBlock = (() => {
    const examples = (tone_examples ?? [])
      .filter(e => e?.trim().length > 30)
      .sort((a, b) => b.length - a.length)
      .slice(0, 2)
      .map(e => e.trim().slice(0, 400))
    if (!examples.length) return ""
    return `
REAL POSTS FROM THIS BRAND — study these to calibrate the exact voice and writing style:
${examples.map((e, i) => `[Example ${i + 1}]: "${e}"`).join("\n\n")}
Do NOT copy or paraphrase these posts. Use them only to match the authentic voice, rhythm, and personality.`
  })()

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

  // Post-type guidance: how the format affects caption writing
  const postTypeGuidance: Record<string, string> = {
    reel: `This is a REEL (short-form video). Caption rules:
- First 2–3 words must be a hard hook — viewers decide in 0.5 s whether to watch.
- Use watch-time language: "Watch until the end", "Part 1 of...", "POV:", "This changed everything".
- Keep the caption SHORT — people read after (or not at all) watching.
- 5–10 hashtags, mix niche + broad.
- Never write a wall of text.`,
    story: `This is an Instagram STORY (24-hour ephemeral content). Caption rules:
- Stories are visual-first. The caption should be extremely short — 1 punchy sentence or a direct question.
- Use conversational, immediate language: "Would you try this?", "Save this!", "Which one?".
- Hashtags barely show in Stories — include 1–3 max or zero.
- No long copy. People tap through Stories in under 2 seconds.`,
    carousel: `This is a CAROUSEL post (multiple slides). Caption rules:
- Open with a hook that makes people WANT to swipe: "Most people get this wrong...", "Swipe to see all 5."
- Tease what's inside without giving everything away in the caption.
- End with a "swipe" prompt or "save this for later."
- Medium length — enough to hook, short enough to leave curiosity.`,
    text_only: `This is a TEXT-ONLY post (no image or video). Caption rules:
- The opening line is everything — it must stop the scroll by itself.
- Think of it as a micro-essay or a strong opinion: one clear point, made well.
- Longer-form works here (LinkedIn especially).
- Avoid filler. Every sentence must earn its place.`,
    video: `This is a VIDEO post. Caption rules:
- Lead with what the video is about in 1 sentence.
- Describe what to expect ("In this video...") for algorithm context.
- Medium length. Include a CTA to watch, comment, or save.`,
    single_image: "", // default — no extra guidance beyond platform
  }

  const postTypeNote = post_type ? (postTypeGuidance[post_type] ?? "") : ""

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

  // Language instruction: target_language overrides brand's content_language.
  // target_language uses BCP 47 codes ("nl", "en", "de", "fr"); we map them to
  // human-readable labels for the prompt so Claude doesn't need to guess.
  const LANG_LABELS: Record<string, string> = {
    nl: "Dutch",
    en: "English",
    de: "German",
    fr: "French",
    es: "Spanish",
    pt: "Portuguese",
    it: "Italian",
  }
  const effectiveLang  = target_language ?? tone_profile?.content_language ?? null
  const langLabel      = effectiveLang ? (LANG_LABELS[effectiveLang] ?? effectiveLang) : null
  const langInstruction = langLabel
    ? `\nIMPORTANT: Write the entire post in ${langLabel}. Never switch languages.`
    : ""

  // ── Custom brand rules (user-written, absolute constraints) ──────────────
  const customRulesBlock = (() => {
    const lines: string[] = []
    if (custom_do_rules?.trim()) {
      lines.push(`BRAND CUSTOM RULES — ALWAYS (absolute — the brand manager wrote these):\n${custom_do_rules.trim()}`)
    }
    if (custom_dont_rules?.trim()) {
      lines.push(`BRAND CUSTOM RULES — NEVER (absolute — the brand manager wrote these):\n${custom_dont_rules.trim()}`)
    }
    return lines.length ? lines.join("\n\n") : ""
  })()

  const antiAiBlock = `
WRITE AS A HUMAN, NOT AN AI:
This is a real person/brand with their own voice. Write exactly as they would.
NEVER use these AI-writing tells (they will get rejected instantly):
- "In today's [adjective] world..." or any variation of that opener
- "Game-changer", "dive in", "elevate your", "unlock your potential", "harness the power"
- Excessive em-dashes (maximum 1 per post — only if the brand already uses them)
- Hollow filler phrases: "It's worth noting", "Moreover", "Furthermore", "It goes without saying"
- Summarising what you're about to say instead of just saying it
- Generic hollow closers: "What do you think? Drop a comment!" (unless the brand's do_use list includes this)
- Overly symmetrical lists of exactly 3 points that feel AI-generated
Match the vocabulary level, informality, and rhythm shown in the real post examples above.`

  // ── Prompt caching: split stable brand context from variable task ─────────
  // The brand context (tone, rules, examples, anti-AI block) is stable across
  // many calls for the same brand. Cache it with `cache_control: ephemeral` to
  // reduce latency and token cost on repeated generation for the same brand.
  //
  // Boundary: everything up to and including the custom rules / anti-AI block
  // is stable. The topic/template/platform/performance/trends section varies.
  const brandContextBlock = `You are a social media copywriter for ${brand_name}, a ${industry} brand.${langInstruction}
${antiAiBlock}

${toneDesc}
${fewShotBlock}
${customRulesBlock}
Emoji rule (STRICT — override everything else): ${emojiRule}
${dnm}
${goalsDesc}
${perfContext}`

  const taskBlock = `Write a ${platform} ${post_type === "reel" ? "Reel" : post_type === "story" ? "Story" : post_type === "carousel" ? "carousel" : "post"} using the "${template.name}" format.

Topic: ${topic}
${audience ? `Target audience: ${audience}` : ""}
${feedbackLine}
${trendContext}

Template guidance: ${template.prompt_hint}
Platform guidance: ${platformGuidance[platform] ?? "Adapt to the platform norms."}
${postTypeNote ? `\nContent-type guidance (CRITICAL — this overrides generic platform guidance on format):\n${postTypeNote}` : ""}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = await (client as any).messages.create({
    model:      usedModel,
    max_tokens: 1024,
    messages: [{
      role:    "user",
      content: [
        // Stable brand context — cached across calls for the same brand
        { type: "text", text: brandContextBlock, cache_control: { type: "ephemeral" } } as const,
        // Variable task — not cached (changes every call)
        { type: "text", text: taskBlock } as const,
      ],
    }],
  }, { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } })
  logAiUsage({ brandId: input.brand_id, model: usedModel, feature: "caption", usage: message.usage })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON in Claude response")

  return robustJsonParse(jsonMatch[0])
}
