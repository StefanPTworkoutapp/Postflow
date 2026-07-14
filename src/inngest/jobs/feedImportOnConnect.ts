/**
 * Feed import — on connect.
 *
 * Fired (fire-and-forget) from the OAuth callback routes right after a
 * social_accounts upsert succeeds for instagram/facebook/linkedin — imports
 * that account's last ~50 published posts so calendar generation has
 * immediate dedupe + cold-start baseline data instead of waiting for the
 * nightly cron.
 *
 * Event: postflow/social.connected  { brandId, platform }
 */

import { inngest } from "../client"
import { importFeedForAccount, IMPORT_PLATFORMS, type ImportablePlatform } from "@/lib/server/import/feedImport"

export const feedImportOnConnect = inngest.createFunction(
  {
    id:       "feed-import-on-connect",
    name:     "Feed Import — On Connect",
    triggers: [{ event: "postflow/social.connected" }],
    concurrency: { limit: 5 },
  },
  async ({ event, step }) => {
    const { brandId, platform } = event.data as { brandId: string; platform: string }

    if (!brandId || !IMPORT_PLATFORMS.includes(platform as ImportablePlatform)) {
      return { success: true, skipped: true, reason: "unsupported platform for feed import" }
    }

    const result = await step.run("import-feed", () =>
      importFeedForAccount(brandId, platform as ImportablePlatform, { limit: 50 })
    )

    return { success: true, brandId, platform, ...result }
  }
)
