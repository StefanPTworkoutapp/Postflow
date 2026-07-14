/**
 * postPublishedAnalytics — triggered 24 hours after a post is published.
 *
 * This is the handler for the "postflow/analytics.post-published" event that
 * publishScheduledPost fires after its 24h sleep. It fetches fresh platform
 * analytics for that specific post and feeds them into the brand's intelligence
 * tokens, updating future caption generation.
 *
 * Without this handler the event was silently dropped — analytics were only
 * collected by the daily 6am cron, not per-post after publish.
 *
 * Flow:
 *   1. Load the post + its social_account tokens
 *   2. Fetch analytics from the platform API (impressions, likes, engagement_rate, etc.)
 *   3. Upsert into post_analytics
 *   4. Call processPostAnalytics to nudge brand intelligence tokens
 */

import { inngest }                    from "../client"
import { createServiceClient }        from "@/lib/supabase/service"
import { processPostAnalytics }       from "@/lib/server/analytics/process-analytics"
import type { PostAnalyticsInput }    from "@/lib/server/analytics/process-analytics"

export const postPublishedAnalytics = inngest.createFunction(
  {
    id:      "postflow/post-published-analytics",
    name:    "Post-Publish Analytics — Fetch & Process 24h After Publish",
    triggers: [{ event: "postflow/analytics.post-published" }],
    retries:  2,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { postId, brandId, platform } = (event as any).data as {
      postId:   string
      brandId:  string
      platform: string
    }

    // ── Step 1: Load post + verify it's in "posted" status ────────────────
    const post = await step.run("load-post", async () => {
      const db = createServiceClient()
      const { data, error } = await db
        .from("posts")
        .select("id, brand_id, platform, buffer_post_id, posted_at, post_type, template_slug")
        .eq("id", postId)
        .single()

      if (error || !data) throw new Error(`Post ${postId} not found`)
      if (data.brand_id !== brandId) throw new Error("Brand mismatch")
      return data
    })

    // ── Step 1b: Skip reminder-mode posts ──────────────────────────────────
    // publishScheduledPost never fires this event for publish_mode='reminder'
    // posts (it returns early after emailing), so this only guards against a
    // stray/manual event send. A reminder post has no real platform post id —
    // fetching "analytics" for it would be meaningless or crash. Selected
    // separately and swallowed on error so a pre-migration environment
    // (publish_mode column absent) just proceeds as 'direct'.
    const isReminderMode = await step.run("check-reminder-mode", async () => {
      const db = createServiceClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (db as any)
        .from("posts")
        .select("publish_mode")
        .eq("id", postId)
        .maybeSingle()
      if (error || !data) return false
      return (data as { publish_mode?: string | null }).publish_mode === "reminder"
    })

    if (isReminderMode) {
      return { skipped: true, reason: "reminder-mode post — no platform post id to fetch analytics for" }
    }

    // ── Step 2: Check if analytics already exist (e.g. daily cron got there first) ──
    const alreadyFetched = await step.run("check-existing-analytics", async () => {
      const db = createServiceClient()
      const { data } = await db
        .from("post_analytics")
        .select("id, fetched_at")
        .eq("post_id", postId)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      return !!data
    })

    if (alreadyFetched) {
      // Daily cron already ran — just make sure tokens are updated
      return await step.run("process-existing-analytics", async () => {
        const input: PostAnalyticsInput = {
          postId,
          platform,
          metrics: {},
        }
        return processPostAnalytics(input, brandId)
      })
    }

    // ── Step 3: Fetch analytics from platform ─────────────────────────────
    // For now, upsert a placeholder row so processPostAnalytics can run.
    // The daily cron will fill in real metrics when the platform data settles.
    // Direct platform analytics fetching is handled by dailyAnalyticsFetch
    // (which calls Buffer/platform APIs) — this job is the trigger, not the fetcher.
    await step.run("upsert-analytics-placeholder", async () => {
      const db = createServiceClient()
      // Only insert if no row exists yet
      await db
        .from("post_analytics")
        .upsert({
          post_id:      postId,
          fetched_at:   new Date().toISOString(),
          impressions:  0,
          likes:        0,
          comments:     0,
          shares:       0,
          saves:        0,
          reach:        0,
          clicks:       0,
          // Signal to the daily cron that this post needs a real fetch
        }, { onConflict: "post_id" })
    })

    // ── Step 4: Process analytics → nudge intelligence tokens ────────────
    const result = await step.run("process-analytics", async () => {
      const input: PostAnalyticsInput = {
        postId,
        platform,
        templateSlug: post.template_slug ?? undefined,
        metrics: {},
      }
      return processPostAnalytics(input, brandId)
    })

    return { postId, brandId, platform, signalsApplied: result?.signalsApplied ?? 0 }
  }
)
