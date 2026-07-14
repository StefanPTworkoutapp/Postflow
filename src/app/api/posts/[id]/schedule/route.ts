/**
 * POST /api/posts/[id]/schedule
 *
 * "Sign off" a post for direct publishing. Saves the scheduled time to
 * posts.scheduled_for, updates status to "scheduled", and fires an Inngest
 * event that will publish at the given time.
 *
 * Body: { scheduledAt: string }  — ISO 8601 datetime (e.g. "2026-06-15T18:00:00.000Z")
 *
 * The Inngest job (publishScheduledPost) sleeps until scheduledAt, then calls
 * the appropriate direct publisher. No Buffer account is required.
 */

import { NextResponse } from "next/server"
import { createClient }     from "@/lib/supabase/server"
import { getBrand }         from "@/lib/server/brand/getBrand"
import { inngest }          from "@/inngest/client"
import { isDirectPublishPlatform } from "@/lib/server/publish/dispatcher"
import { isTikTokDirectPublishEnabled } from "@/lib/server/publish/publishToTikTok"
import { getReminderMusicRecommendation } from "@/lib/server/music/reminder-recommendation"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: postId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const brand = await getBrand()
    if (!brand) return NextResponse.json({ error: "No active brand" }, { status: 400 })

    const body = await request.json() as { scheduledAt?: string }
    const { scheduledAt } = body

    if (!scheduledAt) {
      return NextResponse.json({ error: "scheduledAt is required" }, { status: 400 })
    }

    // Validate it's in the future (allow up to 60s in the past for clock skew)
    const scheduledMs = new Date(scheduledAt).getTime()
    if (Number.isNaN(scheduledMs)) {
      return NextResponse.json({ error: "Invalid scheduledAt date" }, { status: 400 })
    }
    if (scheduledMs < Date.now() - 60_000) {
      return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 })
    }

    // Load post — verify ownership and eligibility.
    // publish_mode is read via a separate best-effort call below (cast to any)
    // since that column may not exist yet pre-migration — degrades to 'direct'.
    const { data: post, error: postErr } = await supabase
      .from("posts")
      .select("id, platform, status, brand_id")
      .eq("id", postId)
      .eq("brand_id", brand.id)
      .single()

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // "reminder_sent" is included so a reminder post whose email failed to
    // send (retries exhausted → onFailure marked it "failed") or one already
    // sent can be re-scheduled via the same Retry / reschedule action.
    if (!["draft", "ready", "planned", "failed", "reminder_sent"].includes(post.status)) {
      return NextResponse.json(
        { error: `Post status "${post.status}" cannot be scheduled` },
        { status: 400 },
      )
    }

    const publishMode = await (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("posts")
        .select("publish_mode")
        .eq("id", postId)
        .maybeSingle()
      if (error || !data) return "direct"
      return (data as { publish_mode?: string | null }).publish_mode ?? "direct"
    })()
    const isReminderMode = publishMode === "reminder"

    // Reminder mode never calls a platform API — PostFlow only sleeps until
    // scheduledAt then emails the client a ready-to-post package. So the
    // direct-publish-platform / TikTok-approval gate below only applies to
    // 'direct' mode; any platform is fine for a reminder.
    if (!isReminderMode) {
      // Check platform is supported for direct publishing.
      // TikTok is listed as a direct platform but publishing stays gated behind
      // TIKTOK_DIRECT_PUBLISH_ENABLED (production app denied as of 2026-07) — treat
      // it the same as an unsupported platform until that flag is flipped on.
      const tikTokBlocked = post.platform === "tiktok" && !isTikTokDirectPublishEnabled()
      if (!isDirectPublishPlatform(post.platform) || tikTokBlocked) {
        return NextResponse.json(
          {
            error: tikTokBlocked
              ? "TikTok direct publishing is pending approval from TikTok. Connect Buffer in Settings to publish TikTok posts in the meantime."
              : `${post.platform} does not support direct publishing yet. Connect Buffer to schedule this post.`,
            needsBuffer: true,
            platform:    post.platform,
          },
          { status: 422 },
        )
      }
    }

    // Reminder mode: compute the recommended song now (cheap static scoring,
    // no AI call) so it's ready to include in the reminder email later.
    if (isReminderMode) {
      try {
        const recommendation = await getReminderMusicRecommendation(brand.id, post.platform)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("posts")
          .update({
            reminder_song_name: recommendation.trackName,
            reminder_song_vibe: recommendation.vibe,
          })
          .eq("id", postId)
      } catch (err) {
        // Non-fatal — the reminder email just omits the song recommendation.
        console.warn("[schedule] reminder song recommendation failed:", err)
      }
    }

    // Save scheduled_for + status.
    // publish_error is cleared here too — a Retry from a "failed" post should
    // not keep showing the previous error once it's back in the schedule queue.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabase as any)
      .from("posts")
      .update({
        scheduled_for: scheduledAt,
        status:        "scheduled",
        publish_error: null,
      })
      .eq("id", postId)

    if (updateErr) {
      // publish_error column may not exist yet (migration pending) — degrade gracefully
      const { error: fallbackErr } = await supabase
        .from("posts")
        .update({ scheduled_for: scheduledAt, status: "scheduled" })
        .eq("id", postId)

      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
      }
    }

    // Also sync the calendar entry status
    const { data: calRow } = await supabase
      .from("content_calendar")
      .select("id")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (calRow) {
      await supabase
        .from("content_calendar")
        .update({ status: "scheduled" })
        .eq("id", calRow.id)
    }

    // Fire Inngest event — the job sleeps until scheduledAt then publishes
    await inngest.send({
      name: "postflow/post.scheduled",
      data: {
        postId,
        brandId:     brand.id,
        platform:    post.platform,
        scheduledAt,
      },
    })

    return NextResponse.json({ success: true, scheduledAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
