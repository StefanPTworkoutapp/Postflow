/**
 * GET /api/auth/facebook/callback
 *
 * Facebook Pages OAuth callback — exchanges the authorization code for a
 * long-lived user token, fetches the user's Facebook Pages list, takes the
 * first Page with manage_pages permission, and upserts into social_accounts.
 *
 * Flow:
 *   1. Exchange code → short-lived user token
 *   2. Exchange short-lived → long-lived token (60-day)
 *   3. GET /me/accounts → find first manageable Facebook Page
 *   4. Upsert social_accounts (platform = "facebook") with Page token
 *   5. Redirect → /settings/connections?connected=facebook
 *
 * Reuses: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET (same Meta app, different redirect URI + scopes)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"
import { getBrand }                  from "@/lib/server/brand/getBrand"

const GRAPH         = "https://graph.facebook.com/v21.0"
const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://postflow-amber.vercel.app"

function errorRedirect(reason: string) {
  return NextResponse.redirect(
    `${REDIRECT_BASE}/settings/connections?error=${encodeURIComponent(reason)}`
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ── Meta error response ────────────────────────────────────────────────────
  const metaError = searchParams.get("error")
  if (metaError) {
    const desc = searchParams.get("error_description") ?? metaError
    console.error("[facebook-callback] Meta returned error:", metaError, desc)
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

  // ── Auth + brand ───────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${REDIRECT_BASE}/login`)

  const brand = await getBrand()
  if (!brand) return errorRedirect("no_brand")

  const appId      = process.env.INSTAGRAM_APP_ID
  const appSecret  = process.env.INSTAGRAM_APP_SECRET
  const redirectUri = `${REDIRECT_BASE}/api/auth/facebook/callback`

  if (!appId || !appSecret) {
    console.error("[facebook-callback] Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET")
    return errorRedirect("server_misconfigured")
  }

  try {
    // ── Step 1: Exchange code for short-lived user token ───────────────────
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`)
    tokenUrl.searchParams.set("client_id",     appId)
    tokenUrl.searchParams.set("client_secret", appSecret)
    tokenUrl.searchParams.set("redirect_uri",  redirectUri)
    tokenUrl.searchParams.set("code",          code)

    const tokenRes  = await fetch(tokenUrl.toString())
    const tokenBody = await tokenRes.text()

    if (!tokenRes.ok) {
      console.error("[facebook-callback] Token exchange failed:", tokenRes.status, tokenBody.slice(0, 200))
      let fbMsg = "token_exchange_failed"
      try {
        const fbErr = JSON.parse(tokenBody) as { error?: { message?: string; code?: number } }
        if (fbErr.error?.message) fbMsg = `fb_${fbErr.error.code ?? 0}: ${fbErr.error.message}`
      } catch { /* leave default */ }
      return errorRedirect(fbMsg)
    }

    const shortToken = JSON.parse(tokenBody) as { access_token: string }

    // ── Step 2: Exchange for long-lived token (60-day) ─────────────────────
    const longTokenUrl = new URL(`${GRAPH}/oauth/access_token`)
    longTokenUrl.searchParams.set("grant_type",         "fb_exchange_token")
    longTokenUrl.searchParams.set("client_id",          appId)
    longTokenUrl.searchParams.set("client_secret",      appSecret)
    longTokenUrl.searchParams.set("fb_exchange_token",  shortToken.access_token)

    const longTokenRes = await fetch(longTokenUrl.toString())
    let accessToken    = shortToken.access_token
    let expiresAt: string | null = null

    if (longTokenRes.ok) {
      const lt = await longTokenRes.json() as { access_token: string; expires_in?: number }
      accessToken = lt.access_token
      expiresAt   = new Date(Date.now() + (lt.expires_in ?? 5_184_000) * 1000).toISOString()
    }

    // ── Step 3: Fetch Facebook Pages the user manages ─────────────────────
    // We use the PAGE token (not the user token) for publishing — this is
    // the long-lived page access token tied to the specific Page.
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token,category&access_token=${accessToken}`
    )

    if (!pagesRes.ok) {
      console.error("[facebook-callback] /me/accounts failed:", pagesRes.status)
      return errorRedirect("pages_fetch_failed")
    }

    const pages = await pagesRes.json() as {
      data: Array<{
        id:           string
        name:         string
        access_token: string
        category?:    string
      }>
    }

    if (!pages.data?.length) {
      console.warn("[facebook-callback] No Facebook Pages found for user")
      return errorRedirect("no_pages_found")
    }

    // Take the first Page — users will typically have one business Page
    const page = pages.data[0]

    // ── Step 4: Upsert social_accounts ────────────────────────────────────
    // Use the PAGE access token (not the user token) for publishing
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(
        {
          brand_id:              brand.id,
          platform:              "facebook",
          account_handle:        page.name,
          account_url:           `https://www.facebook.com/${page.id}`,
          platform_access_token: page.access_token,
          platform_account_id:   page.id,
          token_expires_at:      expiresAt,   // page tokens are long-lived
          is_active:             true,
        },
        { onConflict: "brand_id,platform" }
      )

    if (upsertError) {
      console.error("[facebook-callback] DB upsert failed:", upsertError.message)
      return errorRedirect("db_error")
    }

    console.log(
      `[facebook-callback] Connected Page "${page.name}" (${page.id}) for brand ${brand.id}`
    )

    return NextResponse.redirect(
      `${REDIRECT_BASE}${returnTo}${returnTo.includes("?") ? "&" : "?"}connected=facebook`
    )

  } catch (err) {
    console.error("[facebook-callback] Unexpected error:", err)
    return errorRedirect("unexpected")
  }
}
