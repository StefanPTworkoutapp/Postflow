/**
 * GET /api/auth/tiktok/callback
 *
 * TikTok OAuth 2.0 callback — exchanges the authorization code for an
 * access token (using PKCE code_verifier from cookie), fetches basic
 * user info, and upserts into social_accounts.
 *
 * Flow:
 *   1. Read code_verifier from cookie
 *   2. Exchange code + verifier → access_token at open.tiktokapis.com
 *   3. Fetch user info: open_id, display_name, avatar_url
 *   4. Upsert social_accounts (platform = "tiktok")
 *   5. Redirect → /settings/connections?connected=tiktok
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, NEXT_PUBLIC_APP_URL
 */

import { NextRequest } from "next/server"
import { cookies }      from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { getActiveBrand } from "@/lib/server/brand/getActiveBrand"

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"
const TT_API        = "https://open.tiktokapis.com/v2"

function oauthResult(opts: {
  success:  boolean
  handle?:  string
  returnTo: string
  error?:   string
}): Response {
  const { success, handle = "", returnTo, error = "unknown" } = opts
  const msg = success
    ? `{ type: 'pf_oauth_success', platform: 'tiktok', handle: ${JSON.stringify(handle)} }`
    : `{ type: 'pf_oauth_error', platform: 'tiktok', error: ${JSON.stringify(error)} }`
  const fallback = success
    ? `${REDIRECT_BASE}${returnTo}${returnTo.includes("?") ? "&" : "?"}connected=tiktok`
    : `${REDIRECT_BASE}/settings/connections?error=${encodeURIComponent(error)}`
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connecting…</title></head><body>
<script>
  if (window.opener && !window.opener.closed) {
    try { window.opener.postMessage(${msg}, '${REDIRECT_BASE}') } catch(e) {}
    window.close()
  } else {
    window.location.replace('${fallback}')
  }
</script>
<p style="font-family:system-ui,sans-serif;padding:2rem;color:#6b7280;text-align:center">
  ${success ? "Connected! You can close this window." : "Something went wrong. Redirecting…"}
</p>
</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Read PKCE cookie first (needed for returnTo even on early errors) ───────
  const cookieStore  = await cookies()
  const returnTo     = cookieStore.get("tiktok_return_to")?.value ?? "/settings/connections"
  const codeVerifier = cookieStore.get("tiktok_code_verifier")?.value

  const err = (reason: string) => oauthResult({ success: false, returnTo, error: reason })

  // ── TikTok error response ──────────────────────────────────────────────────
  const ttError = searchParams.get("error")
  if (ttError) {
    const desc = searchParams.get("error_description") ?? ttError
    console.error("[tiktok-callback] TikTok returned error:", ttError, desc)
    return err(desc)
  }

  const code = searchParams.get("code")
  if (!code) return err("missing_code")

  // ── Auth + brand ───────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.redirect(`${REDIRECT_BASE}/login`)

  const brand = await getActiveBrand()
  if (!brand) return err("no_brand")

  const clientKey    = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  const redirectUri  = `${REDIRECT_BASE}/api/auth/tiktok/callback`

  if (!clientKey || !clientSecret) {
    console.error("[tiktok-callback] Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET")
    return err("server_misconfigured")
  }

  // ── Read PKCE verifier from cookie ─────────────────────────────────────────
  if (!codeVerifier) {
    console.error("[tiktok-callback] Missing tiktok_code_verifier cookie")
    return err("missing_pkce_verifier")
  }
  // Clear the cookies immediately
  cookieStore.delete("tiktok_code_verifier")
  cookieStore.delete("tiktok_return_to")

  try {
    // ── Step 1: Exchange code for access token ─────────────────────────────
    const tokenRes = await fetch(`${TT_API}/oauth/token/`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key:    clientKey,
        client_secret: clientSecret,
        code,
        grant_type:    "authorization_code",
        redirect_uri:  redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    })

    const tokenBody = await tokenRes.text()

    if (!tokenRes.ok) {
      console.error("[tiktok-callback] Token exchange failed:", tokenRes.status, tokenBody.slice(0, 200))
      return err("token_exchange_failed")
    }

    // TikTok v2 OAuth token response shapes:
    //   Success (flat): { access_token, open_id, expires_in, refresh_token, scope, token_type }
    //   Success (wrapped, older): { data: { access_token, open_id, ... }, message: "success" }
    //   Error:          { error: "invalid_grant", error_description: "...", log_id: "..." }
    const tokenData = JSON.parse(tokenBody) as {
      // flat v2 success fields
      access_token?:  string
      open_id?:       string
      expires_in?:    number
      refresh_token?: string
      scope?:         string
      // wrapped format (legacy)
      data?: {
        access_token?:  string
        expires_in?:    number
        open_id?:       string
        refresh_token?: string
        error_code?:    number
        description?:   string
      }
      message?: string
      // error fields
      error?: string | { code: string; message: string }
      error_description?: string
    }

    // Handle error responses
    if (typeof tokenData.error === "string") {
      console.error("[tiktok-callback] TikTok token error:", tokenData.error, tokenData.error_description)
      return err(`tt_${tokenData.error}`)
    }
    if (tokenData.error && typeof tokenData.error === "object" && tokenData.error.code !== "ok") {
      console.error("[tiktok-callback] TikTok token error:", tokenData.error)
      return err(`tt_${tokenData.error.code}`)
    }
    if (tokenData.data?.error_code && tokenData.data.error_code !== 0) {
      console.error("[tiktok-callback] TikTok token error in data:", tokenData.data.error_code, tokenData.data.description)
      return err(`tt_err_${tokenData.data.error_code}`)
    }

    // Resolve fields from either flat or wrapped format
    const access_token = tokenData.access_token ?? tokenData.data?.access_token
    const open_id      = tokenData.open_id      ?? tokenData.data?.open_id
    const expires_in   = tokenData.expires_in   ?? tokenData.data?.expires_in ?? 86400

    if (!access_token || !open_id) {
      console.error("[tiktok-callback] Token response missing access_token/open_id:", tokenBody.slice(0, 300))
      return err("token_missing_fields")
    }
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // ── Step 2: Fetch user info ────────────────────────────────────────────
    let displayName = "TikTok user"
    let avatarUrl:  string | null = null

    const userRes = await fetch(
      `${TT_API}/user/info/?fields=open_id,display_name,avatar_url`,
      { headers: { "Authorization": `Bearer ${access_token}` } }
    )

    if (userRes.ok) {
      const userData = await userRes.json() as {
        data?: { user?: { display_name?: string; avatar_url?: string } }
      }
      displayName = userData.data?.user?.display_name ?? displayName
      avatarUrl   = userData.data?.user?.avatar_url ?? null
    }

    // ── Step 3: Upsert social_accounts ────────────────────────────────────
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(
        {
          brand_id:              brand.id,
          platform:              "tiktok",
          account_handle:        displayName,
          account_url:           avatarUrl ?? null,
          platform_access_token: access_token,
          platform_account_id:   open_id,
          token_expires_at:      expiresAt,
          is_active:             true,
        },
        { onConflict: "brand_id,platform" }
      )

    if (upsertError) {
      console.error("[tiktok-callback] DB upsert failed:", upsertError.message)
      return err("db_error")
    }

    console.log(`[tiktok-callback] Connected @${displayName} (open_id: ${open_id}) for brand ${brand.id}`)

    return oauthResult({ success: true, handle: displayName, returnTo })

  } catch (e) {
    console.error("[tiktok-callback] Unexpected error:", e)
    return err("unexpected")
  }
}
