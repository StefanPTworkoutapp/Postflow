/**
 * POST /api/stories/create
 *
 * Accepts a uploaded media path, platform, and template slug.
 * Generates a caption + hashtags via Claude Haiku (getBrandContext + generateStoryCaption).
 * Creates a content_calendar entry and a post record.
 * Returns { postId, caption, hashtags, mediaUrl } for the client to display.
 *
 * Flow:
 *   1. Auth + brand guard
 *   2. Validate inputs
 *   3. Get brand context for Claude prompt
 *   4. Generate caption + hashtags (claude-haiku-4-5)
 *   5. Auto-create content_calendar entry
 *   6. Create post record (status: draft)
 *   7. Return result for caption review step
 */

import { NextResponse }        from "next/server"
import { createClient }        from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getBrand }            from "@/lib/server/brand/getBrand"
import { getBrandContext }     from "@/lib/server/brand/getBrandContext"
import { generateStoryCaption } from "@/lib/server/stories/story-caption-generator"
import type { StoryMediaType } from "@/lib/server/stories/story-caption-generator"

const VALID_PLATFORMS = ["instagram", "tiktok", "linkedin", "facebook", "youtube"]
const VALID_TEMPLATES = ["story-teaser", "reel-cover"]

interface CreateStoryBody {
  /** Storage path returned by /api/stories/upload-url */
  path:      string
  platform:  string
  template:  string   // "story-teaser" | "reel-cover"
  mediaType: StoryMediaType  // "photo" | "video"
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const body = await req.json() as CreateStoryBody
    const { path, platform, template, mediaType } = body

    if (!path?.trim())     return NextResponse.json({ error: "path is required" }, { status: 400 })
    if (!VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `platform must be one of: ${VALID_PLATFORMS.join(", ")}` }, { status: 400 })
    }
    if (!VALID_TEMPLATES.includes(template)) {
      return NextResponse.json({ error: `template must be one of: ${VALID_TEMPLATES.join(", ")}` }, { status: 400 })
    }
    if (mediaType !== "photo" && mediaType !== "video") {
      return NextResponse.json({ error: "mediaType must be 'photo' or 'video'" }, { status: 400 })
    }

    // ── 1. Get a signed read URL for the uploaded media ─────────────────────
    const serviceSupabase = createServiceClient()
    const { data: signedData, error: signedError } = await serviceSupabase.storage
      .from("postflow-clips")
      .createSignedUrl(path, 3600 * 24)  // 24h — long enough to preview + schedule

    if (signedError || !signedData?.signedUrl) {
      console.error("[stories/create] signed URL error:", signedError)
      return NextResponse.json({ error: "Could not read uploaded file" }, { status: 500 })
    }

    const mediaUrl = signedData.signedUrl

    // ── 2. Brand context ─────────────────────────────────────────────────────
    const ctx = await getBrandContext(brand.id, platform)
    if (!ctx) return NextResponse.json({ error: "Brand context unavailable" }, { status: 500 })

    // ── 3. Generate caption + hashtags ───────────────────────────────────────
    const { caption, hashtags } = await generateStoryCaption(ctx, platform, mediaType, template)

    // ── 4. Create content_calendar entry ─────────────────────────────────────
    const today = new Date().toISOString().split("T")[0]
    const { data: calEntry, error: calError } = await supabase
      .from("content_calendar")
      .insert({
        brand_id:       brand.id,
        scheduled_date: today,
        platforms:      [platform],
        topic:          `${mediaType === "photo" ? "Story" : "Reel"} — ${platform}`,
        post_type:      mediaType === "photo" ? "story" : "reel",
        template_slug:  template,
        status:         "drafting",
      })
      .select("id")
      .single()

    if (calError || !calEntry) {
      console.error("[stories/create] calendar insert failed:", calError)
      return NextResponse.json({ error: "Failed to create calendar entry" }, { status: 500 })
    }

    // ── 5. Create post record ────────────────────────────────────────────────
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        brand_id:            brand.id,
        calendar_entry_id:   calEntry.id,
        platform,
        template_slug:       template,
        caption,
        hashtags,
        ai_caption_original: caption,
        // Store the media path as a generated_image_url (closest fit without schema change)
        generated_image_url: mediaUrl,
        status:              "draft",
      })
      .select("id")
      .single()

    if (postError || !post) {
      console.error("[stories/create] post insert failed:", postError)
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
    }

    return NextResponse.json({
      postId:    (post as { id: string }).id,
      caption,
      hashtags,
      mediaUrl,
      platform,
      template,
      mediaType,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[stories/create] unexpected error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
