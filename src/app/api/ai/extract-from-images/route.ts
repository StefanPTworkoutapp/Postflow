import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { MODELS } from "@/lib/ai/models"
import { logAiUsage } from "@/lib/ai/logUsage"

export const maxDuration = 60 // seconds — vision calls can be slow

const client = new Anthropic({ apiKey: process.env.POSTFLOW_ANTHROPIC_KEY })

/**
 * POST /api/ai/extract-from-images
 * Accepts up to 5 base64-encoded images (Instagram/social screenshots).
 * Uses Claude vision to extract the post captions as plain text.
 * Body: { images: Array<{ data: string; mediaType: string }> }
 */
export async function POST(request: Request) {
  try {
    const { images } = await request.json() as {
      images: Array<{ data: string; mediaType: string }>
    }

    if (!images?.length) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 })
    }
    if (images.length > 5) {
      return NextResponse.json({ error: "Maximum 5 images" }, { status: 400 })
    }

    const content: Anthropic.MessageParam["content"] = [
      ...images.map((img) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mediaType as "image/jpeg" | "image/png" | "image/webp",
          data: img.data,
        },
      })),
      {
        type: "text" as const,
        text: `These are screenshots of social media posts. Extract ONLY the caption/post text from each image — exactly as written, including emojis and line breaks. Ignore usernames, likes, comments, UI chrome, and hashtag counts.

Return a JSON object:
{
  "posts": ["full text of post 1", "full text of post 2", ...]
}

One entry per screenshot. If a screenshot has no readable post text, omit it.`,
      },
    ]

    const message = await client.messages.create({
      model: MODELS.imageExtraction,
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    })

    logAiUsage({ brandId: null, model: MODELS.imageExtraction, feature: "image_extraction", usage: message.usage })

    const text = message.content[0].type === "text" ? message.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not extract text from images" }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0]) as { posts: string[] }
    const combined = parsed.posts.join("\n\n---\n\n")

    return NextResponse.json({ text: combined, posts: parsed.posts })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
