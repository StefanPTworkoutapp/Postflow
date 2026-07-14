/**
 * publishScheduledPost — fires when a post is scheduled and publishes it directly
 * to the platform at the correct time.
 *
 * Trigger: event "postflow/post.scheduled"
 * Event data: { postId, brandId, platform, scheduledAt }
 *
 * Flow (publish_mode = 'direct', the default):
 *   1. Sleep until scheduledAt (Inngest persists the job across server restarts)
 *   2. Load the post from DB — verify it's still in "scheduled" status
 *   3. Resolve media URLs from media_ids + carousel_image_urls
 *   4. Dispatch to the right platform publisher
 *   5. Update post: status="posted", posted_at, posted_url, buffer_post_id (used as platform_post_id)
 *   6. Fire processPostAnalytics after 24h to let platform metrics settle
 *
 * Flow (publish_mode = 'reminder' — music-without-licensing mode):
 *   1–3 same as above (still resolve media so the email can link to it)
 *   4'. Skip dispatchPublish entirely — PostFlow never calls the platform API for
 *       this post. Instead email the client a ready-to-post package (media link,
 *       copy-ready caption + hashtags, recommended song name/vibe, step-by-step
 *       manual-posting instructions) via sendReminderPostEmail.
 *   5'. Mark post status="reminder_sent" (falls back to "scheduled" + reminder_sent_at
 *       if that status value's migration hasn't landed yet — see markReminderSent).
 *   6'. Stop. No analytics trigger — there is no platform post id yet. Analytics only
 *       start once/if the client taps "Mark as posted" in the UI, and even then
 *       dailyAnalyticsFetch/fetchMetaAnalytics skip publish_mode='reminder' posts
 *       (no platform post id was ever produced by PostFlow).
 *
 * Error handling:
 *   - Inngest retries automatically on unexpected throws (retries: 2 → 3 attempts total)
 *   - Once retries are exhausted, the `onFailure` handler below fires: it updates the
 *     post's status to "failed" and stores the error in posts.publish_error so the
 *     Posts list / PostEditor can surface a clear failed state with a Retry action.
 *     This applies identically whether the failure came from dispatchPublish (direct
 *     mode) or sendReminderPostEmail (reminder mode) — both throw on failure and let
 *     Inngest's retry/onFailure machinery handle it the same way.
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { dispatchPublish }     from "@/lib/server/publish/dispatcher"
import type { PostType }       from "@/lib/server/publish/types"
import { sendReminderPostEmail } from "@/lib/server/email/reminderPostEmailTemplate"

/**
 * Marks a post as failed and records the error message.
 *
 * Written defensively: `publish_error` is a column added in migration
 * 20260714000001_posts_publish_error.sql. Until that migration is applied in
 * a given environment, the first update (which includes the column) will
 * fail — in that case we fall back to a plain status update so the post is
 * never left silently stuck on "scheduled" even pre-migration.
 */
async function markPostFailed(postId: string, message: string) {
  const supabase = createServiceClient()
  const truncated = message.slice(0, 2000)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from("posts")
    .update({ status: "failed", publish_error: truncated })
    .eq("id", postId)

  if (updateErr) {
    console.warn(
      "[publishScheduledPost] publish_error column write failed (migration pending?) — falling back to status-only update:",
      updateErr.message,
    )
    await supabase
      .from("posts")
      .update({ status: "failed" })
      .eq("id", postId)
  }
}

/**
 * Marks a reminder-mode post as "reminder sent" once the email has gone out.
 *
 * Written defensively like markPostFailed above: the 'reminder_sent' status
 * value and the reminder_sent_at column are added by migration
 * 20260714000008_posts_publish_mode.sql. Until that migration is applied, the
 * first update (status="reminder_sent") will fail the CHECK constraint —
 * fall back to leaving status="scheduled" but still recording
 * reminder_sent_at so the UI can tell the reminder actually went out even
 * pre-migration (if that column exists); if neither has landed yet, fall
 * back once more to a no-op status touch so the post is never left crashing.
 */
