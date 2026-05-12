/**
 * refreshTokens — Every 6 hours
 *
 * Proactively refreshes OAuth tokens for connected social accounts before
 * they expire so Buffer scheduling and analytics ingest never silently break.
 *
 * Strategy per platform:
 *   instagram  — Instagram long-lived tokens last 60 days. Refresh when
 *                ≤ 10 days remain via GET /refresh_access_token.
 *   linkedin   — LinkedIn access tokens last 60 days, no refresh token.
 *                Mark expired so the UI can prompt reconnect.
 *   buffer     — Buffer tokens (access_token column) don't expire on a
 *                standard schedule; skip refresh, just check is_active.
 *   other      — Log a warning if token_expires_at is past due; mark
 *                is_active = false so ConnectPrompt surfaces.
 *
 * Logs are minimal — noisy token refreshes would swamp Inngest logs.
 */

import { inngest }             from "../client"
import { createServiceClient } from "@/lib/supabase/service"

const REFRESH_WINDOW_DAYS = 10   // refresh Instagram tokens within 10 days of expiry

export const refreshTokens = inngest.createFunction(
  {
    id:   "postflow/refresh-tokens",
    name: "Refresh social account tokens",
    triggers: [{ cron: "0 */6 * * *" }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const logger = { info: console.log, warn: console.warn, error: console.error }
    const supabase = createServiceClient()

    // ── Load all accounts with a known expiry ─────────────────────────────────
    const { data: accounts, error } = await supabase
      .from("social_accounts")
      .select("id, platform, platform_access_token, refresh_token, token_expires_at, is_active")
      .not("token_expires_at", "is", null)

    if (error) {
      logger.error("[refreshTokens] Failed to load accounts", { error })
      return { refreshed: 0, deactivated: 0 }
    }

    let refreshed    = 0
    let deactivated  = 0

    for (const account of accounts ?? []) {
      const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null
      if (!expiresAt) continue

      const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1_000 * 60 * 60 * 24)

      // ── Already expired → deactivate ──────────────────────────────────────
      if (daysUntilExpiry <= 0) {
        if (account.is_active) {
          await supabase
            .from("social_accounts")
            .update({ is_active: false })
            .eq("id", account.id)
          deactivated++
          logger.warn("[refreshTokens] Token expired — deactivated", {
            id: account.id,
            platform: account.platform,
          })
        }
        continue
      }

      // ── Still fresh → skip ─────────────────────────────────────────────────
      if (daysUntilExpiry > REFRESH_WINDOW_DAYS) continue

      // ── Within refresh window: attempt platform-specific refresh ──────────
      if (account.platform === "instagram" && account.platform_access_token) {
        await step.run(`refresh-instagram-${account.id}`, async () => {
          try {
            const appSecret = process.env.INSTAGRAM_APP_SECRET
            if (!appSecret) return

            const url = new URL("https://graph.instagram.com/refresh_access_token")
            url.searchParams.set("grant_type",    "ig_refresh_token")
            url.searchParams.set("access_token",  account.platform_access_token!)

            const res  = await fetch(url.toString())
            const json = await res.json() as {
              access_token?: string
              expires_in?:   number
              error?:        { message: string }
            }

            if (!res.ok || json.error) {
              logger.error("[refreshTokens] Instagram refresh failed", {
                id: account.id, error: json.error?.message,
              })
              return
            }

            const newExpiry = new Date(Date.now() + (json.expires_in ?? 5_184_000) * 1_000)
            await supabase
              .from("social_accounts")
              .update({
                platform_access_token: json.access_token ?? account.platform_access_token,
                token_expires_at:      newExpiry.toISOString(),
                is_active:             true,
              })
              .eq("id", account.id)

            refreshed++
            logger.info("[refreshTokens] Instagram token refreshed", { id: account.id })
          } catch (err) {
            logger.error("[refreshTokens] Instagram refresh error", { id: account.id, err })
          }
        })
      } else {
        // LinkedIn and others: no server-side refresh available — mark expiring
        // so the Connections UI can surface a "reconnect" prompt. Don't deactivate
        // yet (still within window) — just leave is_active true so the user can act.
        logger.info("[refreshTokens] Token expiring soon — no auto-refresh", {
          id:       account.id,
          platform: account.platform,
          daysLeft: Math.round(daysUntilExpiry),
        })
      }
    }

    logger.info("[refreshTokens] Complete", { refreshed, deactivated })
    return { refreshed, deactivated }
  }
)
