/**
 * tagMediaUpload — triggered when a media file is confirmed uploaded.
 *
 * For images: downloads the file, sends to Claude Vision, writes
 * ai_tags, ai_description, and ai_quality_score back to media_uploads.
 *
 * Skipped for video — Claude Vision doesn't process video files.
 *
 * Event: postflow/media.uploaded
 * Data:  { mediaId, brandId, publicUrl, mediaType }
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import Anthropic               from "@anthropic-ai/sdk"

interface TagResult {
  tags:          string[]
  description:   string
  quality_score: number
}

async function analyzeImage(publicUrl: string): Promise<TagResult | null> {
  // Fetch image bytes
  const res = await fetch(publicUrl)
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)

  const buffer      = await res.arrayBuffer()
  const base64      = Buffer.from(buffer).toString("base64")
  const contentType = res.headers.get("content-type") ?? "image/jpeg"

  // Only pass types Claude Vision accepts
  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  const mediaType = ACCEPTED_TYPES.includes(contentType)
    ? (contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif")
    : "image/jpeg"

  const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY! })

  const msg = await client.messages.create({
    model:      "claude-haiku-4-5",
    max_tokens: 512,
    messages: [{
      role:    "user",
      content: [
        {
          type:   "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        },
        {
          type: "text",
          text: `Analyze this image for a social media content library.

Return ONLY valid JSON (no markdown, no explanation):
{
  "tags": ["tag1", "tag2", "tag3"],
  "description": "1-2 sentence description of what's in the image",
  "quality_score": 7.5
}

Tags (5–8): describe the subject, setting, mood, composition, and social media fit.
Description: factual and concise — what and where.
Quality score (0–10 float): rate lighting (0-3), composition (0-3), clarity (0-2), social media suitability (0-2). Sum them.`,
        },
      ],
    }],
  })

  const raw   = msg.content[0].type === "text" ? msg.content[0].text : ""
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()

  try {
    const parsed = JSON.parse(clean) as TagResult
    return {
      tags:          Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
      description:   typeof parsed.description === "string" ? parsed.description : "",
      quality_score: typeof parsed.quality_score === "number"
        ? Math.max(0, Math.min(10, parsed.quality_score))
        : 5,
    }
  } catch {
    console.error("tagMediaUpload: failed to parse Claude response:", raw)
    return null
  }
}

export const tagMediaUpload = inngest.createFunction(
  {
    id:          "tag-media-upload",
    name:        "Tag Media Upload (AI Vision)",
    triggers:    [{ event: "postflow/media.uploaded" }],
    concurrency: { limit: 3 }, // limit parallel Claude Vision calls
    retries:     2,
  },
  async ({ event, step }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { mediaId, brandId, publicUrl, mediaType } = (event as any).data as {
      mediaId:   string
      brandId:   string
      publicUrl: string
      mediaType: string
    }

    // Skip video — Claude Vision doesn't process video
    if (mediaType !== "image") {
      return { skipped: true, reason: "non-image media type" }
    }

    const result = await step.run("analyze-image", async () => {
      return analyzeImage(publicUrl)
    })

    if (!result) {
      return { skipped: true, reason: "analysis failed" }
    }

    await step.run("write-tags", async () => {
      const supabase = createServiceClient()
      const { error } = await supabase
        .from("media_uploads")
        .update({
          ai_tags:          result.tags,
          ai_description:   result.description,
          ai_quality_score: result.quality_score,
        })
        .eq("id", mediaId)
        .eq("brand_id", brandId)

      if (error) throw new Error(`Failed to update tags: ${error.message}`)
    })

    return {
      success:       true,
      mediaId,
      tags:          result.tags,
      quality_score: result.quality_score,
    }
  }
)
