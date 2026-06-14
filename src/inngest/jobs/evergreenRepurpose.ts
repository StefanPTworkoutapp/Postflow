/**
 * evergreenRepurpose — weekly job that finds high-performing posts and
 * automatically creates Story drafts so the brand can re-share top content.
 *
 * Trigger: cron "every Sunday at 08:00 UTC"
 *
 * Logic:
 *   For each brand that has Instagram connected AND has post analytics:
 *   1. Find posts published >7 days ago with above-average engagement
 *   2. That have NOT already been repurposed in the last 30 days
 *   3. Create a Story draft (status="draft", post_type="story") pointing at the original
 *   4. Optionally notify the brand owner (future: push notification or email)
 *
 * The user reviews and schedules (or discards) the drafts.
 * We never auto-publish repurposed content — the user always approves.
 *
 * Configuration:
 *   MIN_ENGAGEMENT_MULTIPLIER = 1.5  →  post must be 1.5× the brand's average
 *   REPURPOSE_COOLDOWN_DAYS   = 30   →  same post can only be repurposed once per 30 days
 *   MAX_REPURPOSE_PER_RUN     = 3    →  max Story drafts created per brand per run
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"

const MIN_ENGAGEMENT_MULTIPLIER = 1.5
const REPURPOSE_COOLDOWN_DAYS   = 30
const MAX_REPURPOSE_PER_RUN     = 3

export const evergreenRepurpose = inngest.createFunction(
  {
    id:   "postflow/evergreen-repurpose",
    name: "Evergreen Repurpose — Create Story Drafts from Top Posts",
    triggers: [{ cron: "0 8 * * 0" }], // Every Sunday 08:00 UTC
    retries:  1,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {

    // ── Step 1: Find brands with Instagram connected ───────────────────────
    const brands = await step.run("find-instagram-brands", async () => {
      const db = createServiceClient()
      const { data } = await db
        .from("social_accounts")
        .select("brand_id")
        .eq("platform", "instagram")
        .eq("is_active", true)
      return (data ?? []).map((r: { brand_id: string }) => r.brand_id)
    })

    if (!brands.length) return { processed: 0, draftsCreated: 0 }

    // ── Step 2: For each brand, find top-performing posts ─────────────────
    const results = await step.run("repurpose-top-posts", async () => {
      const db            = createServiceClient()
      let totalDrafts     = 0
      const brandSummary: Array<{ brandId: string; drafted: number }> = []

      for (const brandId of brands) {
        // Get this brand's average engagement on Instagram.
        // post_analytics joins through posts to get brand_id + platform.
        const { data: avgData } = await db
          .from("post_analytics")
          .select("engagement_rate, posts!inner(brand_id, platform)")
          .eq("posts.brand_id", brandId)
          .eq("posts.platform", "instagram")
          .not("engagement_rate", "is", null)

        const rates = (avgData ?? []).map((r: { engagement_rate: number }) => r.engagement_rate)
        if (!rates.length) continue  // No analytics yet — skip

        const avgRate = rates.reduce((s: number, r: number) => s + r, 0) / rates.length
        const threshold = avgRate * MIN_ENGAGEMENT_MULTIPLIER

        // Posts published >7 days ago with high engagement
        const sevenDaysAgo  = new Date(Date.now() - 7  * 86_400_000).toISOString()
        const thirtyDaysAgo = new Date(Date.now() - REPURPOSE_COOLDOWN_DAYS * 86_400_000).toISOString()

        const { data: topPosts } = await db
          .from("posts")
          .select(`
            id, caption, hashtags, media_ids, carousel_image_urls,
            template_slug, post_type, posted_at
          `)
          .eq("brand_id", brandId)
          .eq("platform", "instagram")
          .eq("status", "posted")
          .lt("posted_at", sevenDaysAgo)
          .not("post_type", "eq", "story")  // don't re-repurpose stories
          .order("posted_at", { ascending: false })
          .limit(20)

        if (!topPosts?.length) continue

        // Filter by engagement threshold and exclude recently repurposed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: recentRepurposed } = await (db.from("posts") as any)
          .select("source_post_id")
          .eq("brand_id", brandId)
          .eq("post_type", "story")
          .gte("created_at", thirtyDaysAgo)
          .not("source_post_id", "is", null)

        const recentlyUsed = new Set(
          (recentRepurposed ?? []).map((r: { source_post_id: string }) => r.source_post_id)
        )

        // Join through posts to filter by brand + platform
        const { data: topAnalytics } = await db
          .from("post_analytics")
          .select("post_id, engagement_rate, posts!inner(brand_id, platform)")
          .eq("posts.brand_id", brandId)
          .eq("posts.platform", "instagram")
          .gte("engagement_rate", threshold)
          .in("post_id", topPosts.map((p: { id: string }) => p.id))

        const highPerformingIds = new Set(
          (topAnalytics ?? []).map((a: { post_id: string }) => a.post_id)
        )

        const eligible = topPosts.filter((p: { id: string }) =>
          highPerformingIds.has(p.id) && !recentlyUsed.has(p.id)
        )

        if (!eligible.length) continue

        // Create Story drafts (up to MAX_REPURPOSE_PER_RUN)
        let drafted = 0
        for (const post of eligible.slice(0, MAX_REPURPOSE_PER_RUN)) {
          const carouselUrls = (post.carousel_image_urls as string[] | null) ?? []
          const firstImage   = carouselUrls[0] ?? null

          // Trim caption to story-appropriate length (first sentence)
          const rawCaption   = (post.caption ?? "").trim()
          const firstSentence = rawCaption.split(/[.!?]/)[0]?.trim()
          const storyCaption = firstSentence ? `${firstSentence}.` : rawCaption.slice(0, 80)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db.from("posts") as any).insert({
            brand_id:            brandId,
            platform:            "instagram",
            post_type:           "story",
            template_slug:       "story-teaser",
            caption:             storyCaption,
            hashtags:            [],
            media_ids:           (post.media_ids as string[] | null) ?? [],
            carousel_image_urls: firstImage ? [firstImage] : [],
            status:              "draft",
            source_post_id:      post.id,  // lineage — col added in migration 20260616000004
          })
          drafted++
        }

        totalDrafts += drafted
        brandSummary.push({ brandId, drafted })
      }

      return { totalDrafts, brandSummary }
    })

    console.log(`[evergreenRepurpose] Created ${results.totalDrafts} Story drafts across ${brands.length} brands`)
    return results
  }
)
