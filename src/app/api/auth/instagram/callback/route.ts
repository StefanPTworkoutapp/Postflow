/**
 * GET /api/auth/instagram/callback
 *
 * OAuth 2.0 callback for Instagram Business Login.
 *
 * Meta redirects here after the user completes the Instagram Business Login
 * flow. We exchange the short-lived code for a long-lived access token, fetch
 * the Instagram Business Account ID (needed for Graph API insights), then
 * upsert into `social_accounts`.
 *
 * Flow:
 *   1. Exchange code → short-lived token
 *   2. Exchange short-lived → long-lived token (60-day)
 *   3. GET /me/accounts to find the connected Facebook Page
 *   4. From the Page, extract instagram_business_account.id
 *   5. GET /me?fields=id,username for the basic IG profile
 *   6. Upsert social_accounts row
 *   7. Redirect to /settings/connections?connected=instagram
 *
 * Error path:
 *   Any failure → redirect with ?error=<reason>
 *
 * Required env vars:
 *   INSTAGRAM_APP_ID      — from Meta App dashboard
 *   INSTAGRAM_APP_SECRET  — from Meta App dashboard
 *   NEXT_PUBLIC_APP_URL   — base URL (e.g. https://postflow-amber.vercel.app)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"

const GRAPH = "https://graph.facebook.com/v21.0"
const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

function errorRedirect(reason: string) {
  return NextResponse.redirect(
    `${REDIRECT_BASE}/settings/connections?error=${encodeURIComponent(reason)}`
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Error from Meta ────────────────────────────────────────────────────────
  const metaError = searchParams.get("error")
  if (metaError) {
    const desc = searchParams.get("error_description") ?? metaError
    console.error("[instagram-callback] Meta returned error:", metaError, desc)
    return errorRedirect(desc)
  }

  const code = searchParams.get("code")
  if (!code) return errorRedirect("missing_code")

  // Decode return_to from state parameter (set during initiation)
  const stateParam = searchParams.get("state")
  let returnTo = "/settings/connections"
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as { rt?: string }
      if (typeof decoded.rt === "string" && decoded.rt.startsWith("/")) returnTo = decoded.rt
    } catch { /* use default */ }
  }

  // ── Supabase session ───────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${REDIRECT_BASE}/login`)

  const brand = await getBrand()
  if (!brand) return errorRedirect("no_brand")

  const appId      = process.env.INSTAGRAM_APP_ID
  const appSecret  = process.env.INSTAGRAM_APP_SECRET
  const redirectUri = `${REDIRECT_BASE}/api/auth/instagram/callback`

  if (!appId || !appSecret) {
    console.error("[instagram-callback] Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET")
    return errorRedirect("server_misconfigured")
  }

  try {
    // ── Step 1: Exchange code for short-lived Facebook user token ────────────
    // Facebook Login OAuth codes must be exchanged at graph.facebook.com,
    // NOT api.instagram.com (that endpoint is Instagram Basic Display API only).
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`)
    tokenUrl.searchParams.set("client_id",     appId)
    tokenUrl.searchParams.set("client_secret", appSecret)
    tokenUrl.searchParams.set("redirect_uri",  redirectUri)
    tokenUrl.searchParams.set("code",          code)

    console.log("[instagram-callback] Step 1: Exchanging code for short-lived token")
    console.log("[instagram-callback] tokenUrl (redacted secret):", tokenUrl.toString().replace(appSecret, "***"))
    const tokenRes = await fetch(tokenUrl.toString())
    const tokenBody = await tokenRes.text()

    if (!tokenRes.ok) {
      console.error("[instagram-callback] Short-lived token exchange failed. Status:", tokenRes.status, "Body:", tokenBody)
      // Expose the raw Facebook error in the redirect so it's visible in the UI without needing Vercel logs.
      // Facebook error bodies look like: {"error":{"message":"...","type":"OAuthException","code":191}}
      let fbMsg = "token_exchange_failed"
      try {
        const fbErr = JSON.parse(tokenBody) as { error?: { message?: string; code?: number } }
        if (fbErr.error?.message) fbMsg = `fb_${fbErr.error.code ?? 0}: ${fbErr.error.message}`
      } catch { /* leave default */ }
      return errorRedirect(fbMsg)
    }

    console.log("[instagram-callback] Step 1 OK. Raw response:", tokenBody.slice(0, 120))

    const shortToken = JSON.parse(tokenBody) as { access_token: string; token_type: string; user_id?: number }

    // ── Step 2: Exchange for long-lived token (60-day) ───────────────────────
    // Facebook long-lived exchange also uses graph.facebook.com with grant_type=fb_exchange_token
    const longTokenUrl = new URL(`${GRAPH}/oauth/access_token`)
    longTokenUrl.searchParams.set("grant_type",      "fb_exchange_token")
    longTokenUrl.searchParams.set("client_id",       appId)
    longTokenUrl.searchParams.set("client_secret",   appSecret)
    longTokenUrl.searchParams.set("fb_exchange_token", shortToken.access_token)

    const longTokenRes = await fetch(longTokenUrl.toString())

    let accessToken   = shortToken.access_token
    let expiresAt: string | null = null

    if (longTokenRes.ok) {
      const lt = await longTokenRes.json() as { access_token: string; expires_in?: number }
      accessToken = lt.access_token
      // Facebook long-lived tokens last ~60 days (5_184_000 seconds)
      expiresAt   = new Date(Date.now() + (lt.expires_in ?? 5_184_000) * 1000).toISOString()
    }

    // ── Step 3: Fetch Instagram Business Account ID via Pages ────────────────
    // The Instagram Graph API insights endpoint requires the IG Business Account ID
    // (different from the IG User ID). It lives on the connected Facebook Page.
    let igBusinessAccountId: string | null = null

    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`
    )
    if (pagesRes.ok) {
      const pages = await pagesRes.json() as {
        data: Array<{
          id: string
          name: string
          instagram_business_account?: { id: string }
        }>
      }
      // Take the first page that has an IG business account linked
      const page = pages.data?.find(p => p.instagram_business_account?.id)
      igBusinessAccountId = page?.instagram_business_account?.id ?? null
    }

    // ── Step 4: Fetch IG profile (username) ───────────────────────────────────
    let username = "instagram_user"
    let igUserId = String(shortToken.user_id)

    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
    )
    if (profileRes.ok) {
      const profile = await profileRes.json() as { id: string; username: string }
      username = profile.username
      igUserId = profile.id
    }

    // ── Step 5: Upsert social_accounts ────────────────────────────────────────
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(
        {
          brand_id:              brand.id,
          platform:              "instagram",
          account_handle:        username,
          account_url:           `https://instagram.com/${username}`,
          platform_access_token: accessToken,
          platform_account_id:   igBusinessAccountId ?? igUserId,
          token_expires_at:      expiresAt,
          is_active:             true,
        },
        { onConflict: "brand_id,platform" }
      )

    if (upsertError) {
      console.error("[instagram-callback] DB upsert failed:", upsertError.message)
      return errorRedirect("db_error")
    }

    console.log(
      `[instagram-callback] Connected @${username} (ig_account: ${igBusinessAccountId ?? igUserId}) for brand ${brand.id}`
    )

    return NextResponse.redirect(
      `${REDIRECT_BASE}${returnTo}${returnTo.includes("?") ? "&" : "?"}connected=instagram`
    )

  } catch (err) {
    console.error("[instagram-callback] Unexpected error:", err)
    return errorRedirect("unexpected")
  }
}
