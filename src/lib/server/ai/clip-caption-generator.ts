/**
 * Clip Caption Generator — generates a social media caption + hashtags
 * for a clip-forge video post.
 *
 * Uses getBrandContext() to inject brand intelligence tokens, tone, and
 * performance data. Returns caption and hashtags ready for the clip_forge_jobs
 * output_caption + output_hashtags columns.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { BrandContext } from "@/lib/server/brand/getBrandContext"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

const claude = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

export interface ClipCaptionResult {
  caption:   string
  hashtags:  string[]
}

/**
 * Generate a caption and hashtag set for a clip-forge video.
 *
 * @param ctx       Full brand context from getBrandContext()
 * @param goal      User's stated content goal (e.g. "Grow followers")
 * @param platform  Target platform (instagram | tiktok | linkedin | etc.)
 * @param hookText  Optional hook text used in the video (for consistency)
 * @param ctaText   Optional CTA shown at video end
 */
export async function generateClipCaption(
  ctx:       BrandContext,
  goal:      string,
  platform:  string,
  hookText?: string,
  ctaText?:  string,
  brandId?:  string | null,
): Promise<ClipCaptionResult> {
  const platformGuidance: Record<string, string> = {
    instagram: "Instagram Reels: 1–3 short punchy lines + 5–10 hashtags. Caption length ≤ 150 words.",
    tiktok:    "TikTok: hook in first line, conversational, 2–4 hashtags max. Caption length ≤ 100 words.",
    linkedin:  "LinkedIn: professional but warm, 2–4 paragraphs, storytelling structure. No hashtag spam — max 3. Caption length ≤ 300 words.",
    facebook:  "Facebook: friendly, slightly longer than Instagram, 3–5 hashtags. Caption length ≤ 200 words.",
    youtube:   "YouTube Shorts: compelling opener, clear CTA for subscribe/follow, 5–8 hashtags. Caption length ≤ 200 words.",
  }
  const guidance = platformGuidance[platform] ?? platformGuidance.instagram

  const hookLine = hookText  ? `\nVideo opens with: "${hookText}"` : ""
  const ctaLine  = ctaText   ? `\nVideo ends with CTA: "${ctaText}"` : ""

  const prompt = `${ctx.promptBlock}

---
TASK: Write a ${platform} video caption for a short-form clip post.

Content goal: ${goal}${hookLine}${ctaLine}

PLATFORM RULES: ${guidance}

Write a caption that:
1. Matches the brand tone and intelligence tokens above
2. Opens with a hook (first line grabs attention)
3. Uses the goal to guide the message
4. Ends with a clear CTA if not already in the video
5. Includes relevant hashtags (quantity per platform rules)

Respond with a JSON object ONLY:
{
  "caption": "Full caption text here",
  "hashtags": ["hashtag1", "hashtag2"]
}

No markdown, no extra text. Just the JSON.`

  try {
    const response = await claude.messages.create({
      model:      MODELS.clipCaptions,
      max_tokens: 512,
      messages: [{
        role:    "user",
        content: prompt,
      }],
    })
    logAiUsage({ brandId: brandId ?? null, model: MODELS.clipCaptions, feature: "clip_caption", usage: response.usage })

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()

    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    const parsed = JSON.parse(json) as Partial<ClipCaptionResult>

    return {
      caption:  parsed.caption?.trim()  ?? `Check out our latest video! 🎬 #${platform}`,
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    }
  } catch (err) {
    console.error("[clip-caption-generator] failed:", err)
    return {
      caption:  `Check out our latest video! 🎬`,
      hashtags: [platform, "video", "content"],
    }
  }
}
