import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { scheduleBufferPost } from "@/lib/server/buffer/client"
import { inngest } from "@/inngest/client"

/**
 * POST /api/buffer/schedule
 * Pushes a post to Buffer and saves the buffer_post_id back.
 * Body: { post_id: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No brand found" }, { status: 400 })

    const { post_id } = await request.json() as { post_id: string }

    // Load post + calendar entry (include carousel_image_urls for rendered carousel slides)
    const { data: post, error: postErr } = await supabase
      .from("posts")
      .select("*, content_calendar(scheduled_date, topic)")
      .eq("id", post_id)
      .eq("brand_id", brand.id)
      .single()

    if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

    // Find the matching social account for this platform
    const { data: social } = await supabase
      .from("social_accounts")
      .select("buffer_profile_id, access_token")
      .eq("brand_id", brand.id)
      .eq("platform", post.platform)
      .eq("is_active", true)
      .single()

    if (!social?.buffer_profile_id || !social?.access_token) {
      return NextResponse.json(
        { error: `No Buffer account connected for ${post.platform}. Connect it in Settings.` },
        { status: 400 }
      )
    }

    // Build the full post text (caption + hashtags)
    const hashtags  = (post.hashtags as string[] | null ?? []).map(h => `#${h}`).join(" ")
    const fullText  = [post.caption, hashtags].filter(Boolean).join("\n\n")

    // Determine scheduled time
    const cal = post.content_calendar as { scheduled_date?: string } | null
    const scheduledAt = cal?.scheduled_date
      ? new Date(`${cal.scheduled_date}T09:00:00`) // default 9am on scheduled day
      : undefined

    // Collect public URLs of attached media.
    // Priority: carousel_image_urls (rendered slides) > media_ids (uploaded files)
    let mediaUrls: string[] = []
    const carouselUrls = (post.carousel_image_urls as string[] | null) ?? []
    if (carouselUrls.length) {
      // Carousel post — use the rendered slide PNGs (strip cache-busting query params)
      mediaUrls = carouselUrls.map(u => u.split("?")[0])
    } else if ((post.media_ids as string[] | null)?.length) {
      const { data: media } = await supabase
        .from("media_uploads")
        .select("public_url")
        .in("id", post.media_ids as string[])
      mediaUrls = (media ?? []).map(m => m.public_url).filter(Boolean) as string[]
    }

    // Push to Buffer
    const bufferUpdate = await scheduleBufferPost({
      accessToken: social.access_token,
      channelId:   social.buffer_profile_id,   // buffer_profile_id stores the GraphQL channelId
      text:        fullText,
      scheduledAt,
      mediaUrls,
    })

    // Save buffer_post_id and mark as scheduled
    await supabase
      .from("posts")
      .update({
        buffer_post_id: bufferUpdate.id,
        status:         "scheduled",
      })
      .eq("id", post_id)

    // Fire Inngest event to schedule reminder emails for manual platforms
    if (scheduledAt) {
      await inngest.send({
        name: "postflow/post.scheduled",
        data: {
          postId:      post_id,
          platform:    post.platform,
          scheduledAt: scheduledAt.toISOString(),
        },
      })
    }

    // Sync calendar entry status
    if (cal) {
      const { data: calRow } = await supabase
        .from("content_calendar")
        .select("id")
        .eq("brand_id", brand.id)
        .gte("scheduled_date", (cal as { scheduled_date?: string }).scheduled_date ?? "")
        .limit(1)
        .single()
      if (calRow) {
        await supabase.from("content_calendar").update({ status: "scheduled" }).eq("id", calRow.id)
      }
    }

    return NextResponse.json({ success: true, buffer_post_id: bufferUpdate.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
