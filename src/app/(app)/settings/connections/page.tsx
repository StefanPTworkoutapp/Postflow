import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getBufferChannels, bufferServiceToPlatform } from "@/lib/server/buffer/client"
import { ConnectionsClient } from "./ConnectionsClient"

export const metadata: Metadata = { title: "PostFlow · Connect" }

/**
 * /settings/connections
 *
 * Dedicated platform connections page. All social_accounts for the current brand
 * are shown here. Buffer channels are auto-synced on load (same logic as /settings).
 */
export default async function ConnectionsPage() {
  const supabase = await createClient()
  const brand = await getBrand()

  if (!brand) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connected Platforms</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Complete onboarding to connect your platforms.</p>
        </div>
      </div>
    )
  }

  // ── Fetch display data (no tokens) ────────────────────────────────────────
  const displayCols = "id, platform, account_handle, account_url, buffer_profile_id, is_active, token_expires_at, created_at" as const

  const { data: storedDisplay } = await supabase
    .from("social_accounts")
    .select(displayCols)
    .eq("brand_id", brand.id)
    .order("platform")

  // ── Fetch Buffer token separately for sync ────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("social_accounts")
    .select("access_token, buffer_profile_id")
    .eq("brand_id", brand.id)
    .not("buffer_profile_id", "is", null)
    .not("access_token",      "is", null)
    .maybeSingle()

  // ── Auto-sync Buffer channels ─────────────────────────────────────────────
  let displayAccounts = storedDisplay ?? []

  if (tokenRow?.access_token) {
    try {
      const liveChannels    = await getBufferChannels(tokenRow.access_token)
      const livePlatforms   = new Set(liveChannels.map(c => bufferServiceToPlatform(c.service)))
      const storedPlatforms = new Set(
        displayAccounts.filter(s => s.buffer_profile_id).map(s => s.platform)
      )

      for (const channel of liveChannels) {
        const platform = bufferServiceToPlatform(channel.service)
        if (!storedPlatforms.has(platform)) {
          await supabase.from("social_accounts").insert({
            brand_id:          brand.id,
            platform,
            account_handle:    channel.name,
            buffer_profile_id: channel.id,
            access_token:      tokenRow.access_token,
            is_active:         true,
          })
        } else {
          await supabase
            .from("social_accounts")
            .update({ account_handle: channel.name, buffer_profile_id: channel.id })
            .eq("brand_id", brand.id)
            .eq("platform", platform)
        }
      }

      for (const stored of displayAccounts.filter(s => s.buffer_profile_id)) {
        if (!livePlatforms.has(stored.platform)) {
          await supabase.from("social_accounts").delete().eq("id", stored.id)
        }
      }

      // Re-fetch display data after sync (no tokens)
      const { data: fresh } = await supabase
        .from("social_accounts")
        .select(displayCols)
        .eq("brand_id", brand.id)
        .order("platform")
      displayAccounts = fresh ?? displayAccounts
    } catch {
      // Buffer unavailable — show stale data
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connected Platforms</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Connect your social accounts so PostFlow can schedule and analyse your posts.
        </p>
      </div>
      <ConnectionsClient initialAccounts={displayAccounts} brandId={brand.id} />
    </div>
  )
}
