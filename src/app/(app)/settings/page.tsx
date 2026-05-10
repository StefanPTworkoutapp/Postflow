import { createClient } from "@/lib/supabase/server"
import { getBrand } from "@/lib/server/brand/getBrand"
import { getBufferChannels, bufferServiceToPlatform } from "@/lib/server/buffer/client"
import { SettingsClient } from "./SettingsClient"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const brand = await getBrand()

  // Load account info
  const { data: account } = user
    ? await supabase.from("accounts").select("*").eq("id", user.id).single()
    : { data: null }

  // Load connected social accounts for this brand
  const { data: rawAccounts } = brand
    ? await supabase
        .from("social_accounts")
        .select("*")
        .eq("brand_id", brand.id)
        .order("platform")
    : { data: [] }

  const storedAccounts = rawAccounts ?? []

  // ── Auto-sync Buffer channels ─────────────────────────────────────────────
  // If the brand has a stored Buffer token, silently re-fetch channels and
  // sync any additions or removals that happened in Buffer since last visit.
  let socialAccounts = storedAccounts
  const bufferAccount = storedAccounts.find(s => s.buffer_profile_id && s.access_token)

  if (brand && bufferAccount?.access_token) {
    try {
      const liveChannels = await getBufferChannels(bufferAccount.access_token)
      const livePlatforms = new Set(liveChannels.map(c => bufferServiceToPlatform(c.service)))
      const storedPlatforms = new Set(storedAccounts.filter(s => s.buffer_profile_id).map(s => s.platform))

      // Add newly connected channels
      for (const channel of liveChannels) {
        const platform = bufferServiceToPlatform(channel.service)
        if (!storedPlatforms.has(platform)) {
          await supabase.from("social_accounts").insert({
            brand_id:          brand.id,
            platform,
            account_handle:    channel.name,
            buffer_profile_id: channel.id,
            access_token:      bufferAccount.access_token,
            is_active:         true,
          })
        } else {
          // Update handle/channelId in case it changed
          await supabase
            .from("social_accounts")
            .update({ account_handle: channel.name, buffer_profile_id: channel.id })
            .eq("brand_id", brand.id)
            .eq("platform", platform)
        }
      }

      // Remove channels that were disconnected in Buffer
      for (const stored of storedAccounts.filter(s => s.buffer_profile_id)) {
        if (!livePlatforms.has(stored.platform)) {
          await supabase
            .from("social_accounts")
            .delete()
            .eq("id", stored.id)
        }
      }

      // Re-fetch after sync so the UI reflects current state
      const { data: fresh } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("brand_id", brand.id)
        .order("platform")
      socialAccounts = fresh ?? storedAccounts
    } catch {
      // Buffer API unavailable or token invalid — show stale data, don't crash
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Manage your account, connected platforms, and billing.
        </p>
      </div>

      <SettingsClient
        user={{ id: user?.id ?? "", email: user?.email ?? "", name: account?.name ?? null }}
        account={account ?? null}
        socialAccounts={socialAccounts}
        brandId={brand?.id ?? null}
      />
    </div>
  )
}