async function markReminderSent(postId: string) {
  const supabase = createServiceClient()
  const sentAt = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase as any)
    .from("posts")
    .update({ status: "reminder_sent", reminder_sent_at: sentAt })
    .eq("id", postId)

  if (updateErr) {
    console.warn(
      "[publishScheduledPost] reminder_sent status/column write failed (migration pending?) — falling back:",
      updateErr.message,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: fallbackErr } = await (supabase as any)
      .from("posts")
      .update({ reminder_sent_at: sentAt })
      .eq("id", postId)

    if (fallbackErr) {
      console.warn(
        "[publishScheduledPost] reminder_sent_at column also unavailable — leaving status untouched:",
        fallbackErr.message,
      )
    }
  }
}

export const publishScheduledPost = inngest.createFunction(
  {
    id:          "postflow/publish-scheduled-post",
    name:        "Publish Scheduled Post",
    triggers:    [{ event: "postflow/post.scheduled" }],
    retries:     2,
    concurrency: { limit: 10 },
    // Fires once Inngest has exhausted all retries for this run (max 3
    // attempts total: the initial run + `retries: 2`). This is the terminal
    // failure path — mark the post "failed" with the error so it's no longer
    // silently stuck on "scheduled" and the UI can offer a Retry action.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onFailure: async ({ event, error }: any) => {
      const originalData = event?.data?.event?.data as
        | { postId?: string }
        | undefined
      const postId = originalData?.postId
      if (!postId) {
        console.error("[publishScheduledPost] onFailure fired with no postId in original event data")
        return
      }
      const message = error instanceof Error ? error.message : String(error ?? "Unknown publish error")
      console.error(`[publishScheduledPost] Post ${postId} failed to publish after retries: ${message}`)
      await markPostFailed(postId, message)
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { postId, brandId, platform, scheduledAt } = (event as any).data as {
      postId:      string
      brandId:     string
      platform:    string
      scheduledAt: string
    }

    // ── Step 1: Sleep until scheduled time ────────────────────────────────────
    if (scheduledAt) {
      await step.sleepUntil("wait-for-scheduled-time", scheduledAt)
    }

    // ── Step 2: Load post ─────────────────────────────────────────────────────
    // publish_mode / reminder_song_* / generated_image_url are selected separately
    // below (Step 2b) rather than baked into this strict column list, so this
    // query never breaks pre-migration.
    const post = await step.run("load-post", async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from("posts")
        .select("id, brand_id, platform, post_type, caption, hashtags, media_ids, carousel_image_urls, template_slug, slide_content, status")
        .eq("id", postId)
        .single()

      if (error || !data) throw new Error(`Post ${postId} not found`)
      return data
    })

    // ── Step 2b: Best-effort reminder-mode fields ──────────────────────────────
    // Selected separately (and swallowed on error) so a pre-migration environment
    // (publish_mode / reminder_song_name / reminder_song_vibe / generated_image_url
    // columns not yet present) degrades to "treat as direct mode" instead of
    // crashing the whole job.
    const reminderFields = await step.run("load-reminder-fields", async () => {
      const supabase = createServiceClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("posts")
        .select("publish_mode, reminder_song_name, reminder_song_vibe, generated_image_url")
        .eq("id", postId)
        .maybeSingle()

      if (error || !data) {
        return { publish_mode: "direct", reminder_song_name: null, reminder_song_vibe: null, generated_image_url: null }
      }
      return data as {
        publish_mode:        string | null
        reminder_song_name:  string | null
        reminder_song_vibe:  string | null
        generated_image_url: string | null
      }
    })
    const isReminderMode = reminderFields.publish_mode === "reminder"

    // Abort if post was unscheduled in the meantime
    if (post.status !== "scheduled") {
      return { skipped: true, reason: `Post status is "${post.status}", not "scheduled"` }
    }

    // ── Step 3: Resolve media URLs ────────────────────────────────────────────
    const mediaUrls = await step.run("resolve-media-urls", async () => {
      const supabase   = createServiceClient()
      const carouselUrls = (post.carousel_image_urls as string[] | null) ?? []
      if (carouselUrls.length) {
        return carouselUrls.map((u: string) => u.split("?")[0])
      }
      const mediaIds = (post.media_ids as string[] | null) ?? []
      if (!mediaIds.length) return []
      const { data: media } = await supabase
        .from("media_uploads")
        .select("public_url")
        .in("id", mediaIds)
      return (media ?? []).map((m: { public_url: string | null }) => m.public_url).filter(Boolean) as string[]
    })

    // ── Reminder mode: email the client a ready-to-post package, never call
    //    the platform API, and stop here (no analytics trigger — nothing was
    //    actually published via PostFlow). ──────────────────────────────────
    if (isReminderMode) {
      await step.run("send-reminder-email", async () => {
        const supabase = createServiceClient()
        const { data: brand } = await supabase
          .from("brands")
          .select("name, accounts(email)")
          .eq("id", post.brand_id)
          .maybeSingle()

        const recipientEmail = (brand?.accounts as unknown as { email?: string } | null)?.email
        if (!recipientEmail) {
          throw new Error("No recipient email found for brand — cannot send reminder")
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow.app"
        const mediaUrl = mediaUrls[0] ?? reminderFields.generated_image_url ?? null

        await sendReminderPostEmail({
          recipientEmail,
          brandName: brand?.name ?? "Your brand",
          platform:  post.platform,
          caption:   post.caption ?? "",
          hashtags:  (post.hashtags as string[] | null) ?? [],
          mediaUrl,
          songName:  reminderFields.reminder_song_name,
          songVibe:  reminderFields.reminder_song_vibe,
          postUrl:   `${appUrl}/posts/${postId}`,
        })
      })

      await step.run("mark-reminder-sent", () => markReminderSent(postId))

      return { reminderSent: true, postId }
    }

    // ── Step 4: Publish ───────────────────────────────────────────────────────
    const result = await step.run("publish-to-platform", async () => {
      const hashtags   = (post.hashtags as string[] | null) ?? []
      const isCarousel = (post.carousel_image_urls as string[] | null)?.length
        ? true
        : post.template_slug?.startsWith("carousel") ?? false

      // Derive postType: explicit DB column wins, fall back to template_slug inference
      const rawType = (post.post_type as string | null) ?? ""
      const postType: PostType = (
        ["single_image", "carousel", "reel", "story", "text_only", "video"].includes(rawType)
          ? rawType
          : isCarousel
            ? "carousel"
            : mediaUrls.length === 0
              ? "text_only"
              : "single_image"
      ) as PostType

      return dispatchPublish({
        postId:     post.id,
        brandId:    post.brand_id,
        platform:   post.platform,
        postType,
        caption:    post.caption ?? "",
        hashtags,
        mediaUrls,
        isCarousel,
      })
    })

    // ── Step 5: Mark as posted ────────────────────────────────────────────────
    await step.run("mark-posted", async () => {
      const supabase = createServiceClient()
      const baseUpdate = {
        status:         "posted",
        posted_at:      new Date().toISOString(),
        posted_url:     result.postedUrl ?? null,
        buffer_post_id: result.publishedId, // reusing this column as platform_post_id
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any)
        .from("posts")
        // publish_error clears any error recorded by a previous failed attempt
        .update({ ...baseUpdate, publish_error: null })
        .eq("id", postId)

      if (updateErr) {
        // publish_error column not present yet (migration pending) — degrade gracefully
        console.warn(
          "[publishScheduledPost] publish_error column write failed (migration pending?) — falling back:",
          updateErr.message,
        )
        await supabase.from("posts").update(baseUpdate).eq("id", postId)
      }
    })

    // ── Step 6: Schedule analytics fetch in 24h ───────────────────────────────
    await step.sleepUntil("wait-24h-for-analytics", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())

    await step.run("trigger-analytics", async () => {
      await inngest.send({
        name: "postflow/analytics.post-published",
        data: { postId, brandId, platform },
      })
    })

    return { published: true, publishedId: result.publishedId, postedUrl: result.postedUrl }
  }
)
