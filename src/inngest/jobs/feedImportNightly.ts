/**
 * Feed import — nightly cron.
 *
 * Runs 05:30 UTC every day (offset from dailyAnalyticsFetch's 06:00 so the
 * two don't contend for the same Meta/LinkedIn rate-limit budget). For every
 * active social_account on a supported feed-import platform
 * (instagram/facebook/linkedin), pulls posts newer than that account's last
 * import. New accounts (no prior imported_posts rows) get the same ~50-post
 * backfill as the on-connect job, in case that event was ever missed
 * (deploy race, retry exhaustion, etc.) — this cron is the safety net.
 *
 * Per-account failures are caught individually (mirrors dailyAnalyticsFetch.ts)
 * — one account's error never stops the batch, and is logged to
 * analytics_sync_errors for /admin visibility.
 */

import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/service"
import { importFeedForAccount, IMPORT_PLATFORMS, type ImportablePlatform } from "@/lib/server/import/feedImport"

/**
 * Type-bypass helper for tables not yet in the generated database.types.ts.
 * Remove once migration 20260714000009 runs and types are regenerated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newTables = (client: ReturnType<typeof createServiceClient>) => client as any

export const feedImportNightly = inngest.createFunction(
  {
    id:       "feed-import-nightly",
    name:     "Feed Import — Nightly",
    triggers: [{ cron: "30 5 * * *" }],
    concurrency: { limit: 5 },
  },
  async ({ step }) => {
    const supabase = createServiceClient()

    const accounts: Array<{ brand_id: string; platform: ImportablePlatform }> = await step.run(
      "get-import-accounts",
      async () => {
        const { data } = await supabase
          .from("social_accounts")
          .select("brand_id, platform")
          .in("platform", IMPORT_PLATFORMS)
          .eq("is_active", true)
        return (data ?? []) as Array<{ brand_id: string; platform: ImportablePlatform }>
      }
    )

    const results = await Promise.all(
      accounts.map(({ brand_id, platform }) =>
        step.run(`import-${brand_id}-${platform}`, async () => {
          const { data: latest } = await newTables(supabase)
            .from("imported_posts")
            .select("posted_at")
            .eq("brand_id", brand_id)
            .eq("platform", platform)
            .order("posted_at", { ascending: false })
            .limit(1)
            .maybeSingle()

          const sinceIso = (latest as { posted_at: string | null } | null)?.posted_at ?? undefined
          const result = await importFeedForAccount(brand_id, platform, {
            limit:    sinceIso ? 25 : 50,
            sinceIso,
          })
          return { brand_id, platform, ...result }
        })
      )
    )

    const totals = results.reduce(
      (acc, r) => ({ imported: acc.imported + r.imported, errors: acc.errors + r.errors }),
      { imported: 0, errors: 0 }
    )

    return { success: true, accountsChecked: accounts.length, ...totals }
  }
)
