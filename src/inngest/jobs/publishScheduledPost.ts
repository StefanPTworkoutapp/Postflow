/**
 * publishScheduledPost — fires when a post is scheduled and publishes it directly
 * to the platform at the correct time.
 *
 * Trigger: event "postflow/post.scheduled"
 * Event data: { postId, brandId, platform, scheduledAt }
 *
 * Flow:
 *   1. Sleep until scheduledAt (Inngest persists the job across server restarts)
 *   2. Load the post from DB — verify it's still in "scheduled" status
 *   3. Resolve media URLs from media_ids + carousel_image_urls
 *   4. Dispatch to the right platform publisher
 *   5. Update post: status="posted", posted_at, posted_url, buffer_post_id (used as platform_post_id)
 *   6. Fire processPostAnalytics after 24h to let platform metrics settle
 *
 * Error handling:
 *   - Inngest retries automatically on unexpected throws (retries: 2 → 3 attempts total)
 *   - Once retries are exhausted, the `onFailure` handler below fires: it updates the
 *     post's status to "failed" and stores the error in posts.publish_error so the
 *     Posts list / PostEditor can surface a clear failed state with a Retry action
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { dispatchPublish }     from "@/lib/server/publish/dispatcher"
import type { PostType }       from "@/lib/server/publish/types"

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
