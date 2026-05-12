/**
 * story-caption-generator — generates a social media caption + hashtags
 * for a Stories & Reels post.
 *
 * Uses getBrandContext() to inject brand intelligence tokens, tone, and
 * performance data. Follows the same pattern as clip-caption-generator.ts.
 *
 * Model: claude-haiku-4-5 (fast, low cost — same as clip-forge)
 */

import Anthropic from "@anthropic-ai/sdk"
import type { BrandContext } from "@/lib/server/brand/getBrandContext"

const claude = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

export interface StoryCaptionResult {
  caption:  string
  hashtags: string[]
}

export type StoryMediaType = "photo" | "video"

const PLATFORM_GUIDANCE: Record<string, string> = {
  instagram: "Instagram Stories/Reels: 1–3 punchy lines + 5–10 hashtags. Caption ≤ 150 words.",
  tiktok:    "TikTok: hook in first line, conversational, 2–4 hashtags max. Caption ≤ 100 words.",
  linkedin:  "LinkedIn: professional but warm, 2–3 paragraphs. Max 3 hashtags. Caption ≤ 300 words.",
  facebook:  "Facebook Stories/Reels: friendly and direct, 3–5 hashtags. Caption ≤ 200 words.",
  youtube:   "YouTube Shorts: compelling opener, clear subscribe/follow CTA, 5–8 hashtags. Caption ≤ 200 words.",
}

const TEMPLATE_CONTEXT: Record<string, string> = {
  "story-teaser":   "This is a story teaser photo — it's eye-catching and designed to drive engagement.",
  "reel-cover":     "This is a short-form reel video — it should feel dynamic and capture attention in the first second.",
}

/**
 * Generate a caption and hashtag set for a Story or Reel post.
 *
 * @param ctx        Full brand context from getBrandContext()
 * @param platform   Target platform (instagram | tiktok | linkedin | etc.)
 * @param mediaType  "photo" (→ story) or "video" (→ reel)
 * @param template   Template slug (story-teaser | reel-cover)
 */
export async function generateStoryCaption(
  ctx:       BrandContext,
  platform:  string,
  mediaType: StoryMediaType,
  template:  string,
): Promise<StoryCaptionResult> {
  const guidance     = PLATFORM_GUIDANCE[platform] ?? PLATFORM_GUIDANCE.instagram
  const templateCtx  = TEMPLATE_CONTEXT[template] ?? ""
  const contentType  = mediaType === "photo" ? "story post (photo)" : "reel (short video)"

  const prompt = `${ctx.promptBlock}

---
TASK: Write a ${platform} caption for a ${contentType}.

${templateCtx}

PLATFORM RULES: ${guidance}

Write a caption that:
1. Matches the brand tone and intelligence tokens above
2. Opens with a hook that grabs attention immediately
3. Feels authentic to the brand voice
4. Ends with a clear, natural CTA
5. Includes relevant hashtags (quantity per platform rules)

Respond with a JSON object ONLY:
{
  "caption": "Full caption text here",
  "hashtags": ["hashtag1", "hashtag2"]
}

No markdown, no extra text. Just the JSON.`

  try {
    const response = await claude.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()

    const json   = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    const parsed = JSON.parse(json) as Partial<StoryCaptionResult>

    return {
      caption:  parsed.caption?.trim()  ?? `Check out our latest ${mediaType}! ✨ #${platform}`,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    }
  } catch (err) {
    console.error("[story-caption-generator] failed:", err)
    return {
      caption:  `Check out our latest ${mediaType}! ✨`,
      hashtags: [platform, mediaType, "content"],
    }
  }
}
