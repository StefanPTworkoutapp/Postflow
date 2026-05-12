/**
 * Daily analytics fetch — runs at 06:00 UTC every day.
 *
 * Implements Part 8B Guarantee 1:
 *   - Logs own start/end/counts to postflow.sync_runs
 *   - Catches errors per-brand individually — one failure never stops the whole sync
 *   - Logs per-brand failures to postflow.analytics_sync_errors
 *
 * After fetching, processes brand token signals for all newly-updated posts
 * (Guarantee 2 via processPostAnalytics).
 */

import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { fetchAndStoreMetaAnalytics }       from "@/lib/server/analytics/fetchMetaAnalytics"
import { fetchAndStoreLinkedInAnalytics }   from "@/lib/server/analytics/fetchLinkedInAnalytics"
import { processPostAnalytics }             from "@/lib/server/analytics/process-analytics"

/**
 * Type-bypass helper for tables not yet in the generated database.types.ts.
 * Remove once migration 20260511000001 runs and types are regenerated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newTables = (client: ReturnType<typeof createServiceClient>) => client as any

export const dailyAnalyticsFetch = inngest.createFunction(
  {
    id:       "daily-analytics-fetch",
    name:     "Daily Analytics Fetch",
    triggers: [{ cron: "0 6 * * *" }],
    concurrency: { limit: 5 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    // ── 1. Get all active brand IDs ─────────────────────────────────────────
    const brandIds: string[] = await step.run("get-brand-ids", async () => {
      const { data, error } = await supabase.from("brands").select("id")
      if (error) throw new Error(`Failed to load brands: ${error.message}`)
      return (data ?? []).map((b: { id: string }) => b.id)
    })

    // ── 2. Open sync_run rows (one per platform) ────────────────────────────
    const syncRunIds: Record<string, string> = await step.run("open-sync-runs", async () => {
      const platforms = ["instagram", "linkedin"]
      const runs = await Promise.all(
        platforms.map(async platform => {
          const { data } = await newTables(supabase)
            .from("sync_runs")
            .insert({
              platform,
              status:               "running",
              user_count_attempted: brandIds.length,
            })
            .select("id")
            .single()
          return [platform, (data as { id: string } | null)?.id ?? ""] as const
        })
      )
      return Object.fromEntries(runs)
    })

    // ── 3. Fan out per brand — catch errors individually ────────────────────
    const results = await Promise.all(
      brandIds.map((brandId: string) =>
        step.run(`fetch-analytics-${brandId}`, async () => {
          let instagram = { processed: 0, errors: 0 }
          let linkedin  = { processed: 0, errors: 0 }

          // Instagram
          try {
            instagram = await fetchAndStoreMetaAnalytics(brandId)
          } catch (err) {
            console.error(`[daily-analytics] instagram fetch failed for ${brandId}:`, err)
            const msg = err instanceof Error ? err.message : String(err)
            await newTables(supabase).from("analytics_sync_errors").insert({
              brand_id:     brandId,
              platform:     "instagram",
              error_type:   "fetch_failed",
              error_detail: { message: msg },
            })
            instagram = { processed: 0, errors: 1 }
          }

          // LinkedIn
          try {
            linkedin = await fetchAndStoreLinkedInAnalytics(brandId)
          } catch (err) {
            console.error(`[daily-analytics] linkedin fetch failed for ${brandId}:`, err)
            const msg = err instanceof Error ? err.message : String(err)
            await newTables(supabase).from("analytics_sync_errors").insert({
              brand_id:     brandId,
              platform:     "linkedin",
              error_type:   "fetch_failed",
              error_detail: { message: msg },
            })
            linkedin = { processed: 0, errors: 1 }
          }

          // ── Token learning: process analytics for any posts that now have data ──
          // Fetch posts that got analytics updated in the last 2 hours
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          const { data: recentAnalytics } = await supabase
            .from("post_analytics")
            .select(`
              post_id,
              impressions,
              reach,
              likes,
              comments,
              shares,
              saves,
              engagement_rate,
              click_through_rate,
              fetched_at,
              posts!inner(platform, template_slug, brand_id)
            `)
            .eq("posts.brand_id", brandId)
            .gte("fetched_at", twoHoursAgo)

          let tokensProcessed = 0
          for (const row of (recentAnalytics ?? [])) {
            const post = (row as { posts?: { platform: string; template_slug?: string | null } }).posts
            if (!post) continue
            try {
              const { signalsApplied } = await processPostAnalytics(
                {
                  postId:        row.post_id,
                  platform:      post.platform,
                  templateSlug:  (post as { template_slug?: string | null }).template_slug,
                  metrics: {
                    impressions:      row.impressions,
                    reach:            row.reach,
                    likes:            row.likes,
                    comments:         row.comments,
                    shares:           row.shares,
                    saves:            row.saves,
                    engagement_rate:  row.engagement_rate,
                    click_through_rate: row.click_through_rate,
                  },
                },
                brandId,
              )
              tokensProcessed += signalsApplied
            } catch (err) {
              console.error(`[daily-analytics] processPostAnalytics failed for ${row.post_id}:`, err)
            }
          }

          return {
            brandId,
            instagram,
            linkedin,
            tokensProcessed,
          }
        })
      )
    )

    // ── 4. Close sync_run rows with final counts ────────────────────────────
    await step.run("close-sync-runs", async () => {
      const totals: Record<string, { success: number; error: number }> = {
        instagram: { success: 0, error: 0 },
        linkedin:  { success: 0, error: 0 },
      }
      for (const r of results) {
        totals.instagram.success += r.instagram.processed
        totals.instagram.error   += r.instagram.errors
        totals.linkedin.success  += r.linkedin.processed
        totals.linkedin.error    += r.linkedin.errors
      }

      await Promise.all(
        Object.entries(syncRunIds).map(async ([platform, runId]) => {
          if (!runId) return
          const t = totals[platform] ?? { success: 0, error: 0 }
          const status = t.error > 0 && t.success === 0 ? "failed"
            : t.error > 0 ? "partial" : "clean"
          await newTables(supabase)
            .from("sync_runs")
            .update({
              ended_at:      new Date().toISOString(),
              success_count: t.success,
              error_count:   t.error,
              status,
            })
            .eq("id", runId)
        })
      )
    })

    const totalTokens = results.reduce((sum, r) => sum + r.tokensProcessed, 0)
    return {
      success:         true,
      brandsProcessed: brandIds.length,
      totalTokensNudged: totalTokens,
    }
  }
)
